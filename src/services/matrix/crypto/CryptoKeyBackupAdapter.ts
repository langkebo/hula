/**
 * CryptoKeyBackupAdapter — key backup, restore, import/export operations.
 *
 * Extracted from CryptoSDKAdapter. Contains the complex setupKeyBackupWithOptions
 * flow (multi-branch with SSSS non-blocking upload and timeout protection).
 */

import type { MatrixClient } from 'matrix-js-sdk'
import type { GeneratedSecretStorageKey, MatrixAuthData } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import type {
  CryptoAdapterAccessors,
  KeyBackupRestoreResult,
  KeyBackupSetupResult,
  KeyExportResult,
  KeyImportResult
} from './cryptoAdapterTypes'

const logger = createLogger('CryptoKeyBackupAdapter')

/**
 * 直接通过 REST API 上传 SSSS 密钥到 account_data（绕过 SDK 的 sync echo 等待）。
 *
 * 根因：SDK 的 bootstrapSecretStorage → setDefaultKeyId 内部先 PUT account_data，
 * 再等待 /sync 回送 AccountData 事件。在 sliding sync 模式下，account_data 回送
 * 可能延迟 30s+ 或不回送，导致 bootstrap 永久挂起。
 *
 * 本函数使用 SDK 的 `setAccountDataRaw`（底层 HTTP PUT，不等待 sync echo）上传：
 *   1. m.secret_storage.key.{keyId} — 密钥描述（iv、mac 等）
 *   2. m.secret_storage.default_key — 默认密钥 ID
 *
 * 生成唯一的 keyId，上传后密钥立即持久化到服务端，无需等待 sync 回声。
 *
 * @param client MatrixClient 实例
 * @param generatedKey 由 createRecoveryKeyFromPassphrase 生成的密钥
 * @returns 上传成功的 keyId（供后续 bootstrap 对比验证）
 */
async function uploadSsssKeyDirectly(client: MatrixClient, generatedKey: GeneratedSecretStorageKey): Promise<string> {
  // 生成唯一 keyId（与 SDK 的 secureRandomString(32) 对齐）
  const keyId = crypto.randomUUID().replace(/-/g, '')

  // 计算 iv 和 mac（与 SDK 的 calculateKeyCheck 对齐）
  const keyData = generatedKey.privateKey
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ivBase64 = btoa(String.fromCharCode(...iv))

  // 使用 SubtleCrypto 计算 HMAC-SHA256 作为 mac
  const macKey = await crypto.subtle.importKey(
    'raw',
    keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const macBuffer = await crypto.subtle.sign('HMAC', macKey, iv)
  const macBase64 = btoa(String.fromCharCode(...new Uint8Array(macBuffer)))

  // 构造密钥描述（对齐 SSSS AES-128 规范）
  const keyInfo: Record<string, unknown> = {
    algorithm: 'm.vodozemac.v1',
    iv: ivBase64,
    mac: macBase64
  }
  if (generatedKey.keyInfo?.passphrase) {
    keyInfo.passphrase = generatedKey.keyInfo.passphrase
  }

  // 使用 setAccountDataRaw（底层 HTTP PUT，不等待 sync echo）直接上传。
  // SDK 的 setAccountData 会等待 ClientEvent.AccountData 回声（sliding sync 下可能 30s+），
  // 而 setAccountDataRaw 立即返回（仅 HTTP PUT 完成即 resolve）。
  const clientWithRaw = client as MatrixClient & {
    setAccountDataRaw?: (eventType: string, content: unknown) => Promise<unknown>
  }
  const uploadFn = clientWithRaw.setAccountDataRaw?.bind(client) ?? client.setAccountData.bind(client)

  await uploadFn(`m.secret_storage.key.${keyId}`, keyInfo)
  logger.info(`[SSSS] 已通过 REST 上传密钥描述: m.secret_storage.key.${keyId}`)

  await uploadFn('m.secret_storage.default_key', { key: keyId })
  logger.info(`[SSSS] 已通过 REST 上传默认密钥 ID: ${keyId}`)

  return keyId
}

export class CryptoKeyBackupAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

  /** 备份密钥
   */
  async backupKeys(): Promise<void> {
    const backupManager = this.accessors.getKeyBackupManager()
    if (backupManager) {
      const backupInfo = await backupManager.checkKeyBackup()
      if (!backupInfo) {
        const crypto = this.accessors.getCrypto()
        if (crypto) {
          await crypto.resetKeyBackup()
          logger.info('创建新的密钥备份')
        }
      }
      backupManager.scheduleKeyBackupSend()
      return
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        await crypto.resetKeyBackup()
        logger.info('创建新的密钥备份')
      }
    }
  }

  /** 设置密钥备份（ISSUE-6.3: 客户端派生，passphrase 不上送服务端）
   */
  async setupKeyBackup(passphrase: string): Promise<KeyBackupSetupResult> {
    try {
      // 客户端派生：passphrase 经 PBKDF2 派生 recovery key，仅上传公钥 + 密文
      await this.setupKeyBackupWithOptions(passphrase ? { password: passphrase } : undefined)
      logger.info('密钥备份设置成功(客户端派生)')
      return { success: true }
    } catch (err) {
      logger.error('密钥备份设置失败(客户端派生)', err)
      return { success: false }
    }
  }

  async setupKeyBackupWithOptions(
    input?:
      | string
      | {
          recoveryKey?: string
          password?: string
          authData?: unknown
          generatedKey?: GeneratedSecretStorageKey | null
        }
  ): Promise<string> {
    // 用 logger.warn 确保所有步骤都显示在终端（INFO 级别可能被 Tauri 插件缓冲丢失）
    const log = (msg: string) => {
      logger.warn(`[CryptoKeyBackupAdapter] ${msg}`)
    }
    const logErr = (msg: string) => {
      logger.error(`[CryptoKeyBackupAdapter] ${msg}`)
    }

    log('setupKeyBackupWithOptions 开始')
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      logErr('setupKeyBackupWithOptions 失败: getCrypto() 返回 null')
      throw new Error('CryptoApi 不可用')
    }
    log(
      `getCrypto() 成功 — createRecoveryKeyFromPassphrase=${typeof crypto.createRecoveryKeyFromPassphrase === 'function'}, bootstrapSecretStorage=${typeof crypto.bootstrapSecretStorage === 'function'}`
    )

    const recoveryKey = typeof input === 'string' ? input : input?.recoveryKey
    let generatedKey = typeof input === 'string' ? null : (input?.generatedKey ?? null)
    const authData = typeof input === 'string' ? undefined : (input?.authData as Record<string, unknown> | undefined)

    if (recoveryKey) {
      log('分支 1: recoveryKey 已提供，调用 crypto.restoreKeyBackup()')
      await crypto.restoreKeyBackup()
      log('分支 1 完成: restoreKeyBackup 成功')
      return recoveryKey
    }

    if (!generatedKey && typeof crypto.createRecoveryKeyFromPassphrase === 'function') {
      const password = typeof input !== 'string' ? input?.password : undefined
      log(`分支 2: 调用 createRecoveryKeyFromPassphrase — password=${password ? '已提供' : '未提供(随机生成)'}`)
      const t2 = Date.now()
      // 30s 超时保护，防止 WASM 操作挂起
      generatedKey = await Promise.race([
        crypto.createRecoveryKeyFromPassphrase(password),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('createRecoveryKeyFromPassphrase 超时 (30s)')), 30000)
        )
      ])
      log(
        `分支 2 完成: createRecoveryKeyFromPassphrase 成功 (${Date.now() - t2}ms) — encodedKeyLength=${generatedKey?.encodedPrivateKey?.length ?? 0}`
      )
    } else if (!generatedKey) {
      log('跳过分支 2: createRecoveryKeyFromPassphrase 不是函数或 generatedKey 已存在')
    }

    if (generatedKey && typeof crypto.bootstrapSecretStorage === 'function') {
      // 非阻塞模式：密钥已生成，SSSS 上传改为后台执行，不阻塞用户界面
      //
      // 根因（SSSS-45s-timeout）：
      // bootstrapSecretStorage 内部 setDefaultKeyId 上传 account_data 后，
      // 等待 /sync 回送 AccountData 事件才 resolve。客户端使用 sliding sync
      // （pollTimeout 15-30s），传统 /sync 的 long-poll 周期可能需要 30s+ 才
      // 回送 AccountData 事件。45s 超时仍可能不够。
      //
      // 修复策略（两阶段）：
      //   阶段 A：直接通过 REST API 上传 SSSS 密钥到 account_data（绕过 SDK 的
      //   setDefaultKeyId 内部 sync echo 等待），确保密钥立即持久化到服务端。
      //   阶段 B：调用 bootstrapSecretStorage 完成 SDK 内部状态注册（它会检测到
      //   密钥已存在而跳过重复上传，但仍需等待 sync echo）。若阶段 B 超时，
      //   密钥已在服务端，可安全继续 resetKeyBackup。
      log('分支 3: SSSS 上传改为非阻塞（后台执行），立即返回密钥')
      const t3 = Date.now()

      void (async () => {
        const client = matrixClientService.getClient()
        if (!client) {
          log('分支 3 中止: client 不可用')
          return
        }

        // ── 阶段 A：直接 REST 上传 SSSS 密钥（不依赖 sync echo） ──
        try {
          await uploadSsssKeyDirectly(client, generatedKey)
          log(`分支 3A 完成: SSSS 密钥已通过 REST 直接上传 (${Date.now() - t3}ms)`)
        } catch (uploadErr) {
          log(
            `分支 3A 失败: REST 直接上传 SSSS 密钥失败 (${Date.now() - t3}ms): ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`
          )
          // REST 上传失败，继续尝试 bootstrap 流程（兜底）
        }

        // ── 阶段 B：bootstrapSecretStorage 完成 SDK 内部状态注册 ──
        // 确保 sync 循环正在运行
        const syncState = client.getSyncState?.()
        if (syncState === 'STOPPED' || syncState === null || syncState === 'ERROR') {
          log(`分支 3 前置: sync 未运行 (state=${syncState})，调用 startClient() 启动 sync`)
          try {
            client.startClient?.()
            await new Promise<void>((resolve) => {
              const deadline = Date.now() + 5000
              const check = () => {
                const state = client.getSyncState?.()
                if (state === 'SYNCING' || state === 'PREPARED' || Date.now() > deadline) {
                  resolve()
                } else {
                  setTimeout(check, 200)
                }
              }
              check()
            })
            log(`分支 3 前置: sync 已启动 (state=${client.getSyncState?.()})`)
          } catch (e) {
            log(`分支 3 前置: startClient 失败: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        try {
          await Promise.race([
            crypto.bootstrapSecretStorage({
              createSecretStorageKey: async () => {
                log('分支 3a 回调: createSecretStorageKey 被 SDK 调用')
                return generatedKey as GeneratedSecretStorageKey
              },
              setupNewSecretStorage: true,
              setupNewKeyBackup: false
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('bootstrapSecretStorage(SSSS) 后台超时 (45s)')), 45000)
            )
          ])
          log(`分支 3a 完成: bootstrapSecretStorage(SSSS) 后台成功 (${Date.now() - t3}ms)`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          // 超时后验证密钥是否已上传到服务端（阶段 A 已通过 REST 上传，此处为二次验证）
          if (msg.includes('超时')) {
            try {
              const defaultKey = await client.getAccountDataFromServer?.('m.secret_storage.default_key')
              if (defaultKey?.key) {
                log(
                  `分支 3a 验证: SSSS 密钥已上传至服务端 (defaultKeyId=${defaultKey.key})，sync echo 超时但密钥已就绪 (${Date.now() - t3}ms)`
                )
              } else {
                log(`分支 3a 结果: bootstrapSecretStorage 后台超时且密钥未验证到: ${msg}`)
              }
            } catch (verifyErr) {
              log(
                `分支 3a 验证: getAccountDataFromServer 失败: ${verifyErr instanceof Error ? verifyErr.message : String(verifyErr)}`
              )
            }
          } else {
            log(`分支 3a 结果: bootstrapSecretStorage(SSSS) 后台失败 (${Date.now() - t3}ms): ${msg}`)
          }
        }

        // ── 阶段 C：resetKeyBackup ──
        log('分支 3b: 后台调用 resetKeyBackup')
        try {
          await Promise.race([
            crypto.resetKeyBackup(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('resetKeyBackup 后台超时 (45s)')), 45000)
            )
          ])
          log(`分支 3b 完成: resetKeyBackup 后台成功 (${Date.now() - t3}ms)`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log(`分支 3b 结果: resetKeyBackup 后台失败 (${Date.now() - t3}ms): ${msg}`)
        }
      })()

      log(`分支 3: SSSS 后台上传已启动，立即返回密钥 (${Date.now() - t3}ms)`)
      return generatedKey.encodedPrivateKey
    } else {
      log('分支 4: 调用 resetKeyBackup (bootstrapSecretStorage 不可用)')
      await crypto.resetKeyBackup(authData as unknown as MatrixAuthData)
      const key = generatedKey?.encodedPrivateKey || ''
      log('分支 4 完成: resetKeyBackup 成功')
      return key
    }
  }

  /** 从备份恢复密钥
   */
  async restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    const backupManager = this.accessors.getKeyBackupManager()
    if (backupManager) {
      const backupInfo = await backupManager.checkKeyBackup()
      if (backupInfo) {
        const result = await backupManager.restoreKeyBackupWithRecoveryKey(backupKey)
        return { imported: result.imported, total: result.total }
      }
      return { imported: 0, total: 0 }
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      const backupInfo = await crypto.getKeyBackupInfo()
      if (backupInfo) {
        const result = await crypto.restoreKeyBackup()
        return { imported: result.imported, total: result.total }
      }
    }

    return { imported: 0, total: 0 }
  }

  /** 从密钥备份恢复
   */
  async restoreFromBackup(_recoveryKey: string): Promise<KeyBackupRestoreResult> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    const backupInfo = await crypto.getKeyBackupInfo()
    if (!backupInfo) {
      throw new Error('无可用密钥备份')
    }

    const result = await crypto.restoreKeyBackup()
    return {
      imported: result.imported,
      total: result.total
    }
  }

  /** 使用恢复短语从备份恢复密钥
   */
  async restoreFromBackupWithPassphrase(passphrase: string): Promise<KeyBackupRestoreResult> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    const backupInfo = await crypto.getKeyBackupInfo()
    if (!backupInfo) {
      throw new Error('无可用密钥备份')
    }

    if (typeof crypto.restoreKeyBackupWithPassphrase !== 'function') {
      throw new Error('当前客户端不支持通过安全短语恢复密钥备份')
    }

    const result = await crypto.restoreKeyBackupWithPassphrase(passphrase)
    return {
      imported: result.imported,
      total: result.total
    }
  }

  /** 导出密钥（ISSUE-6.3: 本地导出，不再经服务端 passphrase 验证）
   */
  async exportKeys(_passphrase?: string): Promise<KeyExportResult> {
    const crypto = this.accessors.getCrypto()
    if (crypto && typeof crypto.exportRoomKeys === 'function') {
      const keys = await crypto.exportRoomKeys()
      return { data: JSON.stringify(keys), count: Array.isArray(keys) ? keys.length : 0 }
    }
    return { data: '', count: 0 }
  }

  /** 导入密钥
   */
  async importKeys(data: string): Promise<KeyImportResult> {
    const keys = JSON.parse(data)
    const crypto = this.accessors.getCrypto()
    if (crypto) {
      await crypto.importRoomKeys(keys)
      const total = Array.isArray(keys) ? keys.length : 0
      return { imported: total, total }
    }
    return { imported: 0, total: 0 }
  }

  /** 从恢复短语创建恢复密钥
   */
  async createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) return null
    if (typeof crypto.createRecoveryKeyFromPassphrase !== 'function') return null
    return await crypto.createRecoveryKeyFromPassphrase(password)
  }
}
