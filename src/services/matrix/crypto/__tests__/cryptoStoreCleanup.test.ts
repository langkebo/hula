import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearStaleCryptoStores } from '../cryptoStoreCleanup'

/**
 * 登出 / 换账号时按固定名称删除 crypto IndexedDB。
 *
 * 关键契约（都曾以真实缺陷出现过）：
 *  - 不依赖 `indexedDB.databases()`（Safari/WKWebView 不支持），必须按名称逐个删；
 *  - `onblocked` 等待 300ms 重试一次，仍阻塞则计为 blocked；
 *  - 2s 超时必须 resolve('failed')，否则 WebView 下永久 pending 会卡住 ensureCrypto。
 */
type DeleteBehavior = 'success' | 'error' | 'blockedOnce' | 'blockedAlways' | 'hang'

interface FakeRequest {
  onsuccess?: () => void
  onerror?: () => void
  onblocked?: () => void
}

const CRYPTO_STORE_DB_NAMES = [
  'matrix-js-sdk::matrix-sdk-crypto',
  'matrix-js-sdk::matrix-sdk-crypto-meta',
  'matrix-js-sdk:crypto'
]

const createFakeIndexedDB = (behaviors: Record<string, DeleteBehavior[]>) => {
  const callCounts: Record<string, number> = {}
  const deleteDatabase = vi.fn((dbName: string) => {
    const callIndex = callCounts[dbName] ?? 0
    callCounts[dbName] = callIndex + 1
    const sequence = behaviors[dbName] ?? ['success']
    const behavior = sequence[Math.min(callIndex, sequence.length - 1)]
    const request: FakeRequest = {}

    // 在微任务中回调，确保实现方已挂好 onsuccess/onerror/onblocked
    queueMicrotask(() => {
      if (behavior === 'success') request.onsuccess?.()
      else if (behavior === 'error') request.onerror?.()
      else if (behavior === 'blockedOnce' || behavior === 'blockedAlways') request.onblocked?.()
      // hang: 模拟既无 success 也无 error，只能靠 2s 超时兜底
    })

    return request
  })

  return { deleteDatabase, callCounts }
}

describe('clearStaleCryptoStores', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('deletes all crypto databases by their fixed names', async () => {
    const fake = createFakeIndexedDB({})
    vi.stubGlobal('indexedDB', fake)

    const result = await clearStaleCryptoStores('@alice:tjg.local')

    expect(result).toEqual({ deleted: 3, failed: 0, blocked: 0 })
    expect(fake.deleteDatabase).toHaveBeenCalledTimes(3)
    expect(fake.deleteDatabase.mock.calls.map(([name]) => name)).toEqual(CRYPTO_STORE_DB_NAMES)
  })

  it('counts an error as failed and still cleans the remaining stores', async () => {
    const fake = createFakeIndexedDB({
      'matrix-js-sdk::matrix-sdk-crypto-meta': ['error']
    })
    vi.stubGlobal('indexedDB', fake)

    const result = await clearStaleCryptoStores('@alice:tjg.local')

    expect(result).toEqual({ deleted: 2, failed: 1, blocked: 0 })
  })

  it('retries once after a blocked delete and reports success', async () => {
    const fake = createFakeIndexedDB({
      'matrix-js-sdk:crypto': ['blockedOnce', 'success']
    })
    vi.stubGlobal('indexedDB', fake)

    const pending = clearStaleCryptoStores('@alice:tjg.local')
    await vi.advanceTimersByTimeAsync(300)

    await expect(pending).resolves.toEqual({ deleted: 3, failed: 0, blocked: 0 })
    expect(fake.callCounts['matrix-js-sdk:crypto']).toBe(2)
  })

  it('reports blocked when the retry is still blocked', async () => {
    const fake = createFakeIndexedDB({
      'matrix-js-sdk:crypto': ['blockedOnce', 'blockedAlways']
    })
    vi.stubGlobal('indexedDB', fake)

    const pending = clearStaleCryptoStores('@alice:tjg.local')
    await vi.advanceTimersByTimeAsync(300)

    await expect(pending).resolves.toEqual({ deleted: 2, failed: 0, blocked: 1 })
    expect(fake.callCounts['matrix-js-sdk:crypto']).toBe(2)
  })

  it('resolves after the 2s timeout when deleteDatabase never settles', async () => {
    const fake = createFakeIndexedDB({
      'matrix-js-sdk:crypto': ['hang']
    })
    vi.stubGlobal('indexedDB', fake)

    const pending = clearStaleCryptoStores('@alice:tjg.local')
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(pending).resolves.toEqual({ deleted: 2, failed: 1, blocked: 0 })
  })

  it('is a no-op when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)

    await expect(clearStaleCryptoStores('@alice:tjg.local')).resolves.toEqual({
      deleted: 0,
      failed: 0,
      blocked: 0
    })
  })
})
