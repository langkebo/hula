/**
 * MatrixCryptoStateTracker — Crypto 调试状态追踪深模块
 *
 * 职责：
 * - 初始化 Rust Crypto（含 IndexedDB 清理重试逻辑）
 * - 追踪 rustCryptoDebugState（attempted/initialized/skippedReason/error/usedIndexedDB）
 * - 追踪 eventDecryptedDebugState（count/lastEventId/lastRoomId/lastError）
 *
 * 不负责：
 * - 连接状态管理（由 ConnectionManager 负责）
 * - 事件路由（由 MatrixEventRouter 负责）
 *
 * @see codebase-design — 深模块：ensureCrypto/handleEventDecrypted/getDebugState 小接口 +
 * IndexedDB 清理重试 + crypto 状态机复杂实现
 */
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { replayPersistedStrictness } from '@/services/matrix/crypto/strictDevicePolicyReplay'
import { getOrCreateCryptoStorageKey, logCryptoStorageKeyBackend } from '@/services/secure/cryptoStorageKey'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixCrypto')

export interface RustCryptoDebugState {
  attempted: boolean
  initialized: boolean
  skippedReason: string | null
  error: string | null
  usedIndexedDB: boolean | null
  /**
   * crypto store 是否以加密方式打开。
   *
   * `true` = 提供了 32 字节 storageKey；`false` = keychain 不可用，store 未加密
   * （私钥与房间密钥将以明文落盘）；`null` = 未尝试。
   *
   * 之所以要显式暴露：SDK 只对「未加密的**内存** store」默认拒绝，
   * 未加密的 **IndexedDB** store 是被静默允许的 —— 若不把它暴露出来，
   * 生产环境的密钥库降级将没有任何可观测信号。
   */
  storeEncrypted: boolean | null
}

export interface EventDecryptedDebugState {
  count: number
  lastEventId: string | null
  lastRoomId: string | null
  lastError: string | null
}

/**
 * 本文件对 `initRustCrypto` 的最小依赖面。
 *
 * 必须与 SDK 契约一致（`matrix-js-sdk/lib/client.d.ts` 的 `initRustCrypto(args?)`）：
 * 历史缺陷是本类型只声明了 `{ useIndexedDB, storagePassword }`，于是**结构上**
 * 无法传入被 SDK 文档首推的 `storageKey`，把"用慢 KDF 处理随机密钥"变成了唯一选项。
 */
type RustCryptoCapableClient = MatrixClient & {
  getCrypto?: () => unknown
  initRustCrypto?: (args?: {
    useIndexedDB?: boolean
    cryptoDatabasePrefix?: string
    storageKey?: Uint8Array
    storagePassword?: string
    allowInMemoryStore?: boolean
  }) => Promise<void>
}

/**
 * ensureCrypto 跨窗口互斥锁名称（Web Locks）。
 *
 * 背景：Tauri 多窗口架构中，每个 WebView 窗口有独立的 globalThis 和模块实例，
 * 导致 globalThis 级 mutex 无法跨窗口工作。而同源 IndexedDB 是**共享**的
 * （crypto store 的 DB 名固定为 `matrix-js-sdk::matrix-sdk-crypto` 等 3 个），
 * 多个窗口并发 `initRustCrypto` 会争抢同一组 DB，第二个可能卡到 8s 超时。
 *
 * 语义（2026-10-13 取证后订正，勿回退）：
 * - 本锁**只负责串行化** —— 让各窗口的 initRustCrypto 依次进行。
 * - ⚠️ 这里**没有**、也**不可能有**「其他窗口已初始化 ⇒ 本窗口跳过」的语义：
 *   每个 WebView 的 client 实例是独立的，`getCrypto()` 看不到别窗口的 crypto（恒 undefined）；
 *   且每个窗口都**必须**有自己的 OlmMachine 才能解密。历史上曾用 BroadcastChannel
 *   （`tjg-crypto-init`）实现该"跳过"，实测恒不可达（死代码），已删除。
 * - Web Locks 是浏览器原生提供的跨标签/窗口锁机制，同源所有窗口共享。
 *   Tauri macOS WKWebView（Safari 16.4+）支持此 API。
 */
const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'

/**
 * 检测 Web Locks API 是否可用。
 * 测试环境（Node.js/vitest）和旧浏览器可能不支持，需要 fallback。
 */
function isWebLocksAvailable(): boolean {
  return typeof navigator !== 'undefined' && navigator.locks != null && typeof navigator.locks.request === 'function'
}

/**
 * Crypto 状态追踪器
 *
 * 深模块：小接口（ensureCrypto/handleEventDecrypted/getState）+ 大实现
 * （Rust Crypto 初始化、IndexedDB 清理重试、账户不匹配处理、状态追踪）
 */
export class MatrixCryptoStateTracker {
  private rustCryptoDebugState: RustCryptoDebugState = {
    attempted: false,
    initialized: false,
    skippedReason: null,
    error: null,
    usedIndexedDB: null,
    storeEncrypted: null
  }

  private eventDecryptedDebugState: EventDecryptedDebugState = {
    count: 0,
    lastEventId: null,
    lastRoomId: null,
    lastError: null
  }

  /**
   * 初始化 Rust Crypto
   *
   * 隐藏的复杂实现：
   * - 检查 crypto 是否已可用（getCrypto()）
   * - 检查 initRustCrypto 方法是否存在
   * - 检查 userId/deviceId 是否完整
   * - IndexedDB 可用性检测
   * - 账户不匹配时清除旧 crypto store 后重试
   * - 全程更新 rustCryptoDebugState
   *
   * @param client MatrixClient 实例
   * @param hasAccessToken 是否有 access token（无 token 则跳过）
   */
  async ensureCrypto(client: MatrixClient | null, hasAccessToken: boolean): Promise<void> {
    if (!client || !hasAccessToken) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-client-or-access-token',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      return
    }

    const cryptoClient = client as RustCryptoCapableClient

    if (typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()) {
      // 唯一的"已可用即不重复初始化"判据：只看**本窗口本 client** 是否已就绪。
      // 这是重复调用 ensureCrypto（同一 client）的真实护栏；跨窗口不适用（也做不到）。
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: true,
        skippedReason: 'crypto-already-available',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      // R-1：crypto 已可用 ⇒ 立刻重放用户的严格模式决定（该偏好不随 client 持久化）
      this.applyPersistedStrictness()
      return
    }

    if (typeof cryptoClient.initRustCrypto !== 'function') {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'init-method-unavailable',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      return
    }

    const ENSURE_CRYPTO_TIMEOUT_MS = 8_000

    if (isWebLocksAvailable()) {
      // Web Locks 只做**串行化**：等别窗口释放锁，再执行本窗口自己的 initRustCrypto。
      // 不再有「其他窗口已完成 ⇒ 本窗口跳过」的判断（恒不可达，取证见 CRYPTO_LOCK_NAME 注释）；
      // 也不再有锁内复查 —— 同 client 重入由方法开头的 getCrypto() 早退 + startClient 的
      // IdempotencyGuard 覆盖，锁内复查只能看到本窗口这一个 client，等于重复判断。
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ENSURE_CRYPTO_TIMEOUT_MS)

      try {
        await navigator.locks.request(CRYPTO_LOCK_NAME, { mode: 'exclusive', signal: controller.signal }, async () => {
          logger.info('获取到 crypto 锁，开始初始化 Rust Crypto')
          await this.doEnsureCrypto(cryptoClient)
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          logger.warn(
            `ensureCrypto 超过 ${ENSURE_CRYPTO_TIMEOUT_MS}ms 未完成（等待其他窗口释放锁），转为后台继续（不阻塞 sync 启动）`
          )
          // 后台重新排队等锁（不超时）：锁释放后本窗口继续完成**自己的**初始化。
          navigator.locks
            .request(CRYPTO_LOCK_NAME, { mode: 'exclusive' }, async () => {
              logger.info('后台获取到 crypto 锁，开始初始化 Rust Crypto')
              await this.doEnsureCrypto(cryptoClient)
            })
            .catch((e: unknown) => logger.warn(`后台 ensureCrypto 失败: ${normalizeCryptoError(e)}`))
        } else {
          throw err
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } else {
      // Fallback：无 Web Locks API（测试环境/旧浏览器），使用 Promise.race 超时
      const cryptoTask = this.doEnsureCrypto(cryptoClient)
      const timeoutTask = new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn(`ensureCrypto 超过 ${ENSURE_CRYPTO_TIMEOUT_MS}ms 未完成，转为后台继续（不阻塞 sync 启动）`)
          resolve()
        }, ENSURE_CRYPTO_TIMEOUT_MS)
      })
      await Promise.race([cryptoTask, timeoutTask])
    }

    // R-1：初始化路径走完后重放用户的严格模式决定。crypto 若仍未就绪，
    // `reapplyPersistedStrictness` 内部会计为"暂不可应用"且不抛错 ——
    // 房间内横幅（`useRoomStrictness`）在进入加密房间时还会再施加一次。
    await this.applyPersistedStrictness()
  }

  /**
   * 重放持久化的「严格模式」偏好（R-1）。**尽力而为**：任何失败都不得影响 crypto 初始化
   * 本身的结论。实现放在 `strictDevicePolicyReplay`（那里用动态 import 规避模块环，勿内联）。
   */
  private async applyPersistedStrictness(): Promise<void> {
    await replayPersistedStrictness()
  }

  /**
   * ensureCrypto 的实际实现，被外层 ensureCrypto 用 Promise.race 包装超时。
   * 超时后此任务仍会在后台继续执行（fire-and-forget），最终更新 rustCryptoDebugState。
   */
  private async doEnsureCrypto(cryptoClient: RustCryptoCapableClient): Promise<void> {
    // 本方法**不做任何跨窗口判定**：既不等别窗口、也不因别窗口已完成而跳过。
    // 理由见 CRYPTO_LOCK_NAME 注释（每窗口独立 OlmMachine；本窗口 getCrypto() 看不到别窗口）。
    // 跨窗口只由外层 Web Locks 串行化。
    const userId = cryptoClient.getUserId?.()
    const deviceId = cryptoClient.getDeviceId?.()
    if (!userId || !deviceId) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-user-or-device-id',
        error: null,
        usedIndexedDB: null,
        storeEncrypted: null
      }
      logger.warn('缺少 userId 或 deviceId，跳过 Rust Crypto 初始化')
      return
    }

    const useIndexedDB = typeof globalThis.indexedDB !== 'undefined'

    // H1 修复：检查 userId:deviceId 是否变化，变化时主动清理旧 crypto store
    // 原 BUG：localStorage 仅存储 userId，同一用户换设备登录时
    // lastCryptoUser === userId 为 true，主动清理未触发，
    // 导致 initRustCrypto 报 "account in the store doesn't match" 错误，
    // 登录耗时 51s（crypto 重试循环 + 超时等待）。
    // 修复：localStorage 改为存储 userId:deviceId，换设备时触发清理。
    const cryptoUserKey = `${userId}:${deviceId}`
    const lastCryptoUser = this.readLastCryptoUser()

    // ISSUE-08 对接：从系统 keychain 取 **32 字节 storageKey**，加密 IndexedDB crypto store
    // 和待发事件队列（PendingEventsCipher）。keychain 不可用时降级为不加密（dev/浏览器）。
    //
    // 加密原语标记（2026-10-12 迁移，见 cryptoStorageKey.ts）：
    //   `k1` = storageKey（32 字节原始密钥，SDK 文档首推）
    //   `p1` / `1` / `0` = 历史标记（`storagePassword` 或"无密钥"）
    // 两类原语派生出的**实际加密密钥不同** ⇒ 只比较"是否加密"发现不了原语切换，
    // 会把"密钥换了却继续打开旧 store"推迟到 initRustCrypto 失败才发现。故把原语编进标记。
    const storageKey = await getOrCreateCryptoStorageKey(userId, deviceId)
    const storeEncrypted = storageKey !== null
    const currentEncrypted = storeEncrypted ? 'k1' : '0'
    const lastEncrypted = this.readLastCryptoEncrypted()

    // 提前清理：以下情况在 initRustCrypto 之前清理旧 store，避免第一次失败+重试耗时
    // 1. userId:deviceId 变化（换设备登录）
    // 2. 加密状态 / 加密原语变化（上次不加密→这次加密、或 storageKey↔storagePassword 切换）
    //    常见场景：macOS dev 模式 keychain 不稳定，上次 keychain 不可用（不加密），
    //    这次 keychain 可用（有密钥），用新密钥打开旧不加密 store 会报
    //    "An object failed to be decrypted while unpickling"
    const userChanged = lastCryptoUser !== cryptoUserKey
    const encryptedChanged =
      lastCryptoUser === cryptoUserKey && lastEncrypted !== null && lastEncrypted !== currentEncrypted
    if (useIndexedDB && (userChanged || encryptedChanged)) {
      const reason = userChanged
        ? `用户/设备变化（${lastCryptoUser} → ${cryptoUserKey}）`
        : `加密状态/原语变化（${lastEncrypted} → ${currentEncrypted}）`
      logger.info(`检测到 crypto ${reason}，提前清理旧 crypto store 避免 initRustCrypto 失败`)
      await clearStaleCryptoStores(userId)
    }
    if (userChanged || encryptedChanged || lastEncrypted === null) {
      this.writeLastCryptoUser(cryptoUserKey)
      this.writeLastCryptoEncrypted(currentEncrypted)
    }

    if (storeEncrypted) {
      await logCryptoStorageKeyBackend(userId, deviceId)
    } else {
      // 不静默降级：未加密的 IndexedDB store 会把**设备私钥与房间密钥以明文落盘**。
      // SDK 的 ISSUE-08b 默认拒绝只覆盖"未加密的**内存** store"，
      // 不会拒绝"未加密的 IndexedDB store"（见 client.d.ts JSDoc）。
      logger.error(`未获取到 crypto storageKey，crypto store 将不加密（私钥/房间密钥明文落盘）: ${userId}/${deviceId}`)
    }

    this.rustCryptoDebugState = {
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: useIndexedDB,
      storeEncrypted: storeEncrypted
    }

    try {
      await cryptoClient.initRustCrypto(storageKey ? { useIndexedDB, storageKey } : { useIndexedDB })
      this.rustCryptoDebugState = {
        attempted: true,
        initialized: true,
        skippedReason: null,
        error: null,
        usedIndexedDB: useIndexedDB,
        storeEncrypted: storeEncrypted
      }
      logger.info(`Rust Crypto 初始化完成: ${userId}/${deviceId}`)
    } catch (err) {
      const errMsg = normalizeCryptoError(err)
      // WASM 抛出的错误通常是空对象 {}（wasm-bindgen 转换），
      // String({}) = "[object Object]" 无法匹配具体错误字符串，
      // 因此 initRustCrypto 失败且 IndexedDB 可用时，无条件清理旧 store 后重试一次。
      // 常见触发场景：
      //   - "account in the store doesn't match"（换设备登录，旧 store 残留）
      //   - "An object failed to be decrypted while unpickling"（storageKey 跨会话不一致）
      //   - store 损坏 / 版本不兼容
      if (useIndexedDB) {
        logger.warn(`Rust Crypto 初始化失败（${errMsg}），尝试清除旧 crypto 数据后重试...`)
        try {
          const cleanupResult = await clearStaleCryptoStores(userId)
          // 等待浏览器释放 IndexedDB 连接句柄，避免重试时数据库仍被占用。
          // 如果有数据库删除失败/超时（通常是 meta 被 SDK 持有），
          // 延长等待时间到 1s，给 WASM 释放连接更多时间。
          const waitMs = cleanupResult.failed > 0 || cleanupResult.blocked > 0 ? 1_000 : 100
          if (waitMs > 100) {
            logger.warn(
              `IndexedDB 清理部分失败 (failed=${cleanupResult.failed}, blocked=${cleanupResult.blocked})，等待 ${waitMs}ms 后重试`
            )
          }
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          await cryptoClient.initRustCrypto(storageKey ? { useIndexedDB, storageKey } : { useIndexedDB })
          this.rustCryptoDebugState = {
            attempted: true,
            initialized: true,
            skippedReason: null,
            error: null,
            usedIndexedDB: useIndexedDB,
            storeEncrypted: storeEncrypted
          }
          logger.info(`Rust Crypto 重试初始化完成: ${userId}/${deviceId}`)
          return
        } catch (retryErr) {
          const retryMsg = normalizeCryptoError(retryErr)
          this.rustCryptoDebugState = {
            attempted: true,
            initialized: false,
            skippedReason: null,
            error: retryMsg,
            usedIndexedDB: useIndexedDB,
            storeEncrypted: storeEncrypted
          }
          logger.warn(`Rust Crypto 重试仍失败，继续以非加密模式启动: ${retryMsg}`)
          return
        }
      }
      this.rustCryptoDebugState = {
        attempted: true,
        initialized: false,
        skippedReason: null,
        error: errMsg,
        usedIndexedDB: useIndexedDB,
        storeEncrypted: storeEncrypted
      }
      logger.warn(`Rust Crypto 初始化失败，继续以非加密模式启动: ${errMsg}`)
    }
  }

  /**
   * 处理 Event.decrypted 事件
   *
   * 更新 eventDecryptedDebugState（count/lastEventId/lastRoomId/lastError）
   */
  handleEventDecrypted(event: MatrixEvent, err?: Error): void {
    const roomId = event.getRoomId()
    this.eventDecryptedDebugState = {
      count: this.eventDecryptedDebugState.count + 1,
      lastEventId: event.getId() ?? null,
      lastRoomId: roomId ?? null,
      lastError: err?.message ?? null
    }
  }

  /** 获取 Rust Crypto 调试状态
   */
  getRustCryptoDebugState(): RustCryptoDebugState {
    return { ...this.rustCryptoDebugState }
  }

  /** 获取事件解密调试状态
   */
  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return { ...this.eventDecryptedDebugState }
  }

  /**
   * 解除「已停止的 crypto 绑定」，使**同一个 client** 能重新 `initRustCrypto`。
   *
   * 只在「复用同一 client 重启 sync」的路径上需要（当前唯一调用点：
   * `MatrixClientLifecycle.forceReconnect`，系统唤醒时触发）。
   *
   * SDK 契约（实测 fork `40.2.0-langkebo.6`，不要凭上游印象改：
   * - `client.stopClient()` → `stopClientLifecycleServices()` → `client.cryptoBackend.stop()`
   *   → `RustCrypto.stop()`：置 `stopped = true`、停各 manager，并 `olmMachine.close()`
   *   —— **IndexedDB 连接随之关闭**（这正是 login→home 交接能安全让出共享 store 的原因）；
   * - 但 stopClient **不清空** `client.cryptoBackend`，而 `client.initRustCrypto()` 见到
   *   `cryptoBackend` 非空就 `warn("Attempt to re-initialise e2e encryption")` 并 return；
   * - `client-lifecycle-start`（start 侧）**不会**替调用方恢复 crypto；`getCrypto()` 只是
   *   返回 `cryptoBackend`，因此停止后仍是真值 ⇒ `ensureCrypto` 会误判"已可用"而早退。
   *
   * 后果（未解除时）：系统唤醒 → forceReconnect → crypto 永久失效，静默解不开新消息。
   *
   * ⚠️ 只应在 `client.stopClient()` **之后**调用。若 crypto 仍在运行（`stopped !== true`），
   * 本方法拒绝解除并告警 —— 否则会让活着的 OlmMachine / IndexedDB 连接泄漏。
   *
   * @returns 是否真的解除了绑定（便于调用方观测与测试）
   */
  releaseStoppedCryptoBinding(client: MatrixClient | null): boolean {
    if (!client) return false

    const candidate = client as { cryptoBackend?: unknown; getCrypto?: () => unknown }
    const existing = typeof candidate.getCrypto === 'function' ? candidate.getCrypto() : undefined
    if (!existing) return false

    if ((existing as { stopped?: boolean }).stopped !== true) {
      logger.warn(
        'releaseStoppedCryptoBinding 在 crypto 未处于已停止状态时被调用，已跳过（只应在 stopClient 之后调用）'
      )
      return false
    }

    candidate.cryptoBackend = undefined
    logger.info('已解除已停止的 crypto 绑定，允许同一 client 重新 initRustCrypto')
    return true
  }

  /** 重置加密状态追踪器
   */
  resetState(): void {
    this.rustCryptoDebugState = {
      attempted: false,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: null,
      storeEncrypted: null
    }
    this.eventDecryptedDebugState = {
      count: 0,
      lastEventId: null,
      lastRoomId: null,
      lastError: null
    }
  }

  /**
   * 登出时清除 crypto store 记录。
   *
   * 清除 localStorage 中的 lastCryptoUserId 记录，
   * 并删除该用户的 crypto IndexedDB 数据库，确保下次登录时从干净状态开始。
   *
   * @param userId 登出用户的 userId
   */
  async clearCryptoStoreForLogout(userId: string): Promise<void> {
    this.clearLastCryptoUser()
    if (typeof globalThis.indexedDB !== 'undefined') {
      try {
        const result = await clearStaleCryptoStores(userId)
        if (result.failed > 0 || result.blocked > 0) {
          logger.warn(
            `登出清理部分失败: ${userId} (已删除=${result.deleted}, 失败=${result.failed}, 被阻塞=${result.blocked})`
          )
        } else {
          logger.info(`登出清理完成: ${userId} (已删除 ${result.deleted} 个数据库)`)
        }
      } catch (err) {
        logger.error(`登出清理 IndexedDB 异常: ${userId}`, err)
      }
    } else {
      logger.info(`登出清理完成（无 IndexedDB）: ${userId}`)
    }
  }

  /** 读取 localStorage 中的 lastCryptoUserId 记录 */
  private readLastCryptoUser(): string | null {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage.getItem('tjg.lastCryptoUserId')
  }

  /** 写入 localStorage 中的 lastCryptoUserId 记录 */
  private writeLastCryptoUser(value: string): void {
    if (typeof globalThis.localStorage === 'undefined') return
    globalThis.localStorage.setItem('tjg.lastCryptoUserId', value)
  }

  /**
   * 读取上次的「加密状态 + 加密原语」标记。
   *
   * @returns `'k1'` = storageKey（32 字节）；`'p1'` / `'1'` = 历史 storagePassword；
   *   `'0'` = 无密钥（store 未加密）；`null` = 首次运行
   */
  private readLastCryptoEncrypted(): string | null {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage.getItem('tjg.lastCryptoEncrypted')
  }

  /** 写入「加密状态 + 加密原语」标记（取值见 {@link readLastCryptoEncrypted}） */
  private writeLastCryptoEncrypted(value: string): void {
    if (typeof globalThis.localStorage === 'undefined') return
    globalThis.localStorage.setItem('tjg.lastCryptoEncrypted', value)
  }

  /** 清除 localStorage 中的 lastCryptoUserId 和加密状态记录 */
  private clearLastCryptoUser(): void {
    if (typeof globalThis.localStorage === 'undefined') return
    globalThis.localStorage.removeItem('tjg.lastCryptoUserId')
    globalThis.localStorage.removeItem('tjg.lastCryptoEncrypted')
  }
}

/**
 * 将 crypto 初始化抛出的错误对象归一化为字符串消息。
 *
 * 背景：WASM（@matrix-org/matrix-sdk-crypto-wasm）在 OlmMachine.initFromStore 或
 * StoreHandle.open 失败时，通过 wasm-bindgen 抛出的错误往往是**空对象 `{}`**，
 * 既不是 Error 实例，也没有 message 属性。直接 `String({})` 会得到 `"[object Object]"`，
 * 无法用于匹配具体的错误字符串（如 "account mismatch"）。
 *
 * 归一化策略：
 *   - Error 实例 → err.message
 *   - 非空对象 → JSON.stringify，失败则回退 String
 *   - 其他基本类型 → String(err)
 *
 * @param err catch 块捕获到的错误对象
 * @returns 可读的错误消息字符串（可能为空字符串）
 */
function normalizeCryptoError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'object' && err !== null) {
    // 优先 JSON.stringify（可捕获空对象 {}、含字段的普通对象）
    try {
      const json = JSON.stringify(err)
      // JSON.stringify({}) === "{}" 等空结构，仍返回以便上层匹配
      return json && json !== '{}' ? json : '[empty-object]'
    } catch {
      return String(err)
    }
  }
  return String(err)
}

/**
 * 清除 Matrix crypto 使用的 IndexedDB 数据库。
 *
 * Rust crypto 使用两个数据库（见 SDK client-store-cleanup.ts）：
 *   - matrix-js-sdk::matrix-sdk-crypto
 *   - matrix-js-sdk::matrix-sdk-crypto-meta
 * Legacy crypto store 使用：
 *   - matrix-js-sdk:crypto
 *
 * 这些名称是固定的，不包含 userId 后缀。直接按名称删除，
 * 不依赖 indexedDB.databases()（Safari/WKWebView 不支持该 API）。
 *
 * @returns 删除结果统计 { deleted, failed, blocked }
 */
async function clearStaleCryptoStores(_userId: string): Promise<{ deleted: number; failed: number; blocked: number }> {
  if (typeof globalThis.indexedDB === 'undefined') return { deleted: 0, failed: 0, blocked: 0 }
  const dbNames = ['matrix-js-sdk::matrix-sdk-crypto', 'matrix-js-sdk::matrix-sdk-crypto-meta', 'matrix-js-sdk:crypto']
  const results = await Promise.all(dbNames.map((dbName) => deleteCryptoDbWithRetry(dbName)))
  return {
    deleted: results.filter((r) => r === 'deleted').length,
    failed: results.filter((r) => r === 'failed').length,
    blocked: results.filter((r) => r === 'blocked').length
  }
}

/**
 * 删除单个 IndexedDB 数据库，onblocked 时等待 300ms 后重试一次。
 *
 * 超时保护：2s 内无结果则 resolve('failed')，避免某些 WebView 环境下
 * deleteDatabase 对不存在的数据库既不触发 onsuccess 也不触发 onerror，
 * 导致 Promise 永久 pending 卡住 clearStaleCryptoStores → ensureCrypto。
 *
 * @returns 'deleted' | 'failed' | 'blocked'
 */
function deleteCryptoDbWithRetry(dbName: string): Promise<'deleted' | 'failed' | 'blocked'> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: 'deleted' | 'failed' | 'blocked') => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      resolve(result)
    }

    logger.info(`删除 IndexedDB: ${dbName}`)
    const req = globalThis.indexedDB.deleteDatabase(dbName)
    req.onsuccess = () => {
      logger.info(`已删除 IndexedDB: ${dbName}`)
      finish('deleted')
    }
    req.onerror = () => {
      logger.warn(`删除 IndexedDB 失败: ${dbName}`)
      finish('failed')
    }
    req.onblocked = () => {
      logger.info(`IndexedDB 被阻塞，300ms 后重试: ${dbName}`)
      // 等待连接句柄释放后重试一次（与 ensureCrypto 重试策略一致的 300ms 等待）
      setTimeout(() => {
        const retryReq = globalThis.indexedDB.deleteDatabase(dbName)
        retryReq.onsuccess = () => {
          logger.info(`重试成功，已删除 IndexedDB: ${dbName}`)
          finish('deleted')
        }
        retryReq.onerror = () => {
          logger.warn(`重试删除 IndexedDB 失败: ${dbName}`)
          finish('failed')
        }
        retryReq.onblocked = () => {
          logger.warn(`IndexedDB 仍被阻塞，跳过: ${dbName}`)
          finish('blocked')
        }
      }, 300)
    }

    // 超时保护：2s 内无结果则视为失败
    const timeoutHandle = setTimeout(() => {
      if (!settled) {
        logger.warn(`删除 IndexedDB 超时 (2s)，跳过: ${dbName}`)
        finish('failed')
      }
    }, 2_000)
  })
}
