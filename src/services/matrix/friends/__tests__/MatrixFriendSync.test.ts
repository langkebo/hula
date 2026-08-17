import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Friend, FriendRequest, MatrixClient } from '@/services/matrix/sdk'

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    log: vi.fn()
  }
  return { mockLogger }
})

// MatrixFriendSync 运行时依赖 mock
vi.mock('@/utils/Logger', () => ({
  createLogger: () => mockLogger
}))

vi.mock('@/services/matrix/sdk', () => ({
  FriendEvent: {
    Invited: 'Invited',
    Accepted: 'Accepted',
    Rejected: 'Rejected',
    Cancelled: 'Cancelled',
    Removed: 'Removed',
    RequestReceived: 'RequestReceived',
    ListUpdated: 'ListUpdated'
  }
}))

vi.mock('../../MatrixClientService', () => ({
  default: { getClient: vi.fn(), on: vi.fn(), off: vi.fn() }
}))

vi.mock('../../extensions/SynapseFriendExtensionService', () => ({
  synapseFriendExtensionService: {
    getPendingRequests: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => `translated:${key}` })
}))

import { FriendEvent } from '@/services/matrix/sdk'
import { synapseFriendExtensionService } from '../../extensions/SynapseFriendExtensionService'
import matrixClientService from '../../MatrixClientService'
import { MatrixFriendSync } from '../MatrixFriendSync'

type Handler = (...args: unknown[]) => void

const eventHandlers: Record<string, Handler[]> = {}

const mockManager = {
  start: vi.fn(async () => {}),
  stop: vi.fn(),
  removeAllListeners: vi.fn(),
  getFriends: vi.fn<() => Promise<Friend[]>>(async () => []),
  getIncomingRequests: vi.fn<() => Promise<FriendRequest[]>>(async () => []),
  getOutgoingRequests: vi.fn<() => Promise<FriendRequest[]>>(async () => []),
  on: vi.fn((event: string, handler: Handler) => {
    eventHandlers[event] ??= []
    eventHandlers[event].push(handler)
  })
}

function setClientWithManager(): void {
  vi.mocked(matrixClientService.getClient).mockReturnValue({
    friendManager: mockManager
  } as unknown as MatrixClient)
}

function triggerEvent(event: string, ...args: unknown[]): void {
  ;(eventHandlers[event] ?? []).forEach((handler) => handler(...args))
}

let sync: MatrixFriendSync

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(eventHandlers).forEach((k) => delete eventHandlers[k])
  sync = new MatrixFriendSync(vi.fn())
})

afterEach(() => {
  sync?.stop()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('initialize', () => {
  it('无 client 时不抛错（暂缓初始化，等待连接后重试）', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(sync.initialize()).resolves.toBeUndefined()
    expect(mockManager.start).not.toHaveBeenCalled()
  })

  it('manager 存在时启动 manager', async () => {
    setClientWithManager()

    await sync.initialize()

    expect(mockManager.start).toHaveBeenCalledTimes(1)
  })

  it('获取 client 抛错时重新抛出', async () => {
    vi.mocked(matrixClientService.getClient).mockImplementation(() => {
      throw new Error('client boom')
    })

    await expect(sync.initialize()).rejects.toThrow('client boom')
  })
})

describe('真实触发路径：client 缺失窗口 vs 扩展真实缺失', () => {
  /** 最小化 MatrixClient 桩：getFriendManager 挂在原型上，模拟 SDK 真实注入形态 */
  function makePrototypeClient(getFriendManagerImpl: () => unknown): MatrixClient {
    class FakeMatrixClient {}
    ;(FakeMatrixClient.prototype as unknown as Record<string, unknown>).getFriendManager = getFriendManagerImpl
    return new FakeMatrixClient() as unknown as MatrixClient
  }

  it('客户端尚未创建（getClient 返回 null）时不降级 REST，仅注册连接监听等待重试', async () => {
    vi.useFakeTimers()
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
    vi.mocked(synapseFriendExtensionService.getPendingRequests).mockResolvedValue({
      incoming: [],
      outgoing: []
    })

    await sync.initialize()

    // 降级路径未触发：不启动 REST 轮询、不启动 manager
    await vi.advanceTimersByTimeAsync(30_000)
    expect(synapseFriendExtensionService.getPendingRequests).not.toHaveBeenCalled()
    expect(mockManager.start).not.toHaveBeenCalled()
    // 已注册连接监听，待 CONNECTED 后重试
    expect(matrixClientService.on).toHaveBeenCalledWith('connectionState', expect.any(Function))
  })

  it('prototype 携带 getFriendManager 的 client 通过深检查恢复 manager（不依赖懒注册）', async () => {
    const client = makePrototypeClient(() => mockManager)
    vi.mocked(matrixClientService.getClient).mockReturnValue(client)

    await sync.initialize()

    expect(mockManager.start).toHaveBeenCalledTimes(1)
    const manager = await sync.ensureFriendManager(false)
    expect(manager).toBe(mockManager)
  })

  it('getFriendManager 工厂抛错时（client 存在）仍降级到 REST 轮询', async () => {
    vi.useFakeTimers()
    const client = makePrototypeClient(() => {
      throw new Error('factory boom')
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue(client)
    vi.mocked(synapseFriendExtensionService.getPendingRequests).mockResolvedValue({
      incoming: [],
      outgoing: []
    })

    await expect(sync.initialize()).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(synapseFriendExtensionService.getPendingRequests).toHaveBeenCalled()
    expect(mockManager.start).not.toHaveBeenCalled()
  })

  it('getFriendManager 返回无 start 的对象时降级到 REST 轮询', async () => {
    vi.useFakeTimers()
    const client = makePrototypeClient(() => ({ getFriends: async () => [] }))
    vi.mocked(matrixClientService.getClient).mockReturnValue(client)
    vi.mocked(synapseFriendExtensionService.getPendingRequests).mockResolvedValue({
      incoming: [],
      outgoing: []
    })

    await expect(sync.initialize()).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(synapseFriendExtensionService.getPendingRequests).toHaveBeenCalled()
    expect(mockManager.start).not.toHaveBeenCalled()
  })
})

describe('handleClientReady 降级回退', () => {
  /** 最小化 MatrixClient 桩：getFriendManager 挂在原型上，模拟 SDK 真实注入形态 */
  function makePrototypeClient(getFriendManagerImpl: () => unknown): MatrixClient {
    class FakeMatrixClient {}
    ;(FakeMatrixClient.prototype as unknown as Record<string, unknown>).getFriendManager = getFriendManagerImpl
    return new FakeMatrixClient() as unknown as MatrixClient
  }

  function getConnectionCallback(): Handler {
    const call = vi.mocked(matrixClientService.on).mock.calls.find(([event]) => event === 'connectionState')
    if (!call) throw new Error('connectionState 监听未注册')
    return call[1] as Handler
  }

  it('null-client 初始化后 client 就绪但 manager 真实缺失 → 启动 REST 轮询并记录降级日志', async () => {
    vi.useFakeTimers()

    // 阶段 1：初始化时 client 为 null（no-client 窗口），仅注册连接监听等待重试
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
    await sync.initialize()

    // 阶段 2：client 就绪，但扩展真实缺失（getFriendManager 工厂抛错）
    const client = makePrototypeClient(() => {
      throw new Error('factory boom')
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue(client)
    vi.mocked(synapseFriendExtensionService.getPendingRequests).mockResolvedValue({
      incoming: [],
      outgoing: []
    })

    // 触发 CONNECTED → handleClientReady
    getConnectionCallback()({ state: 'CONNECTED' })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MatrixFriend] FriendManager 未在客户端上找到，已降级到好友 REST 接口'
    )

    // 轮询已启动：推进一个轮询周期，REST 拉取被调用
    await vi.advanceTimersByTimeAsync(30_000)
    expect(synapseFriendExtensionService.getPendingRequests).toHaveBeenCalled()
    expect(mockManager.start).not.toHaveBeenCalled()
  })
})

describe('ensureFriendManager', () => {
  it('throwOnMissing=true 且无 manager 时抛出错误', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(sync.ensureFriendManager(true)).rejects.toThrow(
      'translated:matrix_error.friends.manager_not_initialized'
    )
  })

  it('throwOnMissing=false 且无 manager 时返回 null', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    const result = await sync.ensureFriendManager(false)

    expect(result).toBeNull()
  })

  it('manager 存在时启动并返回 manager', async () => {
    setClientWithManager()

    const result = await sync.ensureFriendManager(true)

    expect(result).toBe(mockManager)
    expect(mockManager.start).toHaveBeenCalledTimes(1)
  })

  it('manager 已启动时不重复 start', async () => {
    setClientWithManager()

    await sync.ensureFriendManager(true)
    await sync.ensureFriendManager(true)

    expect(mockManager.start).toHaveBeenCalledTimes(1)
  })
})

describe('requireFriendManager', () => {
  it('无 manager 时抛出错误', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(sync.requireFriendManager()).rejects.toThrow('translated:matrix_error.friends.manager_not_initialized')
  })

  it('manager 存在时返回 manager', async () => {
    setClientWithManager()

    const result = await sync.requireFriendManager()

    expect(result).toBe(mockManager)
  })
})

describe('updateSyncState', () => {
  it('manager 存在时拉取 friends / incoming / outgoing 并更新状态', async () => {
    setClientWithManager()
    await sync.ensureFriendManager(true)
    mockManager.getFriends.mockResolvedValue([{ user_id: '@a:example.org' }])
    mockManager.getIncomingRequests.mockResolvedValue([{ user_id: '@b:example.org', status: 'pending' }])
    mockManager.getOutgoingRequests.mockResolvedValue([{ user_id: '@c:example.org', status: 'pending' }])

    await sync.updateSyncState()

    const state = sync.getSyncStateValue()
    expect(state.friends).toHaveLength(1)
    expect(state.incomingRequests).toHaveLength(1)
    expect(state.outgoingRequests).toHaveLength(1)
  })

  it('无 manager 时直接返回，状态不变', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    const before = sync.getSyncStateValue()
    await sync.updateSyncState()

    expect(sync.getSyncStateValue()).toEqual(before)
    expect(sync.getSyncStateValue().friends).toEqual([])
  })
})

describe('getSyncStateValue', () => {
  it('返回当前同步状态', () => {
    const state = sync.getSyncStateValue()

    expect(state).toHaveProperty('friends')
    expect(state).toHaveProperty('incomingRequests')
    expect(state).toHaveProperty('outgoingRequests')
  })
})

describe('sync', () => {
  it('无 manager 时抛出错误', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(sync.sync()).rejects.toThrow('translated:matrix_error.friends.manager_not_initialized')
  })

  it('manager 存在时更新同步状态', async () => {
    setClientWithManager()
    const updateSpy = vi.spyOn(sync, 'updateSyncState')

    await sync.sync()

    expect(updateSpy).toHaveBeenCalled()
  })
})

describe('stop', () => {
  it('停止 manager 并重置状态', async () => {
    setClientWithManager()
    await sync.ensureFriendManager(true)

    sync.stop()

    expect(mockManager.stop).toHaveBeenCalled()
    expect(mockManager.removeAllListeners).toHaveBeenCalled()
    expect(sync.getSyncStateValue().friends).toEqual([])
  })

  it('无 manager 时安全返回', () => {
    expect(() => sync.stop()).not.toThrow()
  })
})

describe('event listeners', () => {
  it('ListUpdated 触发 emit sync', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)

    triggerEvent(FriendEvent.ListUpdated)

    expect(emit).toHaveBeenCalledWith('sync', expect.any(Object))
    s.stop()
  })

  it('Removed 触发 emit friendRemoved', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)

    triggerEvent(FriendEvent.Removed, '@alice:example.org')

    expect(emit).toHaveBeenCalledWith('friendRemoved', '@alice:example.org')
    s.stop()
  })

  it('RequestReceived 触发 emit requestReceived', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)
    const request = { user_id: '@alice:example.org', status: 'pending' }

    triggerEvent(FriendEvent.RequestReceived, request)

    expect(emit).toHaveBeenCalledWith('requestReceived', request)
    s.stop()
  })

  it('Invited 触发 emit requestSent', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)
    const request = { user_id: '@bob:example.org', status: 'pending' }

    triggerEvent(FriendEvent.Invited, '@bob:example.org', request)

    expect(emit).toHaveBeenCalledWith('requestSent', request)
    s.stop()
  })

  it('Accepted 触发 emit requestAccepted', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)

    triggerEvent(FriendEvent.Accepted, '@alice:example.org')

    expect(emit).toHaveBeenCalledWith('requestAccepted', '@alice:example.org')
    s.stop()
  })

  it('Rejected 触发 emit requestRejected', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)

    triggerEvent(FriendEvent.Rejected, '@alice:example.org')

    expect(emit).toHaveBeenCalledWith('requestRejected', '@alice:example.org')
    s.stop()
  })

  it('Cancelled 触发 emit requestCancelled', async () => {
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)

    triggerEvent(FriendEvent.Cancelled, '@alice:example.org')

    expect(emit).toHaveBeenCalledWith('requestCancelled', '@alice:example.org')
    s.stop()
  })
})

describe('pollFriendRequests', () => {
  it('manager 可用时轮询到新入站请求并 emit requestReceived / sync', async () => {
    vi.useFakeTimers()
    setClientWithManager()
    const emit = vi.fn()
    const s = new MatrixFriendSync(emit)
    await s.ensureFriendManager(true)

    mockManager.getIncomingRequests.mockResolvedValue([{ user_id: '@new:example.org', status: 'pending' }])

    await vi.advanceTimersByTimeAsync(30_000)

    expect(emit).toHaveBeenCalledWith('requestReceived', expect.objectContaining({ user_id: '@new:example.org' }))
    expect(emit).toHaveBeenCalledWith('sync', expect.any(Object))
    s.stop()
  })
})
