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
  initRustCrypto?: (args?: { useIndexedDB?: boolean }) => Promise<void>
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
        await this.deleteCryptoDbForUser(userId)
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

    try {
      await cryptoClient.initRustCrypto({
        useIndexedDB
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
      const errMsg = err instanceof Error ? err.message : String(err)
      // 账户不匹配通常是因为旧设备的 crypto store 残留（换设备登录/多设备登录）。
      // 尝试清除旧的 IndexedDB crypto 数据库后重试一次。
      if (errMsg.includes("account in the store doesn't match") && useIndexedDB) {
        logger.warn('检测到 crypto 账户不匹配，尝试清除旧 crypto 数据后重试...')
        try {
          await clearStaleCryptoStores(userId)
          await cryptoClient.initRustCrypto({ useIndexedDB })
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
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
          this.rustCryptoDebugState = {
            attempted: true,
            initialized: false,
            skippedReason: null,
            error: retryMsg,
            usedIndexedDB: useIndexedDB
          }
          logger.warn('Rust Crypto 重试仍失败，继续以非加密模式启动:', retryErr)
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
      logger.warn('Rust Crypto 初始化失败，继续以非加密模式启动:', err)
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
      await clearStaleCryptoStores(userId)
      await this.deleteCryptoDbForUser(userId)
    }
    logger.info(`登出清理完成: ${userId}`)
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

  /**
   * 直接删除指定用户的 crypto IndexedDB 数据库。
   * 不依赖 indexedDB.databases()（非标准 API），按命名约定直接删除。
   */
  private async deleteCryptoDbForUser(userId: string): Promise<void> {
    if (typeof globalThis.indexedDB === 'undefined') return
    const userSuffix = userId.replace(/[^a-zA-Z0-9]/g, '_')
    const dbName = `matrix-js-sdk:crypto:${userSuffix}`
    await new Promise<void>((resolve) => {
      const req = globalThis.indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  }
}

/**
 * 清除指定用户的旧 crypto IndexedDB 数据库。
 * matrix-js-sdk 使用 `matrix-js-sdk:crypto:*` 命名约定。
 * 换设备登录时，旧设备的 crypto store 会导致账户不匹配错误，
 * 需要清除该用户的所有 crypto 数据库（SDK 会自动重建）。
 */
async function clearStaleCryptoStores(userId: string): Promise<void> {
  if (typeof globalThis.indexedDB === 'undefined') return
  const databases = await (
    globalThis.indexedDB as IDBFactory & {
      databases?: () => Promise<IDBDatabaseInfo[]>
    }
  )
    .databases?.()
    .catch(() => [] as IDBDatabaseInfo[])
  if (!databases) return
  const cryptoDbPrefix = 'matrix-js-sdk:crypto'
  const userSuffix = userId.replace(/[^a-zA-Z0-9]/g, '_')
  await Promise.all(
    databases
      .filter((db: IDBDatabaseInfo) => db.name?.startsWith(cryptoDbPrefix) && db.name.includes(userSuffix))
      .map(
        (db: IDBDatabaseInfo) =>
          new Promise<void>((resolve) => {
            if (!db.name) return resolve()
            const req = globalThis.indexedDB.deleteDatabase(db.name)
            req.onsuccess = () => resolve()
            req.onerror = () => resolve()
            req.onblocked = () => resolve()
          })
      )
  )
}
