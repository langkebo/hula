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
    if (lastCryptoUser !== cryptoUserKey) {
      if (useIndexedDB) {
        logger.info(`检测到 crypto 用户/设备变化（${lastCryptoUser} → ${cryptoUserKey}），主动清理旧 crypto store`)
        await clearStaleCryptoStores(userId)
      }
      this.writeLastCryptoUser(cryptoUserKey)
    }

    this.rustCryptoDebugState = {
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: useIndexedDB
    }

    // ISSUE-08 对接：从系统 keychain 派生 storagePassword，加密 IndexedDB crypto store
    // 和待发事件队列（PendingEventsCipher）。keychain 不可用时降级为不加密（dev/浏览器）。
    const storagePassword = await getOrCreateCryptoStoragePassword(userId, deviceId)
    if (storagePassword) {
      logger.info(`已从 keychain 获取 crypto storagePassword: ${userId}/${deviceId}`)
    } else {
      logger.warn(`未获取到 crypto storagePassword，crypto store 将不加密: ${userId}/${deviceId}`)
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
          await clearStaleCryptoStores(userId)
          // 等待浏览器释放 IndexedDB 连接句柄，避免重试时数据库仍被占用
          await new Promise((resolve) => setTimeout(resolve, 300))
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

  /** 获取 Rust Crypto 调试状态（返回副本） */
  getRustCryptoDebugState(): RustCryptoDebugState {
    return { ...this.rustCryptoDebugState }
  }

  /** 获取事件解密调试状态（返回副本） */
  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return { ...this.eventDecryptedDebugState }
  }

  /** 重置所有状态（供 facade 在 initialize/stop 时调用） */
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

  /** 清除 localStorage 中的 lastCryptoUserId 记录 */
  private clearLastCryptoUser(): void {
    if (typeof globalThis.localStorage === 'undefined') return
    globalThis.localStorage.removeItem('tjg.lastCryptoUserId')
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
 * @returns 'deleted' | 'failed' | 'blocked'
 */
function deleteCryptoDbWithRetry(dbName: string): Promise<'deleted' | 'failed' | 'blocked'> {
  return new Promise((resolve) => {
    logger.info(`删除 IndexedDB: ${dbName}`)
    const req = globalThis.indexedDB.deleteDatabase(dbName)
    req.onsuccess = () => {
      logger.info(`已删除 IndexedDB: ${dbName}`)
      resolve('deleted')
    }
    req.onerror = () => {
      logger.warn(`删除 IndexedDB 失败: ${dbName}`)
      resolve('failed')
    }
    req.onblocked = () => {
      logger.info(`IndexedDB 被阻塞，300ms 后重试: ${dbName}`)
      // 等待连接句柄释放后重试一次（与 ensureCrypto 重试策略一致的 300ms 等待）
      setTimeout(() => {
        const retryReq = globalThis.indexedDB.deleteDatabase(dbName)
        retryReq.onsuccess = () => {
          logger.info(`重试成功，已删除 IndexedDB: ${dbName}`)
          resolve('deleted')
        }
        retryReq.onerror = () => {
          logger.warn(`重试删除 IndexedDB 失败: ${dbName}`)
          resolve('failed')
        }
        retryReq.onblocked = () => {
          logger.warn(`IndexedDB 仍被阻塞，跳过: ${dbName}`)
          resolve('blocked')
        }
      }, 300)
    }
  })
}
