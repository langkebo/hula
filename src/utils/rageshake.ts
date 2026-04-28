/**
 * Rageshake ring buffer.
 * Captures window errors and unhandled promise rejections into an IndexedDB
 * ring buffer so crash context is available for bug reports.
 */

const DB_NAME = 'hula-rageshake'
const STORE = 'logs'
const MAX_ENTRIES = 100_000
const EVICT_BATCH = 1_000

let dbPromise: Promise<IDBDatabase> | null = null
let writesSinceEvict = 0

function getDb(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') return null
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function safeStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function evictIfNeeded(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const count = await new Promise<number>((res, rej) => {
    const r = store.count()
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  if (count <= MAX_ENTRIES) return
  const target = count - MAX_ENTRIES
  await new Promise<void>((resolve, reject) => {
    let removed = 0
    const cursorReq = store.openCursor()
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor && removed < target) {
        cursor.delete()
        removed++
        cursor.continue()
      } else {
        resolve()
      }
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })
}

export async function appendLog(level: string, args: unknown[]): Promise<void> {
  const dbp = getDb()
  if (!dbp) return
  try {
    const db = await dbp
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ ts: Date.now(), level, msg: args.map(safeStringify).join(' ') })
    writesSinceEvict++
    if (writesSinceEvict >= EVICT_BATCH) {
      writesSinceEvict = 0
      await evictIfNeeded(db)
    }
  } catch {
    // swallow: rageshake must never throw
  }
}

export async function exportLogs(): Promise<Array<{ ts: number; level: string; msg: string }>> {
  const dbp = getDb()
  if (!dbp) return []
  try {
    const db = await dbp
    return await new Promise((resolve, reject) => {
      const all: Array<{ ts: number; level: string; msg: string }> = []
      const cursorReq = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          all.push(cursor.value)
          cursor.continue()
        } else {
          resolve(all)
        }
      }
      cursorReq.onerror = () => reject(cursorReq.error)
    })
  } catch {
    return []
  }
}

let installed = false
export function installRageshake(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    void appendLog('error', [event.message, event.error?.stack ?? `${event.filename}:${event.lineno}:${event.colno}`])
  })

  window.addEventListener('unhandledrejection', (event) => {
    void appendLog('error', ['unhandledrejection', event.reason])
  })
}
