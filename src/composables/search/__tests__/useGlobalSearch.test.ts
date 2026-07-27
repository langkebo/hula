import { enableAutoUnmount, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useGlobalSearch } from '../useGlobalSearch'

// === Mock MatrixSearchService ===
const searchUsersMock = vi.fn()
const searchRoomsMock = vi.fn()
const searchMessagesMock = vi.fn()

vi.mock('@/services/matrix/MatrixSearchService', () => ({
  matrixSearchService: {
    searchUsers: (...args: unknown[]) => searchUsersMock(...(args as [string, number])),
    searchRooms: (...args: unknown[]) => searchRoomsMock(...(args as [string])),
    searchMessages: (...args: unknown[]) => searchMessagesMock(...(args as [string, unknown]))
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// === Helper: 创建宿主组件 ===
let hostApi: ReturnType<typeof useGlobalSearch> | null = null

const TestHost = defineComponent({
  name: 'TestHost',
  setup() {
    hostApi = useGlobalSearch()
    return () => h('div', { class: 'test-host' })
  }
})

enableAutoUnmount(afterEach)

// 工具：刷新微任务队列
const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useGlobalSearch - AbortController integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hostApi = null
    searchUsersMock.mockResolvedValue([])
    searchRoomsMock.mockResolvedValue([])
    searchMessagesMock.mockResolvedValue([])
  })

  it('discards stale results when a newer search supersedes an older one', async () => {
    // 第一次搜索：模拟慢请求，不立即 resolve
    let resolveFirst!: (value: unknown) => void
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })
    searchUsersMock.mockReturnValueOnce(firstPromise)

    mount(TestHost)

    // 触发第一次搜索（不会立即完成）
    const firstCall = hostApi!.executeSearch('alice')
    await flush()

    // 第二次搜索：覆盖第一次（mockResolvedValueOnce 让第二次立即返回）
    searchUsersMock.mockResolvedValueOnce([{ userId: '@bob:example.com', displayName: 'Bob' }])
    const secondCall = hostApi!.executeSearch('bob')
    await secondCall
    await flush()

    // 第二次搜索结果应已就位
    expect(hostApi!.results.value.users).toEqual([{ userId: '@bob:example.com', displayName: 'Bob' }])
    expect(hostApi!.status.value).toBe('success')

    // 现在让第一次搜索的慢请求完成
    resolveFirst([{ userId: '@alice:example.com', displayName: 'Alice' }])
    await firstCall
    await flush()

    // 第一次的结果应被丢弃，不应覆盖第二次的结果
    expect(hostApi!.results.value.users).toEqual([{ userId: '@bob:example.com', displayName: 'Bob' }])
  })

  it('clear() aborts any in-flight search', async () => {
    let resolveFirst!: (value: unknown) => void
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })
    searchUsersMock.mockReturnValueOnce(firstPromise)

    mount(TestHost)

    const firstCall = hostApi!.executeSearch('alice')
    await flush()

    // clear 应该取消未完成的请求
    hostApi!.clear()
    expect(hostApi!.status.value).toBe('idle')

    // 即使底层 promise 完成，结果也不应被应用
    resolveFirst([{ userId: '@alice:example.com', displayName: 'Alice' }])
    await firstCall
    await flush()

    expect(hostApi!.results.value.users).toEqual([])
  })

  it('subsequent search after clear works normally', async () => {
    mount(TestHost)

    await hostApi!.executeSearch('alice')
    await flush()

    hostApi!.clear()

    // 新搜索应正常工作
    searchUsersMock.mockResolvedValueOnce([{ userId: '@bob:example.com', displayName: 'Bob' }])
    await hostApi!.executeSearch('bob')
    await flush()

    expect(hostApi!.results.value.users).toEqual([{ userId: '@bob:example.com', displayName: 'Bob' }])
    expect(hostApi!.appliedQuery.value).toBe('bob')
  })
})

describe('useGlobalSearch - basic behavior (regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hostApi = null
    searchUsersMock.mockResolvedValue([])
    searchRoomsMock.mockResolvedValue([])
    searchMessagesMock.mockResolvedValue([])
  })

  it('returns idle status when query is empty', async () => {
    mount(TestHost)
    await hostApi!.executeSearch('')
    expect(hostApi!.status.value).toBe('idle')
  })

  it('executes search and aggregates results from all sources', async () => {
    searchUsersMock.mockResolvedValue([{ userId: '@a:example.com', displayName: 'A' }])
    searchRoomsMock.mockResolvedValue([{ roomId: '!r1:example.com', name: 'Room1' }])
    searchMessagesMock.mockResolvedValue([{ event_id: '$e1', content: {} }])

    mount(TestHost)
    await hostApi!.executeSearch('test')

    expect(hostApi!.status.value).toBe('success')
    expect(hostApi!.results.value.users).toHaveLength(1)
    expect(hostApi!.results.value.rooms).toHaveLength(1)
    expect(hostApi!.results.value.messages).toHaveLength(1)
    expect(hostApi!.totalCount.value).toBe(3)
  })
})
