import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
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

describe('MatrixFriendService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should return empty friends list initially', () => {
      const friends = matrixFriendService.getFriends()
      expect(friends).toEqual([])
    })

    it('should return empty incoming requests initially', () => {
      const requests = matrixFriendService.getIncomingRequests()
      expect(requests).toEqual([])
    })

    it('should return empty outgoing requests initially', () => {
      const requests = matrixFriendService.getOutgoingRequests()
      expect(requests).toEqual([])
    })

    it('should return 0 friend count initially', () => {
      const count = matrixFriendService.getFriendCount()
      expect(count).toBe(0)
    })

    it('should return false for isFriend check initially', () => {
      const result = matrixFriendService.isFriend('@user:example.org')
      expect(result).toBe(false)
    })
  })

  describe('getSyncState', () => {
    it('should return current sync state', () => {
      const state = matrixFriendService.getSyncState()
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
})
