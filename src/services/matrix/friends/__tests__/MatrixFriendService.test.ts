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

const _server = setupMswServer(
  // Friend endpoints use /_matrix/client/v1/ prefix
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/friends`, () => {
    return HttpResponse.json({ friends: [] })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/friends/:userId/status`, () => {
    return HttpResponse.json({ status: 'friends' })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/friends/search`, () => {
    return HttpResponse.json({ results: [] })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/friends/requests/incoming`, () => {
    return HttpResponse.json({ requests: [] })
  })
)

// Bridge: mock authedRequestWithPath to route through MSW.
// Friend service paths use PREFIX_V1 ('/_matrix/client/v1') — these are full
// paths starting with '/_', so the bridge correctly passes them through to
// fetch without adding a PREFIX_V3.
vi.mock('@/services/matrix/MatrixHttpClient', async () => {
  const actual = await vi.importActual('@/services/matrix/MatrixHttpClient')
  return {
    ...actual,
    authedRequestWithPath: vi.fn(async (_client: unknown, method: string, path: string, body?: unknown) => {
      const url = `${TEST_BASE_URL}${path}`
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }
      const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    })
  }
})

const { default: matrixFriendService } = await import('../MatrixFriendService')
const { matrixSpecialFriendService } = await import('../MatrixSpecialFriendService')
const { synapseFriendExtensionService } = await import('../../extensions/SynapseFriendExtensionService')

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

      await matrixFriendService.setFriendNote('@alice:example.org', 'new note')

      expect(updateFriendNote).toHaveBeenCalledWith('@alice:example.org', 'new note')
      expect(setFriendNote).not.toHaveBeenCalled()
    })

    it('should delegate favorite status to special friend service only', async () => {
      ;(matrixFriendService as unknown as { friendManager: unknown }).friendManager = mockFriendManager

      await matrixFriendService.setFriendStatus('@alice:example.org', 'favorite')

      expect(matrixSpecialFriendService.addSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).not.toHaveBeenCalled()
    })

    it('should remove special friend when restoring normal status', async () => {
      ;(matrixFriendService as unknown as { friendManager: unknown }).friendManager = mockFriendManager

      await matrixFriendService.setFriendStatus('@alice:example.org', 'accepted')

      expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).not.toHaveBeenCalled()
    })

    it('should still delegate non-favorite status updates to friend manager', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        friendManager: mockFriendManager
      } as unknown as MatrixClient)

      await matrixFriendService.setFriendStatus('@alice:example.org', 'blocked')

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

      await matrixFriendService.initialize()
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
          avatar_url: undefined,
          since: 1777851081179,
          status: 'normal',
          dm_room_id: undefined,
          note: undefined
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

      const result = await matrixFriendService.getFriendGroups()

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

      const result = await matrixFriendService.getFriendGroups()

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
