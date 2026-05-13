import { IndexedDBStoreWorker } from '@/services/matrix/sdk-compat'

/**
 * Matrix IndexedDB Store Worker
 * 负责在独立线程中处理 IndexedDB 读写操作，避免阻塞主线程 UI
 */
const worker = new IndexedDBStoreWorker(self.postMessage.bind(self) as never)
self.onmessage = worker.onMessage.bind(worker)
