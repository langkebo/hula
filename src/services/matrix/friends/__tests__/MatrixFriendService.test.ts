import { warn as logWarn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixSpecialFriendService', () => ({
  matrixSpecialFriendService: {
    addSpecialFriend: vi.fn(),
    removeSpecialFriend: vi.fn(),
    getSpecialFriends: vi.fn(async () => [])
  }
}))

vi.mock('../../extensions/SynapseFriendExtensionService', () => ({
  synapseFriendExtensionService: {
    getFriends: vi.fn(async () => []),
    getPendingRequests: vi.fn(async () => ({ incoming: [], outgoing: [] })),
    checkFriendship: vi.fn(async () => false),
    sendFriendRequest: vi.fn(async () => ({})),
    acceptFriendRequest: vi.fn(async () => ({})),
    declineFriendRequest: vi.fn(async () => undefined),
    cancelFriendRequest: vi.fn(async () => undefined),
    removeFriend: vi.fn(async () => undefined),
    setFriendNote: vi.fn(async () => undefined),
    searchFriends: vi.fn(async () => ({ results: [], limited: false }))
  }
}))

const mockFriendManager = {
  start: vi.fn(),
  stop: vi.fn(),
  removeAllListeners: vi.fn(),
  getFriends: vi.fn(() => []),
  getFriend: vi.fn(),
  isFriend: vi.fn(() => false),
  getFriendCount: vi.fn(() => 0),
  getIncomingRequests: vi.fn(() => []),
  getOutgoingRequests: vi.fn(() => []),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  setFriendNote: vi.fn(),
  setFriendStatus: vi.fn(),
  getFriendInfo: vi.fn(),
  sync: vi.fn(),
  on: vi.fn()
}

vi.mock('matrix-js-sdk/friend', () => ({
  FriendManager: vi.fn(() => mockFriendManager),
  FriendEvent: {
    SyncComplete: 'syncComplete',
    FriendAdded: 'friendAdded',
    FriendRemoved: 'friendRemoved',
    FriendUpdated: 'friendUpdated',
    RequestReceived: 'requestReceived',
    RequestSent: 'requestSent',
    RequestAccepted: 'requestAccepted',
    RequestRejected: 'requestRejected',
    RequestCancelled: 'requestCancelled'
  }
}))

const TEST_BASE_URL = 'https://matrix.example.com'

setupMswServer(
  // Friend endpoints use /_matrix/vendor/v1/ prefix
  http.get(`${TEST_BASE_URL}/_matrix/vendor/v1/friends`, () => {
    return HttpResponse.json({ friends: [] })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/vendor/v1/friends/:userId/status`, () => {
    return HttpResponse.json({ status: 'friends' })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/vendor/v1/friends/search`, () => {
    return HttpResponse.json({ results: [] })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/vendor/v1/friends/requests/incoming`, () => {
    return HttpResponse.json({ requests: [] })
  })
)

// Bridge: mock authedRequestWithPath to route through MSW.
// Friend service paths use PREFIX_VENDOR_V1 ('/_matrix/vendor/v1') — these are full
// paths starting with '/_', so the bridge correctly passes them through to
// fetch without adding a PREFIX_V3.
vi.mock('@/services/matrix/MatrixHttpClient', async () => {
  const actual = await vi.importActual('@/services/matrix/MatrixHttpClient')
  return {
    ...actual,
    authedRequestWithPath: vi.fn(async (_client: unknown, method: string, path: string, body?: unknown) => {
      const url = `${TEST_BASE_URL}${path}`
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }
      const bodyInit = body ? JSON.stringify(body) : undefined
      const response = await fetch(url, { method, headers, ...(bodyInit !== undefined ? { body: bodyInit } : {}) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    })
  }
})

const { synapseDmExtensionService } = await import('../../extensions/SynapseDmExtensionService')
const { matrixFriendGroups, matrixFriendOperations, matrixFriendService, matrixFriendSync, streamFriendsPages } =
  await import('../MatrixFriendService')
const { matrixSpecialFriendService } = await import('../MatrixSpecialFriendService')
const { synapseFriendExtensionService } = await import('../../extensions/SynapseFriendExtensionService')
const { bumpFriendsGeneration, clearAllFriendReadErrors, getFriendReadError, getFriendsLoadError } = await import(
  '../friendEvents'
)

describe('MatrixFriendService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixFriendService.stop()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should return empty friends list initially', async () => {
      const friends = await matrixFriendService.getFriends()
      expect(friends).toEqual([])
    })

    it('should return empty incoming requests initially', async () => {
      const requests = await matrixFriendService.getIncomingRequests()
      expect(requests).toEqual([])
    })

    it('should return empty outgoing requests initially', async () => {
      const requests = await matrixFriendService.getOutgoingRequests()
      expect(requests).toEqual([])
    })

    it('should return 0 friend count initially', async () => {
      const count = await matrixFriendService.getFriendCount()
      expect(count).toBe(0)
    })

    it('should return false for isFriend check initially', async () => {
      const result = await matrixFriendService.isFriend('@user:example.org')
      expect(result).toBe(false)
    })
  })

  describe('getSyncState', () => {
    it('should return current sync state', async () => {
      const state = await matrixFriendService.getSyncState()
      expect(state).toHaveProperty('friends')
      expect(state).toHaveProperty('incomingRequests')
      expect(state).toHaveProperty('outgoingRequests')
    })
  })

  describe('event handling', () => {
    it('should register event listener', () => {
      const callback = vi.fn()
      matrixFriendService.on('test', callback)

      expect(() => matrixFriendService.on('test', callback)).not.toThrow()
    })

    it('should remove event listener', () => {
      const callback = vi.fn()
      matrixFriendService.off('test', callback)

      expect(() => matrixFriendService.off('test', callback)).not.toThrow()
    })
  })

  describe('stop', () => {
    it('should stop service without error', () => {
      expect(() => matrixFriendService.stop()).not.toThrow()
    })
  })

  describe('compatibility behaviors', () => {
    it('should prefer updateFriendNote when runtime supports it', async () => {
      const updateFriendNote = vi.fn()
      const setFriendNote = vi.fn()
      const manager = {
        ...mockFriendManager,
        updateFriendNote,
        setFriendNote
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ friendManager: manager } as unknown as MatrixClient)

      await matrixFriendOperations.setFriendNote('@alice:example.org', 'new note')

      expect(updateFriendNote).toHaveBeenCalledWith('@alice:example.org', 'new note')
      expect(setFriendNote).not.toHaveBeenCalled()
    })

    it('should delegate favorite status to special friend service only', async () => {
      ;(matrixFriendService as unknown as { friendManager: unknown }).friendManager = mockFriendManager

      await matrixFriendOperations.setFriendStatus('@alice:example.org', 'favorite')

      expect(matrixSpecialFriendService.addSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).not.toHaveBeenCalled()
    })

    it('should remove special friend when restoring normal status', async () => {
      ;(matrixFriendService as unknown as { friendManager: unknown }).friendManager = mockFriendManager

      await matrixFriendOperations.setFriendStatus('@alice:example.org', 'accepted')

      expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).not.toHaveBeenCalled()
    })

    it('should still delegate non-favorite status updates to friend manager', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        friendManager: mockFriendManager
      } as unknown as MatrixClient)

      await matrixFriendOperations.setFriendStatus('@alice:example.org', 'blocked')

      expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).toHaveBeenCalledWith('@alice:example.org', 'blocked')
    })

    it('should delegate special friends reads to special friend service', async () => {
      vi.mocked(matrixSpecialFriendService.getSpecialFriends).mockResolvedValueOnce(['@alice:example.org'])

      await expect(matrixFriendService.getSpecialFriends()).resolves.toEqual(['@alice:example.org'])
    })

    it('should refresh friend manager when matrix client changes', async () => {
      const oldManager = {
        ...mockFriendManager,
        start: vi.fn(),
        stop: vi.fn(),
        removeAllListeners: vi.fn(),
        getFriends: vi.fn(async () => [{ user_id: '@old:example.org' }]),
        getIncomingRequests: vi.fn(async () => []),
        getOutgoingRequests: vi.fn(async () => []),
        on: vi.fn()
      }
      const newManager = {
        ...mockFriendManager,
        start: vi.fn(),
        stop: vi.fn(),
        removeAllListeners: vi.fn(),
        getFriends: vi.fn(async () => [{ user_id: '@new:example.org' }]),
        getIncomingRequests: vi.fn(async () => []),
        getOutgoingRequests: vi.fn(async () => []),
        on: vi.fn()
      }

      vi.mocked(matrixClientService.getClient)
        .mockReturnValueOnce({ friendManager: oldManager } as unknown as MatrixClient)
        .mockReturnValue({ friendManager: newManager } as unknown as MatrixClient)

      await matrixFriendSync.initialize()
      const friends = await matrixFriendService.getFriends()

      expect(oldManager.start).toHaveBeenCalledTimes(1)
      expect(oldManager.stop).toHaveBeenCalledTimes(1)
      expect(oldManager.removeAllListeners).toHaveBeenCalledTimes(1)
      expect(newManager.start).toHaveBeenCalledTimes(1)
      expect(friends).toEqual([{ user_id: '@new:example.org' }])
    })

    it('falls back to synapse friend api when friend manager returns empty list', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        friendManager: {
          ...mockFriendManager,
          getFriends: vi.fn(async () => []),
          getIncomingRequests: vi.fn(async () => []),
          getOutgoingRequests: vi.fn(async () => []),
          on: vi.fn(),
          start: vi.fn()
        }
      } as unknown as MatrixClient)
      vi.mocked(synapseFriendExtensionService.getFriends).mockResolvedValueOnce([
        {
          user_id: '@ljf:matrix.test',
          displayname: 'ljf',
          username: 'ljf',
          presence: 'online',
          online: true,
          since: 1777851081179,
          status: 'normal'
        }
      ])

      const friends = await matrixFriendService.getFriends()

      expect(synapseFriendExtensionService.getFriends).toHaveBeenCalledTimes(1)
      expect(friends).toEqual([
        expect.objectContaining({
          user_id: '@ljf:matrix.test',
          display_name: 'ljf',
          username: 'ljf',
          presence: 'online',
          online: true
        })
      ])
    })
  })

  // FT-130: getFriendGroups 不应使用冗余的双重类型断言
  describe('getFriendGroups (FT-130: no redundant double assertion)', () => {
    it('返回 manager 的 getFriendGroups 结果', async () => {
      const groups = [
        { id: 'g1', name: '家人' },
        { id: 'g2', name: '同事' }
      ]
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        friendManager: {
          ...mockFriendManager,
          getFriendGroups: vi.fn(async () => groups),
          start: vi.fn(),
          on: vi.fn()
        }
      } as unknown as MatrixClient)

      const result = await matrixFriendGroups.getFriendGroups()

      expect(result).toHaveLength(2)
      expect(result[0].group_id).toBe('g1')
      expect(result[0].name).toBe('家人')
    })

    it('manager 无 getFriendGroups 方法时返回空数组', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        friendManager: {
          ...mockFriendManager,
          start: vi.fn(),
          on: vi.fn()
        }
      } as unknown as MatrixClient)

      const result = await matrixFriendGroups.getFriendGroups()

      expect(result).toEqual([])
    })
  })

  // FT-131-C: getFriendManager 工厂方法抛错时不能静默吞错，必须记录日志
  describe('FT-131-C: manager factory error logging', () => {
    it('getFriendManager() 抛错时记录 warn 日志（不再静默吞错）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getFriendManager: () => {
          throw new Error('friend manager factory boom')
        }
      } as unknown as MatrixClient)

      vi.mocked(logWarn).mockClear()
      await matrixFriendService.getFriends()

      expect(logWarn).toHaveBeenCalled()
      expect(vi.mocked(logWarn).mock.calls[0][0]).toContain('getFriendManager')
    })
  })
})

describe('MatrixFriendService.createFriendDmRoom (B-2)', () => {
  const createPrivateDmSpy = vi.spyOn(synapseDmExtensionService, 'createPrivateDm')

  beforeEach(() => {
    createPrivateDmSpy.mockReset()
    createPrivateDmSpy.mockResolvedValue({ room_id: '!dm:example.com', created: true })
  })

  it('默认显式传 isPrivate=false（普通发消息不能被误标为私密会话）', async () => {
    const roomId = await matrixFriendService.createFriendDmRoom('@bob:example.com')

    expect(roomId).toBe('!dm:example.com')
    // createPrivateDm 的默认参数是 isPrivate=true，漏传就会把普通 DM 打成私密
    expect(createPrivateDmSpy).toHaveBeenCalledWith('@bob:example.com', false)
  })

  it('isPrivate: true 时传 true', async () => {
    await matrixFriendService.createFriendDmRoom('@bob:example.com', { isPrivate: true })
    expect(createPrivateDmSpy).toHaveBeenCalledWith('@bob:example.com', true)
  })

  it('服务端不可用时返回 null，由调用方回落而不抛给 UI', async () => {
    createPrivateDmSpy.mockRejectedValue(new Error('M_UNRECOGNIZED'))

    await expect(matrixFriendService.createFriendDmRoom('@bob:example.com')).resolves.toBeNull()
  })

  it('服务端返回空 room_id 时同样返回 null', async () => {
    createPrivateDmSpy.mockResolvedValue({ room_id: '', created: false })

    await expect(matrixFriendService.createFriendDmRoom('@bob:example.com')).resolves.toBeNull()
  })
})

/**
 * FE-2：好友列表读取的「单飞 + 短 TTL 缓存」。
 *
 * 背景：REST 路径按 200/页串行翻页，而启动阶段 `App.vue` 两处 + 通讯录 store 各读一次
 * ⇒ 请求数 = 页数 × 调用次数。缓存窗口内复用，写操作（bump 代际）立即失效。
 */
describe('MatrixFriendService.getFriends — 缓存与单飞（FE-2）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixFriendService.stop()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.mocked(synapseFriendExtensionService.getFriends).mockResolvedValue([{ user_id: '@alice:hs', since: 1 }] as never)
  })

  it('短窗口内重复读取只打一次后端', async () => {
    const first = await matrixFriendService.getFriends()
    const second = await matrixFriendService.getFriends()

    expect(first.map((f) => f.user_id)).toEqual(['@alice:hs'])
    expect(second).toBe(first) // 同一缓存数组实例，未重新构造
    expect(synapseFriendExtensionService.getFriends).toHaveBeenCalledTimes(1)
  })

  it('并发调用合并为同一次请求（单飞）', async () => {
    const [a, b] = await Promise.all([matrixFriendService.getFriends(), matrixFriendService.getFriends()])

    expect(a).toBe(b)
    expect(synapseFriendExtensionService.getFriends).toHaveBeenCalledTimes(1)
  })

  it('写操作 bump 代际后缓存立即失效', async () => {
    await matrixFriendService.getFriends()
    bumpFriendsGeneration()
    await matrixFriendService.getFriends()

    expect(synapseFriendExtensionService.getFriends).toHaveBeenCalledTimes(2)
  })

  it('invalidateFriendsCache() 后重新读取', async () => {
    await matrixFriendService.getFriends()
    matrixFriendService.invalidateFriendsCache()
    await matrixFriendService.getFriends()

    expect(synapseFriendExtensionService.getFriends).toHaveBeenCalledTimes(2)
  })
})

/**
 * M-3：把「失败」与「空」区分开。
 *
 * 服务层仍 fail-soft 返回 `[]`（不破坏既有调用方），但必须留下降级信号，
 * 否则 UI 只会显示空列表、永远进不了错误态。
 */
describe('MatrixFriendService.getFriends — 降级信号（M-3）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixFriendService.stop()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('REST 读取失败时：返回空列表，但记录降级信号', async () => {
    vi.mocked(synapseFriendExtensionService.getFriends).mockRejectedValue(new Error('HTTP 503'))

    const friends = await matrixFriendService.getFriends()

    expect(friends).toEqual([])
    expect(getFriendsLoadError()).toBeInstanceOf(Error)
    expect(String(getFriendsLoadError())).toContain('503')
  })

  it('下次读取成功后降级信号被清空', async () => {
    vi.mocked(synapseFriendExtensionService.getFriends).mockRejectedValueOnce(new Error('down'))
    await matrixFriendService.getFriends()
    expect(getFriendsLoadError()).not.toBeNull()

    vi.mocked(synapseFriendExtensionService.getFriends).mockResolvedValue([{ user_id: '@a:hs', since: 1 }] as never)
    await matrixFriendService.getFriends()

    expect(getFriendsLoadError()).toBeNull()
  })

  it('真空列表（成功但 0 条）不留降级信号', async () => {
    vi.mocked(synapseFriendExtensionService.getFriends).mockResolvedValue([] as never)

    const friends = await matrixFriendService.getFriends()

    expect(friends).toEqual([])
    expect(getFriendsLoadError()).toBeNull()
  })
})

/**
 * FE-4 / FE-5：静默降级修复。
 *
 * 这三条读路径此前失败时返回 `[]`/`false`，与「真的没有」不可区分：
 * - 申请列表返回 `[]` ⇒ 未读红点被清零、列表被清空（用户以为没人加自己）；
 * - 搜索返回 `[]` ⇒ UI 显示「没搜到人」而不是「搜索失败」；
 * - `isFriend` 返回 `false` ⇒ `contactStateResolver` 判成 stranger 并缓存 5 分钟，
 *   「仅允许联系人」的用户会把真实好友的邀请自动拒掉。
 */
describe('MatrixFriendService — 读失败必须可区分（FE-4/FE-5）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAllFriendReadErrors()
    matrixFriendService.stop()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('getIncomingRequests 失败时抛出并记录 requests 通道信号', async () => {
    vi.mocked(synapseFriendExtensionService.getPendingRequests).mockRejectedValue(new Error('HTTP 503'))

    await expect(matrixFriendService.getIncomingRequests()).rejects.toThrow('503')
    expect(getFriendReadError('requests')).toBeInstanceOf(Error)
  })

  it('getOutgoingRequests 失败时抛出（不再返回空的「已发送」列表）', async () => {
    vi.mocked(synapseFriendExtensionService.getPendingRequests).mockRejectedValue(new Error('HTTP 502'))

    await expect(matrixFriendService.getOutgoingRequests()).rejects.toThrow('502')
    expect(String(getFriendReadError('requests'))).toContain('502')
  })

  it('searchFriendsViaApi 失败时抛出并记录 search 通道信号', async () => {
    vi.mocked(synapseFriendExtensionService.searchFriends).mockRejectedValue(new Error('rate_limited'))

    await expect(matrixFriendService.searchFriendsViaApi('alice')).rejects.toThrow('rate_limited')
    expect(String(getFriendReadError('search'))).toContain('rate_limited')
  })

  it('isFriend 无法确认时抛出（不能返回 false —— 会被判成 confirmed stranger）', async () => {
    vi.mocked(synapseFriendExtensionService.checkFriendship).mockRejectedValue(new Error('network down'))

    await expect(matrixFriendService.isFriend('@a:hs')).rejects.toThrow('network down')
  })

  it('isFriend 在 REST 明确返回 false 时仍是 false（确认不是好友 ≠ 无法确认）', async () => {
    vi.mocked(synapseFriendExtensionService.checkFriendship).mockResolvedValue(false)

    await expect(matrixFriendService.isFriend('@a:hs')).resolves.toBe(false)
  })

  it('stop() 清空全部通道信号（账号切换不残留错误态）', async () => {
    vi.mocked(synapseFriendExtensionService.searchFriends).mockRejectedValue(new Error('x'))
    await expect(matrixFriendService.searchFriendsViaApi('a')).rejects.toThrow()

    matrixFriendService.stop()

    expect(getFriendReadError('search')).toBeNull()
    expect(getFriendReadError('requests')).toBeNull()
  })
})

/**
 * 回归：`streamFriendsPages` 曾经直接传 `synapseFriendExtensionService.getFriendsPage`，
 * 方法引用脱离对象后 `this` 变为 undefined，扩展服务内部读 `this.isFriendEndpointAvailable`
 * 直接抛 TypeError，好友页初始化整体失败（Tab 点进去只有错误态）。
 */
describe('streamFriendsPages — 扩展服务方法必须保留 this', () => {
  it('逐页读取不得因方法引用丢失 this 而抛错', async () => {
    const service = synapseFriendExtensionService as unknown as {
      isFriendEndpointAvailable: boolean
      getFriendsPage: (from?: string) => Promise<{ friends: Array<{ user_id: string }>; nextBatch: string | null }>
    }
    service.isFriendEndpointAvailable = true
    service.getFriendsPage = function (this: typeof service, from?: string) {
      if (!this?.isFriendEndpointAvailable) {
        throw new TypeError("Cannot read properties of undefined (reading 'isFriendEndpointAvailable')")
      }
      return Promise.resolve({ friends: [{ user_id: `@bind${from ?? ''}:hs` }], nextBatch: null })
    }

    const ids: string[] = []
    for await (const page of streamFriendsPages()) {
      ids.push(...page.friends.map((friend) => friend.user_id))
    }

    expect(ids).toEqual(['@bind:hs'])
  })
})
