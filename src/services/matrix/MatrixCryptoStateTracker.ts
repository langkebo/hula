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
import { getOrCreateCryptoStoragePassword } from '@/services/secure/cryptoStorageKey'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixCrypto')

export interface RustCryptoDebugState {
  attempted: boolean
  initialized: boolean
  skippedReason: string | null
  error: string | null
  usedIndexedDB: boolean | null
}

export interface EventDecryptedDebugState {
  count: number
  lastEventId: string | null
  lastRoomId: string | null
  lastError: string | null
}

type RustCryptoCapableClient = MatrixClient & {
  getCrypto?: () => unknown
  initRustCrypto?: (args?: { useIndexedDB?: boolean; storagePassword?: string }) => Promise<void>
}

/**
 * ensureCrypto 跨窗口互斥锁名称。
 *
 * 背景：Tauri 多窗口架构中，每个 WebView 窗口有独立的 globalThis 和模块实例，
 * 导致 globalThis 级 mutex 无法跨窗口工作。多个窗口并发调用 initRustCrypto
 * 会竞争同一 IndexedDB（同 origin 共享），导致第二个卡到 8s 超时。
 *
 * 方案：使用 Web Locks API（navigator.locks.request）实现跨窗口互斥锁。
 * Web Locks 是浏览器原生提供的跨标签/窗口锁机制，同源所有窗口共享。
 * Tauri macOS WKWebView（Safari 16.4+）支持此 API。
 */
const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'

/**
 * 跨 WebView crypto 初始化协调 Channel 名称。
 *
 * 背景：每个 WebView 有独立的 globalThis，导致 globalThis 级单例无法跨窗口共享。
 * 多个 WebView（home/settings/call）各自创建 MatrixClientService 实例，
 * 各自独立调用 initRustCrypto，竞争同一 IndexedDB，导致：
 * 1. 重复初始化开销（每次约 5-10s）
 * 2. RoomStore.DetailCache 被反复清空→重拉网络
 * 3. 跨窗口状态竞态
 *
 * 方案：使用 BroadcastChannel 实现跨窗口协调。
 * - 第一个初始化的窗口广播 "crypto-init-started"
 * - 其他窗口收到后等待 "crypto-init-done" 消息
 * - 初始化完成后广播 "crypto-init-done"
 */
const CRYPTO_CHANNEL_NAME = 'tjg-crypto-init'

/**
 * 检测 Web Locks API 是否可用。
 * 测试环境（Node.js/vitest）和旧浏览器可能不支持，需要 fallback。
 */
function isWebLocksAvailable(): boolean {
  return typeof navigator !== 'undefined' && navigator.locks != null && typeof navigator.locks.request === 'function'
}

/**
 * 检测 BroadcastChannel API 是否可用（跨窗口通信）。
 * 测试环境（Node.js/vitest）下跳过：BroadcastChannel 存在但无其他窗口响应，
 * 会导致 15s 超时阻塞测试。
 */
function isBroadcastChannelAvailable(): boolean {
  if (typeof BroadcastChannel === 'undefined') return false
  // Node.js 测试环境（vitest）：跳过跨窗口协调
  if (typeof globalThis.process !== 'undefined') return false
  return true
}

/**
 * 跨窗口 crypto 初始化协调状态。
 *
 * 使用 BroadcastChannel 实现跨 WebView 的初始化协调：
 * - 窗口 A 开始初始化时广播 "started"
 * - 窗口 B/C 收到 "started" 后等待 "done"（最多等 15s）
 * - 窗口 A 完成后广播 "done"
 * - 超时后窗口 B/C 自行初始化（兜底）
 */
let crossWindowCoordinator: {
  channel: BroadcastChannel
  isInitializing: boolean
  initPromise: Promise<boolean> | null
} | null = null

function getCrossWindowCoordinator(): typeof crossWindowCoordinator {
  if (crossWindowCoordinator) return crossWindowCoordinator
  if (!isBroadcastChannelAvailable()) return null

  const channel = new BroadcastChannel(CRYPTO_CHANNEL_NAME)
  crossWindowCoordinator = {
    channel,
    isInitializing: false,
    initPromise: null
  }
  return crossWindowCoordinator
}

/**
 * 等待其他窗口完成 crypto 初始化。
 *
 * @returns true 表示其他窗口已完成，本窗口可跳过初始化；false 表示超时需自行初始化
 */
async function waitForCrossWindowCryptoInit(): Promise<boolean> {
  const coord = getCrossWindowCoordinator()
  if (!coord) return false

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      coord.channel.onmessage = null
      resolve(false)
    }, 15_000)

    coord.channel.onmessage = (event: MessageEvent) => {
      if (event.data === 'crypto-init-done') {
        clearTimeout(timeout)
        coord.channel.onmessage = null
        resolve(true)
      }
    }

    // 通知其他窗口：本窗口即将开始初始化
    coord.channel.postMessage('crypto-init-started')
  })
}

/**
 * 广播 crypto 初始化完成事件。
 */
function broadcastCryptoInitDone(): void {
  const coord = getCrossWindowCoordinator()
  if (coord) {
    coord.channel.postMessage('crypto-init-done')
  }
}

/**
 * 跨窗口事件处理器：当其他窗口开始初始化时，本窗口暂停并等待。
 */
function _setupCrossWindowListener(): void {
  const coord = getCrossWindowCoordinator()
  if (!coord || coord.isInitializing) return

  coord.channel.onmessage = (event: MessageEvent) => {
    if (event.data === 'crypto-init-started' && !coord.isInitializing) {
      // 其他窗口正在初始化，本窗口等待
      logger.info('[Crypto] 检测到其他窗口正在初始化 crypto，等待完成...')
    }
  }
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
    usedIndexedDB: null
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
        usedIndexedDB: null
      }
      return
    }

    const cryptoClient = client as RustCryptoCapableClient

    if (typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: true,
        skippedReason: 'crypto-already-available',
        error: null,
        usedIndexedDB: null
      }
      return
    }

    if (typeof cryptoClient.initRustCrypto !== 'function') {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'init-method-unavailable',
        error: null,
        usedIndexedDB: null
      }
      return
    }

    const ENSURE_CRYPTO_TIMEOUT_MS = 8_000

    if (isWebLocksAvailable()) {
      // 使用 Web Locks API 实现跨窗口互斥锁
      // 其他窗口正在初始化 crypto 时，本窗口等待锁释放
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ENSURE_CRYPTO_TIMEOUT_MS)

      try {
        await navigator.locks.request(CRYPTO_LOCK_NAME, { mode: 'exclusive', signal: controller.signal }, async () => {
          // 获取锁后检查 crypto 是否已可用（可能其他窗口已完成）
          if (typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()) {
            this.rustCryptoDebugState = {
              attempted: false,
              initialized: true,
              skippedReason: 'crypto-already-available-after-lock',
              error: null,
              usedIndexedDB: null
            }
            return
          }
          logger.info('获取到 crypto 锁，开始初始化 Rust Crypto')
          await this.doEnsureCrypto(cryptoClient)
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          logger.warn(
            `ensureCrypto 超过 ${ENSURE_CRYPTO_TIMEOUT_MS}ms 未完成（等待其他窗口释放锁），转为后台继续（不阻塞 sync 启动）`
          )
          // 后台重新尝试获取锁（不超时），其他窗口完成后本窗口继续初始化
          navigator.locks
            .request(CRYPTO_LOCK_NAME, { mode: 'exclusive' }, async () => {
              if (typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()) {
                this.rustCryptoDebugState = {
                  attempted: false,
                  initialized: true,
                  skippedReason: 'crypto-already-available-after-lock-retry',
                  error: null,
                  usedIndexedDB: null
                }
                logger.info('后台等待锁后 crypto 已可用，跳过初始化')
                return
              }
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
  }

  /**
   * ensureCrypto 的实际实现，被外层 ensureCrypto 用 Promise.race 包装超时。
   * 超时后此任务仍会在后台继续执行（fire-and-forget），最终更新 rustCryptoDebugState。
   */
  private async doEnsureCrypto(cryptoClient: RustCryptoCapableClient): Promise<void> {
    // 跨窗口协调：如果其他 WebView 正在初始化 crypto，等待其完成
    // 避免多窗口并发 initRustCrypto 竞争 IndexedDB
    const otherWindowDone = await waitForCrossWindowCryptoInit()
    if (otherWindowDone) {
      // 其他窗口已完成初始化，检查 crypto 是否已可用
      if (typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()) {
        this.rustCryptoDebugState = {
          attempted: false,
          initialized: true,
          skippedReason: 'crypto-initialized-by-other-window',
          error: null,
          usedIndexedDB: null
        }
        logger.info('[Crypto] 其他窗口已完成 crypto 初始化，本窗口跳过')
        return
      }
    }

    const userId = cryptoClient.getUserId?.()
    const deviceId = cryptoClient.getDeviceId?.()
    if (!userId || !deviceId) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-user-or-device-id',
        error: null,
        usedIndexedDB: null
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

    // ISSUE-08 对接：从系统 keychain 派生 storagePassword，加密 IndexedDB crypto store
    // 和待发事件队列（PendingEventsCipher）。keychain 不可用时降级为不加密（dev/浏览器）。
    const storagePassword = await getOrCreateCryptoStoragePassword(userId, deviceId)
    const currentEncrypted = storagePassword ? '1' : '0'
    const lastEncrypted = this.readLastCryptoEncrypted()

    // 提前清理：以下情况在 initRustCrypto 之前清理旧 store，避免第一次失败+重试耗时
    // 1. userId:deviceId 变化（换设备登录）
    // 2. storagePassword 加密状态变化（上次不加密→这次加密，或反之）
    //    常见场景：macOS dev 模式 keychain 不稳定，上次 keychain 不可用（不加密），
    //    这次 keychain 可用（有密码），用新密码打开旧不加密 store 会报
    //    "An object failed to be decrypted while unpickling"
    const userChanged = lastCryptoUser !== cryptoUserKey
    const encryptedChanged =
      lastCryptoUser === cryptoUserKey && lastEncrypted !== null && lastEncrypted !== currentEncrypted
    if (useIndexedDB && (userChanged || encryptedChanged)) {
      const reason = userChanged
        ? `用户/设备变化（${lastCryptoUser} → ${cryptoUserKey}）`
        : `加密状态变化（${lastEncrypted} → ${currentEncrypted}）`
      logger.info(`检测到 crypto ${reason}，提前清理旧 crypto store 避免 initRustCrypto 失败`)
      await clearStaleCryptoStores(userId)
    }
    if (userChanged || encryptedChanged || lastEncrypted === null) {
      this.writeLastCryptoUser(cryptoUserKey)
      this.writeLastCryptoEncrypted(currentEncrypted)
    }

    if (storagePassword) {
      logger.info(`已从 keychain 获取 crypto storagePassword: ${userId}/${deviceId}`)
    } else {
      logger.warn(`未获取到 crypto storagePassword，crypto store 将不加密: ${userId}/${deviceId}`)
    }

    this.rustCryptoDebugState = {
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: useIndexedDB
    }

    try {
      await cryptoClient.initRustCrypto({
        useIndexedDB,
        storagePassword: storagePassword ?? undefined
      })
      this.rustCryptoDebugState = {
        attempted: true,
        initialized: true,
        skippedReason: null,
        error: null,
        usedIndexedDB: useIndexedDB
      }
      logger.info(`Rust Crypto 初始化完成: ${userId}/${deviceId}`)
      broadcastCryptoInitDone()
    } catch (err) {
      const errMsg = normalizeCryptoError(err)
      // WASM 抛出的错误通常是空对象 {}（wasm-bindgen 转换），
      // String({}) = "[object Object]" 无法匹配具体错误字符串，
      // 因此 initRustCrypto 失败且 IndexedDB 可用时，无条件清理旧 store 后重试一次。
      // 常见触发场景：
      //   - "account in the store doesn't match"（换设备登录，旧 store 残留）
      //   - "An object failed to be decrypted while unpickling"（storagePassword 跨会话不一致）
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
          await cryptoClient.initRustCrypto({
            useIndexedDB,
            storagePassword: storagePassword ?? undefined
          })
          this.rustCryptoDebugState = {
            attempted: true,
            initialized: true,
            skippedReason: null,
            error: null,
            usedIndexedDB: useIndexedDB
          }
          logger.info(`Rust Crypto 重试初始化完成: ${userId}/${deviceId}`)
          broadcastCryptoInitDone()
          return
        } catch (retryErr) {
          const retryMsg = normalizeCryptoError(retryErr)
          this.rustCryptoDebugState = {
            attempted: true,
            initialized: false,
            skippedReason: null,
            error: retryMsg,
            usedIndexedDB: useIndexedDB
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
        usedIndexedDB: useIndexedDB
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

  /** 重置加密状态追踪器
   */
  resetState(): void {
    this.rustCryptoDebugState = {
      attempted: false,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: null
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

  /** 读取上次 storagePassword 加密状态（'1'=有密码, '0'=无密码, null=首次） */
  private readLastCryptoEncrypted(): string | null {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage.getItem('tjg.lastCryptoEncrypted')
  }

  /** 写入 storagePassword 加密状态 */
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
