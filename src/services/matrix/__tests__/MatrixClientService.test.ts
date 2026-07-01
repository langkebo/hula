import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset client to null between tests to prevent cross-test contamination
    ;(matrixClientService as unknown as { client: unknown }).client = null
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Also reset client after tests
    ;(matrixClientService as unknown as { client: unknown }).client = null
  })

  describe('initialization', () => {
    it('should not have client initially', () => {
      expect(matrixClientService.getClient()).toBeNull()
    })
  })

  describe('logout', () => {
    it('should handle logout when not logged in', async () => {
      await expect(matrixClientService.logout()).resolves.not.toThrow()
    })
  })

  describe('getConnectionState', () => {
    it('should return DISCONNECTED when client is null', () => {
      expect(matrixClientService.getConnectionState()).toBe('DISCONNECTED')
    })
  })

  describe('getSSOLoginUrl', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixClientService.getSSOLoginUrl()).rejects.toThrow('客户端未初始化')
    })
  })

  describe('getUser', () => {
    it('should return null when client is not initialized', () => {
      expect(matrixClientService.getUser('@user:server')).toBeNull()
    })

    it('should return User when client has the user', () => {
      const mockUser = { userId: '@user:server', presence: 'online' }
      const mockClient = {
        getUser: vi.fn().mockReturnValue(mockUser)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.getUser('@user:server')
      expect(result).toBe(mockUser)
      expect(mockClient.getUser).toHaveBeenCalledWith('@user:server')
    })

    it('should return null when user does not exist', () => {
      const mockClient = {
        getUser: vi.fn().mockReturnValue(null)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.getUser('@nonexistent:server')
      expect(result).toBeNull()
    })
  })

  describe('isRoomEncrypted', () => {
    it('should return false when client is not initialized', () => {
      expect(matrixClientService.isRoomEncrypted('!room:server')).toBe(false)
    })

    it('should return true when room is encrypted', () => {
      const mockClient = {
        isRoomEncrypted: vi.fn().mockReturnValue(true)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.isRoomEncrypted('!room:server')
      expect(result).toBe(true)
      expect(mockClient.isRoomEncrypted).toHaveBeenCalledWith('!room:server')
    })

    it('should return false when room is not encrypted', () => {
      const mockClient = {
        isRoomEncrypted: vi.fn().mockReturnValue(false)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })

    it('should return false when isRoomEncrypted is undefined on client', () => {
      const mockClient = {}
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.isRoomEncrypted('!room:server')
      expect(result).toBe(false)
    })
  })

  describe('canManageSpace', () => {
    it('should return false when client is not initialized', () => {
      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return false when spaceId is empty', () => {
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn()
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('')).toBe(false)
    })

    it('should return false when userId is not available', () => {
      const mockClient = {
        getUserId: vi.fn().mockReturnValue(null),
        getRoom: vi.fn()
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return false when room does not exist', () => {
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(null)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return false when membership is not join', () => {
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('leave'),
        getMember: vi.fn(),
        currentState: { getMember: vi.fn() }
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should return true when user has power level >= 50', () => {
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue({ powerLevel: 100 })
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(true)
    })

    it('should return false when user has power level < 50', () => {
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue({ powerLevel: 0 })
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })

    it('should fallback to currentState.getMember when room.getMember returns null', () => {
      const mockMember = { powerLevel: 50 }
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue(null),
        currentState: { getMember: vi.fn().mockReturnValue(mockMember) }
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(true)
      expect(mockRoom.currentState.getMember).toHaveBeenCalledWith('@user:server')
    })

    it('should return false when member has getPowerLevel method but level < 50', () => {
      const mockMember = { getPowerLevel: vi.fn().mockReturnValue(10) }
      const mockRoom = {
        getMyMembership: vi.fn().mockReturnValue('join'),
        getMember: vi.fn().mockReturnValue(mockMember)
      }
      const mockClient = {
        getUserId: vi.fn().mockReturnValue('@user:server'),
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.canManageSpace('!space:server')).toBe(false)
    })
  })

  describe('getManagerStatsList', () => {
    it('should return empty array when client is not initialized', () => {
      expect(matrixClientService.getManagerStatsList()).toEqual([])
    })

    it('should return empty array when no manager getters match the pattern', () => {
      class EmptyClient {}
      const mockClient = new EmptyClient()
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      expect(matrixClientService.getManagerStatsList()).toEqual([])
    })

    it('should return stats for managers with getRequestStats', () => {
      const mockManager = {
        getRequestStats: vi.fn().mockReturnValue({
          total: 10,
          successful: 8,
          failed: 1,
          retried: 1
        })
      }

      class TestClient {
        getAccountDataManager() {
          return mockManager
        }
      }
      const mockClient = new TestClient()
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([
        {
          name: 'accountData',
          stats: { total: 10, successful: 8, failed: 1, retried: 1 }
        }
      ])
    })

    it('should skip manager getters that are not functions', () => {
      class TestClient {
        getInvalidManager = 'not a function'
      }

      const mockClient = new TestClient()
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([])
    })

    it('should skip managers without getRequestStats', () => {
      const mockManager = { someOtherMethod: vi.fn() }

      class TestClient {
        getFooManager() {
          return mockManager
        }
      }
      const mockClient = new TestClient()
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([])
    })

    it('should handle manager getter that throws gracefully', () => {
      class TestClient {
        getThrowingManager() {
          throw new Error('Boom')
        }
      }
      const mockClient = new TestClient()
      ;(matrixClientService as unknown as { client: unknown }).client = mockClient

      const result = matrixClientService.getManagerStatsList()
      expect(result).toEqual([])
    })
  })
})
