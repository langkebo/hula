/**
 * Matrix Client Store 工厂
 *
 * 为 MatrixClient 选择合适的持久化 store：
 * - WebView (Tauri 2.x 桌面/移动) → IndexedDBStore（持久化到 IndexedDB）
 * - 浏览器开发模式 / 降级场景 → MemoryStore（不持久化）
 *
 * ## 为什么不用 Tauri 原生 SQLite？
 * matrix-js-sdk 的 IStore 接口是 SDK 内部协议，第三方实现需要完整实现
 * IStore 的所有方法（~30 个），成本极高。IndexedDBStore 是 SDK 官方实现，
 * Tauri 2.x WebView 内 IndexedDB 100% 可用，且 SDK 文档明确推荐。
 *
 * ## 为什么需要 per-user 隔离？
 * 多账户登录时，每个 userId 需要独立 dbName，否则会共享缓存数据，
 * 导致账户切换时旧数据泄漏到新账户。
 *
 * ## 失败降级策略
 * - IndexedDB 不可用（隐私模式、storage quota exceeded）→ 退到 MemoryStore
 * - store.startup() 抛错 → 退到 MemoryStore（同步等待）
 * - MemoryStore 失败 → 抛错到 caller（致命错误，不容静默）
 */

import { IndexedDBStore, MemoryStore } from 'matrix-js-sdk'
import type { IStore } from 'matrix-js-sdk/store'

import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixStoreFactory')

/** IndexedDBStore 的 dbName 前缀，与 rust-crypto store 区分。 */
const IDB_STORE_PREFIX = 'matrix-js-sdk::sync::'

/**
 * F-12 修复：同 origin 多窗口并发 startup() 会互踩 IndexedDB（同一 dbName
 * 被两个 IndexedDBStore 实例同时 open/upgrade）。使用 per-user Promise 锁
 * 保证同一 userId 的 startup 串行化；第二窗口拿到第一窗口返回的同一 store
 * 实例（或 fallback）。Map 只在模块生命周期内驻留，进程重启即清空。
 */
const startupLocks = new Map<string | null, Promise<IStore>>()

/**
 * 检测当前运行时是否支持 IndexedDB。
 *
 * happy-dom 等测试环境可能不提供 indexedDB；某些隐私模式可能抛错。
 * 永远不应在测试/SSR 场景使用 IndexedDBStore（依赖 IDBFactory 的实际能力）。
 */
function isIndexedDBAvailable(): boolean {
  try {
    return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined'
  } catch {
    return false
  }
}

/**
 * 创建 MatrixClient 使用的 IStore 实例。
 *
 * @param userId - Matrix 用户 ID（@alice:matrix.test 格式），用于 IndexedDB dbName 隔离
 * @returns 已就绪的 IStore 实例（已 await startup 加载历史数据）
 *
 * @throws {Error} 当所有 store 类型都不可用时（极少见的致命环境错误）
 */
export async function createMatrixStore(userId: string | null | undefined): Promise<IStore> {
  // F-12 修复：无 userId 场景直接走 MemoryStore（无需锁）
  if (!userId) {
    logger.debug('createMatrixStore: no userId, falling back to MemoryStore')
    return new MemoryStore({ localStorage: globalThis.localStorage })
  }

  // F-12 修复：同 origin 多窗口并发 startup 锁——同一 userId 的第二调用
  // 等待第一调用完成，拿到同一个 Promise 返回值而非重复 open/upgrade IDB。
  const existing = startupLocks.get(userId)
  if (existing) {
    logger.debug(`createMatrixStore: userId=${userId} waiting for in-flight startup`)
    return existing
  }

  if (!isIndexedDBAvailable()) {
    logger.warn('createMatrixStore: IndexedDB not available, falling back to MemoryStore (no persistence)')
    return new MemoryStore({ localStorage: globalThis.localStorage })
  }

  // 尝试 IndexedDBStore，失败退到 MemoryStore
  const task = (async (): Promise<IStore> => {
    try {
      const dbName = `${IDB_STORE_PREFIX}${userId}`
      const store = new IndexedDBStore({
        indexedDB: globalThis.indexedDB,
        localStorage: globalThis.localStorage,
        dbName
      })
      // startup() 是 Promise 形式，必须 await 才能在 createClient 后加载历史数据
      await store.startup()
      logger.info(`createMatrixStore: IndexedDBStore ready (dbName=${dbName})`)
      return store
    } catch (err) {
      logger.warn(
        `createMatrixStore: IndexedDBStore init failed, falling back to MemoryStore. reason=${(err as Error).message}`
      )
      return new MemoryStore({ localStorage: globalThis.localStorage })
    } finally {
      startupLocks.delete(userId)
    }
  })()

  startupLocks.set(userId, task)
  return task
}
