import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * S3 回归：IndexedDB 打开/读取失败后必须能自愈。
 *
 * 审计里最糟的形态是「一次瞬时失败 = 永久降级」：`openDB()` 把 rejected
 * promise 缓存进 `dbPromise`，之后所有搜索读写都拿同一个失败结果，只能重启。
 * 这里用 fake-indexeddb 真实建库，只把**第一次** `indexedDB.open` 替换成失败请求，
 * 断言读操作会重置连接并重试一次成功；连续失败则把错误抛给调用方。
 */

interface FailingRequest {
  onupgradeneeded: ((event: Event) => void) | null
  onsuccess: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  onblocked: ((event: Event) => void) | null
  error: Error
  target: FailingRequest
}

const createFailingOpenRequest = (error: Error): IDBOpenDBRequest => {
  const request = {
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    onblocked: null,
    error,
    target: null
  } as unknown as FailingRequest

  request.target = request

  // onerror 必须异步触发，否则 openDB 里的 handler 还没挂上就被调用
  setTimeout(() => {
    request.onerror?.({ target: request } as unknown as Event)
  }, 0)

  return request as unknown as IDBOpenDBRequest
}

const loadModule = async () => {
  vi.resetModules()
  return import('../searchIndexDb')
}

let queuedFailures: Error[] = []

beforeEach(() => {
  queuedFailures = []
  const realOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB)
  vi.spyOn(globalThis.indexedDB, 'open').mockImplementation((name: string, version?: number) => {
    const failure = queuedFailures.shift()
    if (failure) {
      return createFailingOpenRequest(failure)
    }
    return realOpen(name, version)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('searchIndexDb read self-healing (S3)', () => {
  it('resets the cached connection and retries once after a failed open', async () => {
    queuedFailures = [new Error('transient open failure')]
    const { loadRoomsFromDB } = await loadModule()

    await expect(loadRoomsFromDB()).resolves.toEqual([])
  })

  it('surfaces the error when the retry also fails', async () => {
    queuedFailures = [new Error('first failure'), new Error('second failure')]
    const { loadRoomsFromDB } = await loadModule()

    await expect(loadRoomsFromDB()).rejects.toThrow('second failure')
  })

  it('keeps working for later reads after a recovered failure', async () => {
    queuedFailures = [new Error('transient open failure')]
    const { countSearchIndexRecords, loadRoomsFromDB } = await loadModule()

    await expect(loadRoomsFromDB()).resolves.toEqual([])
    // 第二次读取不应再触发重试，直接走已恢复的连接
    await expect(countSearchIndexRecords()).resolves.toEqual({ rooms: 0, events: 0 })
  })
})
