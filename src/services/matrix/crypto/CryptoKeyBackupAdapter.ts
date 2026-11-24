/**
 * CryptoKeyBackupAdapter — key backup, restore, import/export operations.
 *
 * Extracted from CryptoSDKAdapter. Contains the complex setupKeyBackupWithOptions
 * flow (multi-branch with SSSS non-blocking upload and timeout protection).
 */

import type { MatrixClient } from 'matrix-js-sdk'
import type { CryptoApi, GeneratedSecretStorageKey, MatrixAuthData } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { safeRandomUUID } from '@/utils/webCompat'
import { matrixClientService } from '../MatrixClientService'
import { setSecretStorageKeyFromRecoveryKey } from '../secretStorageKeyVault'
import type {
  CryptoAdapterAccessors,
  KeyBackupRestoreResult,
  KeyBackupSetupResult,
  KeyExportResult,
  KeyImportResult
} from './cryptoAdapterTypes'
import { buildSsssKeyDescription, parseRoomKeysExport } from './ssssKeyDescription'

const logger = createLogger('CryptoKeyBackupAdapter')

/** setupKeyBackupWithOptions 并发锁：同一时间只允许一个 bootstrap 流程运行，防止并行 SSSS 上传 */
let setupInFlight: Promise<string> | null = null

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
  const keyId = safeRandomUUID().replace(/-/g, '')

  // 按规范从原始私钥本地计算 algorithm/iv/mac。
  // 重要：**不要**从 generatedKey.keyInfo 读取这三个字段——vendored SDK 的
  // GeneratedSecretStorageKey.keyInfo 只有 `{ passphrase?, name? }`，
  // 历史上正因为读了不存在的字段，本函数必然抛错并导致 SSSS 密钥从未上传。
  const keyInfo = await buildSsssKeyDescription(Uint8Array.from(generatedKey.privateKey), {
    passphrase: generatedKey.keyInfo?.passphrase
  })

  // 使用 setAccountDataRaw（底层 HTTP PUT，不等待 sync echo）直接上传。
  // SDK 的 setAccountData 会等待 ClientEvent.AccountData 回声（sliding sync 下可能 30s+），
  // 而 setAccountDataRaw 立即返回（仅 HTTP PUT 完成即 resolve）。
  const clientWithRaw = client as MatrixClient & {
    setAccountDataRaw?: (eventType: string, content: unknown) => Promise<unknown>
  }
  const uploadFn = clientWithRaw.setAccountDataRaw?.bind(client) ?? client.setAccountData?.bind(client)
  if (!uploadFn) {
    throw new Error('无法上传 SSSS 密钥：客户端不支持写入 account_data')
  }

  await uploadFn(`m.secret_storage.key.${keyId}`, keyInfo)
  logger.info(`[SSSS] 已通过 REST 上传密钥描述: m.secret_storage.key.${keyId}`)

  await uploadFn('m.secret_storage.default_key', { key: keyId })
  logger.info(`[SSSS] 已通过 REST 上传默认密钥 ID: ${keyId}`)

  return keyId
}

/** 密钥备份设置入参：字符串等价于 recoveryKey；对象形式带 password / authData / generatedKey。 */
type KeyBackupSetupInput =
  | string
  | {
      recoveryKey?: string
      password?: string
      authData?: MatrixAuthData
      generatedKey?: GeneratedSecretStorageKey | null
    }

/**
 * 带超时的 Promise 竞争。
 *
 * 与 `Promise.race([p, new Promise(...setTimeout...)])` 的区别：竞争结束后会清掉定时器。
 * 否则每次调用都会留下一个悬挂的 timer（在 vitest 里表现为「进程不退出」）。
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * 确保 sync 正在运行（`bootstrapSecretStorage` 依赖 AccountData 回声）。
 *
 * `startClient()` 是幂等的，但这里只在 STOPPED/ERROR 时调用，避免打断正在进行的同步。
 */
async function ensureSyncRunning(client: MatrixClient): Promise<void> {
  const syncState = client.getSyncState?.()
  if (syncState !== 'STOPPED' && syncState !== null && syncState !== 'ERROR') return

  client.startClient?.()
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const state = client.getSyncState?.()
    if (state === 'SYNCING' || state === 'PREPARED') return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

/**
 * 调用 `bootstrapSecretStorage` 完成 SDK 内部状态注册。
 *
 * 超时/失败**不等于**成功：必须再验证 `m.secret_storage.default_key` 确实落在服务端，
 * 否则抛错。历史实现把这段放在 fire-and-forget 里，导致「密钥没上传也报成功」。
 */
async function bootstrapSecretStorageVerified(
  crypto: CryptoApi,
  client: MatrixClient,
  generatedKey: GeneratedSecretStorageKey,
  log: (msg: string) => void
): Promise<void> {
  try {
    await withTimeout(
      crypto.bootstrapSecretStorage({
        createSecretStorageKey: async () => {
          log('分支 3B: createSecretStorageKey 被 SDK 调用')
          return generatedKey
        },
        setupNewSecretStorage: true,
        setupNewKeyBackup: false
      }),
      45_000,
      'bootstrapSecretStorage(SSSS) 超时 (45s)'
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 注意：可选链只保护「调用」，返回值仍可能是 undefined，不能直接接 .catch
    const pending = client.getAccountDataFromServer?.('m.secret_storage.default_key')
    const defaultKey = pending ? await pending.catch(() => null) : null
    if (!defaultKey?.key) {
      // 密钥没确认落到服务端 → 后续即便是「成功」也是假的，必须向上抛
      throw new Error(`SSSS 密钥未能确认落到服务端: ${msg}`)
    }
    log(`分支 3B: bootstrapSecretStorage 未正常结束（${msg}），但 default_key 已在服务端 (${defaultKey.key})`)
  }
}

export class CryptoKeyBackupAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

  /**
   * 备份密钥。
   *
   * 真实 `KeyBackupManager` **没有** `scheduleKeyBackupSend`（历史缺陷 F-14：无守卫调用
   * 导致运行时 `is not a function`）。备份调度在 SDK 内部由 backup engine 自动完成，
   * 这里只需确保存在可用备份版本——`ensureBackupVersion` 在缺失时创建，已存在时复用。
   */
  async backupKeys(): Promise<void> {
    const backupManager = this.accessors.getKeyBackupManager()
    if (backupManager) {
      if (typeof backupManager.ensureBackupVersion !== 'function') {
        throw new Error('当前客户端不支持创建密钥备份版本：KeyBackupManager 缺少 ensureBackupVersion')
      }
      const version = await backupManager.ensureBackupVersion()
      logger.info(`密钥备份版本已就绪: ${version}`)
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
      const recoveryKey = await this.setupKeyBackupWithOptions(passphrase ? { password: passphrase } : undefined)
      logger.info('密钥备份设置成功(客户端派生)')
      return { success: true, recoveryKey }
    } catch (err) {
      logger.error('密钥备份设置失败(客户端派生)', err)
      // 带上原因：UI 需要区分「用户取消 UIA」与「SSSS/备份版本没建起来」，
      // 后者若笼统报「失败」，用户会以为只是网络抖动而反复重试。
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** 设置密钥备份（recoveryKey / password / 生成的 key），受 `setupInFlight` 并发锁保护。 */
  async setupKeyBackupWithOptions(input?: KeyBackupSetupInput): Promise<string> {
    // 并发锁：如果已有 setup 流程在执行，复用其结果（防止并行 SSSS 上传）
    if (setupInFlight) {
      logger.warn('[CryptoKeyBackupAdapter] setupKeyBackupWithOptions 已有流程在执行，复用现有 Promise')
      return setupInFlight
    }

    const task = this._doSetupKeyBackup(input)
    setupInFlight = task
    // 用 then(clear, clear) 而不是 finally()：finally() 派生出的 Promise 在 task 拒绝时
    // 同样拒绝且无人处理，会产生 unhandled rejection（vitest 因此 exit 1）。
    // 调用方仍从 `return task` 拿到拒绝，setupKeyBackup 的 catch 行为不变。
    const clear = () => {
      if (setupInFlight === task) setupInFlight = null
    }
    task.then(clear, clear)
    return task
  }

  /** 实际执行密钥备份设置（内部方法，受 setupInFlight 锁保护） */
  private async _doSetupKeyBackup(input?: KeyBackupSetupInput): Promise<string> {
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
    const authData = typeof input === 'string' ? undefined : input?.authData

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
      // 修复策略（三阶段，全部 await —— 顺序即依赖关系）：
      //   阶段 A：直接通过 REST API 上传 SSSS 密钥到 account_data（绕过 SDK 的
      //   setDefaultKeyId 内部 sync echo 等待），确保密钥立即持久化到服务端。
      //   阶段 B：调用 bootstrapSecretStorage 完成 SDK 内部状态注册（它会检测到
      //   密钥已存在而跳过重复上传，但仍需等待 sync echo）；超时则二次验证
      //   default_key 是否真的在服务端，验证不到即抛错。
      //   阶段 C：resetKeyBackup 建立备份版本——**必须成功**，否则恢复密钥毫无意义。
      log('分支 3: 顺序执行 SSSS 上传 → bootstrapSecretStorage → resetKeyBackup（全部 await）')
      const t3 = Date.now()

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('无法设置密钥备份：客户端不可用')
      }

      // ── 阶段 A：直接 REST 上传 SSSS 密钥（不依赖 sync echo）──
      // 不再「失败后兜底继续」：密钥没落到服务端就不能把恢复密钥交给用户。
      await uploadSsssKeyDirectly(client, generatedKey)
      log(`分支 3A 完成: SSSS 密钥已通过 REST 直接上传 (${Date.now() - t3}ms)`)

      // ── 阶段 B：bootstrapSecretStorage 完成 SDK 内部状态注册 ──
      // 超时后仍会二次验证 default_key 是否在服务端；验证不到就抛错。
      await ensureSyncRunning(client)
      await bootstrapSecretStorageVerified(crypto, client, generatedKey, log)
      log(`分支 3B 完成 (${Date.now() - t3}ms)`)

      // ── 阶段 C：resetKeyBackup —— 备份版本必须真的建起来才允许报成功 ──
      // 历史缺陷（P0-②）：这里原本是 fire-and-forget，UI 拿到恢复密钥就提示成功，
      // 而服务端可能压根没有备份版本。用户以为有备份，真丢设备时就是永久丢失。
      await withTimeout(crypto.resetKeyBackup(), 45_000, 'resetKeyBackup 超时 (45s)')
      log(`分支 3C 完成: 备份版本已建立 (${Date.now() - t3}ms)`)

      if (!generatedKey.encodedPrivateKey) {
        throw new Error('无法展示恢复密钥：SDK 未返回 encodedPrivateKey')
      }
      return generatedKey.encodedPrivateKey
    } else {
      log('分支 4: 调用 resetKeyBackup (bootstrapSecretStorage 不可用)')
      await crypto.resetKeyBackup(authData)
      const key = generatedKey?.encodedPrivateKey || ''
      log('分支 4 完成: resetKeyBackup 成功')
      return key
    }
  }

  /** 从备份恢复密钥
   */
  async restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    // 与 restoreFromBackup 共用同一正确机制。
    // 历史缺陷（F-13）：此处无守卫调用 `backupManager.restoreKeyBackupWithRecoveryKey(key)`，
    // 该方法在真实 KeyBackupManager 上不存在（运行时报 is not a function），
    // 且语义错误——SSSS 恢复密钥不是 room key，不能交给备份管理器直接导入。
    return this.restoreFromBackup(backupKey)
  }

  /**
   * 用恢复密钥从服务端备份恢复房间密钥。
   *
   * 恢复密钥**只在本机使用**：写入内存保险箱后由 SDK 从 SSSS 取出备份解密密钥，
   * 再执行恢复。绝不把恢复密钥包装成 room key 上送服务端。
   *
   * @param recoveryKey 用户输入的恢复密钥
   * @throws 恢复密钥格式非法、账号无 SSSS 密钥、或本机不支持从 SSSS 取密钥
   */
  async restoreFromBackup(recoveryKey: string): Promise<KeyBackupRestoreResult> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    if (typeof crypto.loadSessionBackupPrivateKeyFromSecretStorage !== 'function') {
      throw new Error('当前客户端不支持通过恢复密钥恢复密钥备份')
    }

    if (typeof crypto.getSecretStorageStatus !== 'function') {
      throw new Error('当前客户端不支持读取安全备份密钥状态')
    }

    const backupInfo = await crypto.getKeyBackupInfo()
    if (!backupInfo) {
      throw new Error('无可用密钥备份')
    }

    // 1. 把恢复密钥放进内存保险箱（非法密钥在此抛错，不会触碰任何恢复接口）
    const status = await crypto.getSecretStorageStatus()
    const keyId = status?.defaultKeyId
    if (!keyId) {
      throw new Error('账号未配置安全备份密钥，无法使用恢复密钥')
    }
    setSecretStorageKeyFromRecoveryKey(recoveryKey, { [keyId]: {} })

    // 2. 由 SDK 从 SSSS 解出备份解密密钥并存进 crypto store
    await crypto.loadSessionBackupPrivateKeyFromSecretStorage()

    // 3. 用已就位的密钥恢复备份
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

  /** 导入密钥（解析失败或结构不符时显式报错，避免「导入 0 条」被当成成功） */
  async importKeys(data: string): Promise<KeyImportResult> {
    const keys = parseRoomKeysExport(data)
    const crypto = this.accessors.getCrypto()
    if (crypto) {
      await crypto.importRoomKeys(keys)
      return { imported: keys.length, total: keys.length }
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
