import { IndexedDBStore, MemoryStore } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixStore')

/**
 * 创建 Matrix Store 实例。
 * 优先使用 IndexedDBStore 以实现跨会话持久化(避免每次启动全量 /sync)。
 * 失败时降级到 MemoryStore。
 *
 * 暂未启用 Worker,首先获取持久化收益,后续可以迁移到 Worker 减少主线程压力。
 */
export async function createMatrixStore() {
  if (typeof indexedDB === 'undefined') {
    logger.info('IndexedDB 不可用,使用 MemoryStore')
    return new MemoryStore({ localStorage: window.localStorage })
  }

  try {
    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      dbName: 'hula-matrix-sync',
      localStorage: window.localStorage
    })
    await store.startup()
    logger.info('IndexedDBStore 启动成功 (dbName=hula-matrix-sync)')
    return store
  } catch (err) {
    logger.warn('IndexedDBStore 启动失败,降级到 MemoryStore', err)
    return new MemoryStore({ localStorage: window.localStorage })
  }
}
