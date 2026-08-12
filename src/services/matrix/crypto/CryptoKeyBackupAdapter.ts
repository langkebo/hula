/**
 * CryptoKeyBackupAdapter — key backup, restore, import/export operations.
 *
 * Extracted from CryptoSDKAdapter. Contains the complex setupKeyBackupWithOptions
 * flow (multi-branch with SSSS non-blocking upload and timeout protection).
 */

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

export class CryptoKeyBackupAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

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

  async setupKeyBackup(passphrase: string): Promise<KeyBackupSetupResult> {
    const secureBackupManager = this.accessors.getSecureBackupManager()
    if (secureBackupManager) {
      await secureBackupManager.createSecureBackup(passphrase)
      logger.info('安全密钥备份设置成功(passphrase加密)')
      return { success: true }
    }

    const backupManager = this.accessors.getKeyBackupManager()
    if (backupManager) {
      const backupInfo = await backupManager.checkKeyBackup()
      if (!backupInfo) {
        const keyInfo = await backupManager.prepareKeyBackupVersion()
        await backupManager.createKeyBackupVersion({
          algorithm: keyInfo.algorithm,
          auth_data: keyInfo.auth_data
        })
      }
      backupManager.scheduleKeyBackupSend()
      logger.info('密钥备份设置成功')
      return { success: true }
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        await crypto.resetKeyBackup()
      }
      logger.info('密钥备份设置成功(基础)')
      return { success: true }
    }

    return { success: false }
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
      // 根因：bootstrapSecretStorage 内部 setDefaultKeyId 上传 account_data 后
      // 等待 /sync 回送 AccountData 事件才 resolve。若 sync 循环未运行则永久挂起。
      // 修复：确保 sync 正在运行后再调用 bootstrapSecretStorage。
      log('分支 3: SSSS 上传改为非阻塞（后台执行），立即返回密钥')
      const t3 = Date.now()

      void (async () => {
        // 确保 sync 循环正在运行，否则 setDefaultKeyId 等待 AccountData 事件会永久挂起
        const client = matrixClientService.getClient()
        const syncState = client?.getSyncState?.()
        if (syncState === 'STOPPED' || syncState === null || syncState === 'ERROR') {
          log(`分支 3 前置: sync 未运行 (state=${syncState})，调用 startClient() 启动 sync`)
          try {
            client?.startClient()
            // 等待 sync 开始运行（最多 5s）
            await new Promise<void>((resolve) => {
              const deadline = Date.now() + 5000
              const check = () => {
                const state = client?.getSyncState?.()
                if (state === 'SYNCING' || state === 'PREPARED' || Date.now() > deadline) {
                  resolve()
                } else {
                  setTimeout(check, 200)
                }
              }
              check()
            })
            log(`分支 3 前置: sync 已启动 (state=${client?.getSyncState?.()})`)
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
              setTimeout(() => reject(new Error('bootstrapSecretStorage(SSSS) 后台超时 (15s)')), 15000)
            )
          ])
          log(`分支 3a 完成: bootstrapSecretStorage(SSSS) 后台成功 (${Date.now() - t3}ms)`)

          log('分支 3b: 后台调用 resetKeyBackup')
          try {
            await Promise.race([
              crypto.resetKeyBackup(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('resetKeyBackup 后台超时 (15s)')), 15000)
              )
            ])
            log(`分支 3b 完成: resetKeyBackup 后台成功 (${Date.now() - t3}ms)`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log(`分支 3b 结果: resetKeyBackup 后台失败 (${Date.now() - t3}ms): ${msg}`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log(`分支 3a 结果: bootstrapSecretStorage(SSSS) 后台失败 (${Date.now() - t3}ms): ${msg}`)
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

  async restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    const secureBackupManager = this.accessors.getSecureBackupManager()
    if (secureBackupManager) {
      const versions = await this.accessors.getSDKKeyBackupManager()?.getBackupVersions()
      if (versions?.versions?.length) {
        const result = await secureBackupManager.restoreFromSecureBackup(versions.versions[0].version, backupKey)
        return { imported: result.recovered_keys, total: result.total_keys }
      }
    }

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

  async exportKeys(passphrase?: string): Promise<KeyExportResult> {
    const secureBackupManager = this.accessors.getSecureBackupManager()
    if (secureBackupManager && passphrase) {
      const sdkManager = this.accessors.getSDKKeyBackupManager()
      if (sdkManager) {
        const versions = await sdkManager.getBackupVersions()
        if (versions.versions.length > 0) {
          const verifyResult = await secureBackupManager.verifySecureBackup(versions.versions[0].version, passphrase)
          if (!verifyResult.valid) {
            throw new Error('密码验证失败')
          }
        }
      }
    }

    const crypto = this.accessors.getCrypto()
    if (crypto && typeof crypto.exportRoomKeys === 'function') {
      const keys = await crypto.exportRoomKeys()
      return { data: JSON.stringify(keys), count: Array.isArray(keys) ? keys.length : 0 }
    }
    return { data: '', count: 0 }
  }

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

  async createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) return null
    if (typeof crypto.createRecoveryKeyFromPassphrase !== 'function') return null
    return await crypto.createRecoveryKeyFromPassphrase(password)
  }
}
