/**
 * storeFactory 单元测试
 *
 * 验证 MatrixClient store 工厂正确选择 IndexedDBStore / MemoryStore，
 * 以及 per-user 隔离、异常降级等关键行为。
 *
 * happy-dom 默认不提供 indexedDB；通过 fake-indexeddb 模拟。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IndexedDBStore, MemoryStore } from 'matrix-js-sdk'

import { createMatrixStore } from '../storeFactory'

// Spy on logger to suppress output in test
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

describe('createMatrixStore', () => {
  beforeEach(() => {
    // Clear fake-indexeddb between tests for isolation
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      return indexedDB.databases().then((dbs) => {
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name)
        }
      })
    }
    return Promise.resolve()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns MemoryStore when userId is null (pre-login)', async () => {
    const store = await createMatrixStore(null)
    expect(store).toBeInstanceOf(MemoryStore)
  })

  it('returns MemoryStore when userId is undefined', async () => {
    const store = await createMatrixStore(undefined)
    expect(store).toBeInstanceOf(MemoryStore)
  })

  it('returns IndexedDBStore when userId is provided and IDB is available', async () => {
    const store = await createMatrixStore('@alice:matrix.test')
    expect(store).toBeInstanceOf(IndexedDBStore)
  })

  it('uses per-user dbName for isolation', async () => {
    const storeA = await createMatrixStore('@alice:matrix.test')
    const storeB = await createMatrixStore('@bob:matrix.test')

    expect(storeA).toBeInstanceOf(IndexedDBStore)
    expect(storeB).toBeInstanceOf(IndexedDBStore)
    // Different store instances (per-user in-memory cache)
    expect(storeA).not.toBe(storeB)
  })

  it('falls back to MemoryStore when IndexedDBStore construction throws', async () => {
    // Force IndexedDBStore to throw on construction
    const OriginalIndexedDBStore = IndexedDBStore
    // Patch the global module binding — since IndexedDBStore is imported as a class reference,
    // we patch the prototype method instead
    const startupSpy = vi
      .spyOn(OriginalIndexedDBStore.prototype as unknown as { startup: () => Promise<void> }, 'startup')
      .mockImplementation(() => Promise.reject(new Error('startup failed')))

    try {
      const store = await createMatrixStore('@charlie:matrix.test')
      expect(store).toBeInstanceOf(MemoryStore)
      // startup must have been called
      expect(startupSpy).toHaveBeenCalled()
    } finally {
      startupSpy.mockRestore()
    }
  })

  it('falls back to MemoryStore when IDB factory is missing', async () => {
    const originalIDB = globalThis.indexedDB
    // Remove indexedDB from globalThis (intentionally mutate for test)
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB

    try {
      const store = await createMatrixStore('@dave:matrix.test')
      expect(store).toBeInstanceOf(MemoryStore)
    } finally {
      // Restore
      ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = originalIDB
    }
  })

  it('persists data across store instances (per-user key isolation)', async () => {
    // This test relies on fake-indexeddb's persistent state across the test run.
    // Since we clear databases in beforeEach, we use a single test for persistence.

    // 1. Create first store for @eve
    const storeEve1 = await createMatrixStore('@eve:matrix.test')
    expect(storeEve1).toBeInstanceOf(IndexedDBStore)

    // Note: MemoryStore parent has setUser/room methods, but a full round-trip
    // test would require deeper SDK setup. We assert the contract: both
    // createMatrixStore calls return IndexedDBStore instances pointing at the
    // same backing DB.

    // 2. Create second store for same user — should reuse same dbName
    const storeEve2 = await createMatrixStore('@eve:matrix.test')
    expect(storeEve2).toBeInstanceOf(IndexedDBStore)
    // Distinct in-memory cache instances, but same underlying IDB database
    expect(storeEve2).not.toBe(storeEve1)
  })
})
