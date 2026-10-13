/**
 * Crypto IndexedDB store 清理（从 `MatrixCryptoStateTracker` 抽出，Batch 4.2）。
 *
 * 抽出的原因：这些逻辑与「crypto 初始化状态机」无关，只是对 IndexedDB 的纯操作，
 * 且带独立的超时/重试策略；留在 tracker 里让该文件长期贴着体积警戒线。
 *
 * 不依赖 `matrix-js-sdk`（只用 `globalThis.indexedDB`），故不受 `check:sdk-boundary` 约束。
 */
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixCrypto')

/**
 * Matrix crypto 使用的 IndexedDB 数据库名。
 *
 * Rust crypto 使用两个（见 SDK `client-store-cleanup.ts`）：
 *   - `matrix-js-sdk::matrix-sdk-crypto`
 *   - `matrix-js-sdk::matrix-sdk-crypto-meta`
 * Legacy crypto store 使用：
 *   - `matrix-js-sdk:crypto`
 *
 * 这些名称是**固定的、不含 userId 后缀** —— 所以同源的所有窗口共享同一组 DB
 * （这也是"每窗口必须各自 init，但 Web Locks 串行化"那条设计约束的来源）。
 */
export const CRYPTO_STORE_DB_NAMES = [
  'matrix-js-sdk::matrix-sdk-crypto',
  'matrix-js-sdk::matrix-sdk-crypto-meta',
  'matrix-js-sdk:crypto'
] as const

/** 清理结果统计。 */
export interface CryptoStoreCleanupResult {
  deleted: number
  failed: number
  blocked: number
}

/** 单个 DB 的删除结果。 */
export type CryptoDbDeleteOutcome = 'deleted' | 'failed' | 'blocked'

/**
 * 删除单个 IndexedDB 数据库，`onblocked` 时等待 300ms 后重试一次。
 *
 * 超时保护：2s 内无结果则 resolve('failed') —— 某些 WebView 环境下
 * `deleteDatabase` 对不存在的数据库既不触发 `onsuccess` 也不触发 `onerror`，
 * 会让 Promise 永久 pending、进而卡住 `clearStaleCryptoStores` → `ensureCrypto`。
 */
export function deleteCryptoDbWithRetry(dbName: string): Promise<CryptoDbDeleteOutcome> {
  return new Promise((resolve) => {
    let settled = false
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const finish = (result: CryptoDbDeleteOutcome) => {
      if (settled) return
      settled = true
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
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
    timeoutHandle = setTimeout(() => {
      logger.warn(`删除 IndexedDB 超时 (2s)，跳过: ${dbName}`)
      finish('failed')
    }, 2_000)
  })
}

/**
 * 清除 Matrix crypto 使用的全部 IndexedDB 数据库。
 *
 * 直接按**固定名称**删除，不依赖 `indexedDB.databases()`（Safari/WKWebView 不支持该 API）。
 *
 * @param _userId 仅用于调用方语义表达 —— DB 名不含用户后缀，故本函数不消费它
 */
export async function clearStaleCryptoStores(_userId: string): Promise<CryptoStoreCleanupResult> {
  if (typeof globalThis.indexedDB === 'undefined') return { deleted: 0, failed: 0, blocked: 0 }
  const results = await Promise.all(CRYPTO_STORE_DB_NAMES.map((dbName) => deleteCryptoDbWithRetry(dbName)))
  return {
    deleted: results.filter((r) => r === 'deleted').length,
    failed: results.filter((r) => r === 'failed').length,
    blocked: results.filter((r) => r === 'blocked').length
  }
}
