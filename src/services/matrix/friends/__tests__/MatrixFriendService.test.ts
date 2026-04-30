import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

vi.mock('../MatrixSpecialFriendService', () => ({
  matrixSpecialFriendService: {
    addSpecialFriend: vi.fn(),
    removeSpecialFriend: vi.fn(),
    getSpecialFriends: vi.fn(async () => [])
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

const { default: matrixFriendService } = await import('../MatrixFriendService')
const { default: matrixClientService } = await import('../../MatrixClientService')
const { matrixSpecialFriendService } = await import('../MatrixSpecialFriendService')

describe('MatrixFriendService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixFriendService.stop()
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
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
      vi.mocked(matrixClientService.getClient).mockReturnValue({ friendManager: manager } as any)

      await matrixFriendService.setFriendNote('@alice:example.org', 'new note')

      expect(updateFriendNote).toHaveBeenCalledWith('@alice:example.org', 'new note')
      expect(setFriendNote).not.toHaveBeenCalled()
    })

    it('should delegate favorite status to special friend service only', async () => {
      ;(matrixFriendService as any).friendManager = mockFriendManager

      await matrixFriendService.setFriendStatus('@alice:example.org', 'favorite')

      expect(matrixSpecialFriendService.addSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).not.toHaveBeenCalled()
    })

    it('should remove special friend when restoring normal status', async () => {
      ;(matrixFriendService as any).friendManager = mockFriendManager

      await matrixFriendService.setFriendStatus('@alice:example.org', 'accepted')

      expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
      expect(mockFriendManager.setFriendStatus).not.toHaveBeenCalled()
    })

    it('should still delegate non-favorite status updates to friend manager', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ friendManager: mockFriendManager } as any)

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
        .mockReturnValueOnce({ friendManager: oldManager } as any)
        .mockReturnValue({ friendManager: newManager } as any)

      await matrixFriendService.initialize()
      const friends = await matrixFriendService.getFriends()

      expect(oldManager.start).toHaveBeenCalledTimes(1)
      expect(oldManager.stop).toHaveBeenCalledTimes(1)
      expect(oldManager.removeAllListeners).toHaveBeenCalledTimes(1)
      expect(newManager.start).toHaveBeenCalledTimes(1)
      expect(friends).toEqual([{ user_id: '@new:example.org' }])
    })
  })
})
