import { createLogger } from '@/utils/Logger'
import type { SearchEventDoc, SearchRoomDoc } from './matrixWorkerTypes'

const logger = createLogger('SearchIndexDB')

const DB_NAME = 'tjg-worker-cache'
const DB_VERSION = 1
const ROOMS_STORE = 'search-rooms'
const EVENTS_STORE = 'search-events'

let dbPromise: Promise<IDBDatabase> | null = null

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

export async function loadRoomsFromDB(): Promise<SearchRoomDoc[]> {
  const store = await getStore(ROOMS_STORE, 'readonly')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadEventsFromDB(): Promise<SearchEventDoc[]> {
  const store = await getStore(EVENTS_STORE, 'readonly')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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

export async function saveEventsToDB(events: SearchEventDoc[]): Promise<void> {
  if (events.length === 0) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EVENTS_STORE, 'readwrite')
    const store = transaction.objectStore(EVENTS_STORE)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)

    for (const event of events) {
      store.put(event)
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
