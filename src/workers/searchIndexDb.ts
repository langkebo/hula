import { createLogger } from '@/utils/Logger'
import type { SearchEventDoc, SearchRoomDoc } from './matrixWorkerTypes'

const logger = createLogger('SearchIndexDB')

const DB_NAME = 'tjg-worker-cache'
const DB_VERSION = 1
const ROOMS_STORE = 'search-rooms'
const EVENTS_STORE = 'search-events'

let dbPromise: Promise<IDBDatabase> | null = null

/**
 * 搜索索引的加密密钥（F-4 / D3）。
 *
 * `null` = 未提供 → **不落盘**（只保留内存态索引）。
 * 刻意不提供「无密钥就写明文」的分支：索引里存的是消息正文，
 * 明文落盘等于把私密会话搬上磁盘，与 F-4 的目标直接冲突。
 */
let indexKey: Uint8Array | null = null

/**
 * 设置索引密钥。
 *
 * @param key 32 字节 AES 密钥（由 crypto storageKey 经 HKDF 派生）；`null` = 停止落盘
 */
export function setSearchIndexKey(key: Uint8Array | null): void {
  indexKey?.fill(0)
  indexKey = key ? new Uint8Array(key) : null
  logger.info(indexKey ? '搜索索引已启用加密落盘' : '搜索索引不落盘（无密钥，仅内存）')
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(ROOMS_STORE)) {
        db.createObjectStore(ROOMS_STORE, { keyPath: 'roomId' })
      }
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const eventStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'eventId' })
        eventStore.createIndex('by_room', 'roomId', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }

    request.onerror = (event) => {
      logger.error('Failed to open IndexedDB', (event.target as IDBOpenDBRequest).error)
      reject((event.target as IDBOpenDBRequest).error)
    }
  })

  return dbPromise
}

async function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB()
  return db.transaction(storeName, mode).objectStore(storeName)
}

/**
 * 落盘形态：索引键明文（否则无法查询/删除），其余字段整包加密。
 */
interface EncryptedEventRecord {
  eventId: string
  roomId: string
  /** `v1:<base64(iv|ciphertext)>`，解密后是 JSON 化的 { sender, timestamp, msgtype, body } */
  enc: string
}

export async function loadRoomsFromDB(): Promise<SearchRoomDoc[]> {
  const store = await getStore(ROOMS_STORE, 'readonly')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * 读取事件索引并解密。
 *
 * 无密钥 / 密钥不匹配（换设备、重置密码）时返回空数组：
 * 索引是派生数据，重建成本低；**不能**因为解不开就把密文当明文塞进内存索引。
 */
export async function loadEventsFromDB(): Promise<SearchEventDoc[]> {
  if (!indexKey) return []

  const { decryptIndexField } = await import('@/services/secure/searchIndexCrypto')
  const key = new Uint8Array(indexKey)

  const store = await getStore(EVENTS_STORE, 'readonly')
  const records = await new Promise<EncryptedEventRecord[]>((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as EncryptedEventRecord[])
    request.onerror = () => reject(request.error)
  })

  const docs: SearchEventDoc[] = []
  let dropped = 0
  for (const record of records) {
    if (typeof record?.enc !== 'string' || record.enc.length === 0) {
      // 旧版明文记录（D3 之前写入）→ 丢弃，等首次重建
      dropped++
      continue
    }
    const plain = await decryptIndexField(record.enc, key)
    if (!plain) {
      dropped++
      continue
    }
    try {
      const rest = JSON.parse(plain) as Omit<SearchEventDoc, 'eventId' | 'roomId'>
      docs.push({ ...rest, eventId: record.eventId, roomId: record.roomId })
    } catch {
      dropped++
    }
  }

  if (dropped > 0) {
    logger.warn(`丢弃 ${dropped} 条不可解密的搜索索引记录（将随重建补回）`)
  }
  return docs
}

export async function saveRoomsToDB(rooms: SearchRoomDoc[]): Promise<void> {
  if (rooms.length === 0) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ROOMS_STORE, 'readwrite')
    const store = transaction.objectStore(ROOMS_STORE)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)

    for (const room of rooms) {
      store.put(room)
    }
  })
}

/**
 * 写入事件索引（加密）。
 *
 * 无密钥时**静默跳过落盘**：内存索引照常工作，只是重启后需要重建。
 */
export async function saveEventsToDB(events: SearchEventDoc[]): Promise<void> {
  if (events.length === 0) return
  if (!indexKey) return

  const { encryptIndexField } = await import('@/services/secure/searchIndexCrypto')
  const key = new Uint8Array(indexKey)

  const records: EncryptedEventRecord[] = []
  for (const event of events) {
    const payload = JSON.stringify({
      sender: event.sender,
      timestamp: event.timestamp,
      msgtype: event.msgtype,
      body: event.body
    })
    records.push({
      eventId: event.eventId,
      roomId: event.roomId,
      enc: await encryptIndexField(payload, key)
    })
  }

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EVENTS_STORE, 'readwrite')
    const store = transaction.objectStore(EVENTS_STORE)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)

    for (const record of records) {
      store.put(record)
    }
  })
}

export async function deleteEventFromDB(eventId: string): Promise<void> {
  const store = await getStore(EVENTS_STORE, 'readwrite')
  store.delete(eventId)
}

export async function deleteRoomFromDB(roomId: string): Promise<void> {
  const roomStore = await getStore(ROOMS_STORE, 'readwrite')
  roomStore.delete(roomId)

  const eventStore = await getStore(EVENTS_STORE, 'readwrite')
  const index = eventStore.index('by_room')
  const request = index.openCursor(IDBKeyRange.only(roomId))

  request.onsuccess = () => {
    const cursor = request.result
    if (cursor) {
      cursor.delete()
      cursor.continue()
    }
  }
}

export async function clearAllSearchData(): Promise<void> {
  const roomStore = await getStore(ROOMS_STORE, 'readwrite')
  roomStore.clear()

  const eventStore = await getStore(EVENTS_STORE, 'readwrite')
  eventStore.clear()
}

/**
 * 只读统计落盘条数（**不加载记录内容**）。
 *
 * 主线程的「存储管理」用它展示搜索索引占用规模：`count()` 走索引元数据，
 * 比 `getAll()` 轻几个数量级（索引可能是几十万条），也避免把加密记录读进内存。
 *
 * 与 worker 内的 `handleSearchStats()` 的区别：那是**内存索引**的统计，
 * 需要 worker 存活；这里是**磁盘**统计，任何时候都能拿到。
 */
export async function countSearchIndexRecords(): Promise<{ rooms: number; events: number }> {
  const roomStore = await getStore(ROOMS_STORE, 'readonly')
  const eventStore = await getStore(EVENTS_STORE, 'readonly')
  const count = (store: IDBObjectStore) =>
    new Promise<number>((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  const [rooms, events] = await Promise.all([count(roomStore), count(eventStore)])
  return { rooms, events }
}
