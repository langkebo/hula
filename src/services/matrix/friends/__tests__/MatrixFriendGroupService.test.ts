import { describe, it, expect, vi, beforeEach } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixFriendService } from '../MatrixFriendService'
import type { FriendGroup } from '../MatrixFriendService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixFriendService - Group Management', () => {
  let mockFriendManager: any
  let mockClient: any

  beforeEach(() => {
    mockFriendManager = {
      start: vi.fn(),
      stop: vi.fn(),
      removeAllListeners: vi.fn(),
      on: vi.fn(),
      getFriends: vi.fn().mockResolvedValue([]),
      getIncomingRequests: vi.fn().mockResolvedValue([]),
      getOutgoingRequests: vi.fn().mockResolvedValue([]),
      getFriendGroups: vi.fn(),
      createFriendGroup: vi.fn(),
      deleteFriendGroup: vi.fn(),
      renameFriendGroup: vi.fn(),
      addFriendToGroup: vi.fn(),
      removeFriendFromGroup: vi.fn(),
      getFriendsInGroup: vi.fn(),
      getFriendGroupsByUser: vi.fn(),
      getFriendSuggestions: vi.fn(),
      getFriendStatus: vi.fn()
    }

    mockClient = {
      friendManager: mockFriendManager,
      getUserId: vi.fn(() => '@user:example.com')
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)
  })

  describe('getFriendGroups', () => {
    it('should return friend groups from manager', async () => {
      const groups: FriendGroup[] = [
        { group_id: 'g1', name: 'Family', member_count: 5 },
        { group_id: 'g2', name: 'Work', member_count: 10 }
      ]
      mockFriendManager.getFriendGroups.mockResolvedValue(groups)

      const result = await matrixFriendService.getFriendGroups()

      expect(result).toEqual(groups)
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no groups', async () => {
      mockFriendManager.getFriendGroups.mockResolvedValue(undefined)

      const result = await matrixFriendService.getFriendGroups()

      expect(result).toEqual([])
    })
  })

  describe('createFriendGroup', () => {
    it('should create a new group', async () => {
      const newGroup: FriendGroup = { group_id: 'g3', name: 'School' }
      mockFriendManager.createFriendGroup.mockResolvedValue(newGroup)

      const result = await matrixFriendService.createFriendGroup('School')

      expect(result).toEqual(newGroup)
      expect(mockFriendManager.createFriendGroup).toHaveBeenCalledWith('School')
    })
  })

  describe('deleteFriendGroup', () => {
    it('should delete a group', async () => {
      mockFriendManager.deleteFriendGroup.mockResolvedValue(undefined)

      await matrixFriendService.deleteFriendGroup('g1')

      expect(mockFriendManager.deleteFriendGroup).toHaveBeenCalledWith('g1')
    })
  })

  describe('renameFriendGroup', () => {
    it('should rename a group', async () => {
      mockFriendManager.renameFriendGroup.mockResolvedValue(undefined)

      await matrixFriendService.renameFriendGroup('g1', 'New Name')

      expect(mockFriendManager.renameFriendGroup).toHaveBeenCalledWith('g1', 'New Name')
    })
  })

  describe('addFriendToGroup', () => {
    it('should add friend to group', async () => {
      mockFriendManager.addFriendToGroup.mockResolvedValue(undefined)

      await matrixFriendService.addFriendToGroup('g1', '@friend:example.com')

      expect(mockFriendManager.addFriendToGroup).toHaveBeenCalledWith('g1', '@friend:example.com')
    })
  })

  describe('removeFriendFromGroup', () => {
    it('should remove friend from group', async () => {
      mockFriendManager.removeFriendFromGroup.mockResolvedValue(undefined)

      await matrixFriendService.removeFriendFromGroup('g1', '@friend:example.com')

      expect(mockFriendManager.removeFriendFromGroup).toHaveBeenCalledWith('g1', '@friend:example.com')
    })
  })

  describe('getFriendsInGroup', () => {
    it('should return friends in a group', async () => {
      const friends = [{ userId: '@f1:example.com', name: 'Friend 1' }]
      mockFriendManager.getFriendsInGroup.mockResolvedValue(friends)

      const result = await matrixFriendService.getFriendsInGroup('g1')

      expect(result).toEqual(friends)
    })

    it('should return empty array when no friends', async () => {
      mockFriendManager.getFriendsInGroup.mockResolvedValue(undefined)

      const result = await matrixFriendService.getFriendsInGroup('g1')

      expect(result).toEqual([])
    })
  })

  describe('getFriendGroupsByUser', () => {
    it('should return groups a user belongs to', async () => {
      const groups: FriendGroup[] = [{ group_id: 'g1', name: 'Family' }]
      mockFriendManager.getFriendGroupsByUser.mockResolvedValue(groups)

      const result = await matrixFriendService.getFriendGroupsByUser('@friend:example.com')

      expect(result).toEqual(groups)
    })
  })

  describe('getFriendSuggestions', () => {
    it('should return friend suggestions', async () => {
      const suggestions = [{ user_id: '@s1:example.com', display_name: 'Suggested' }]
      mockFriendManager.getFriendSuggestions.mockResolvedValue(suggestions)

      const result = await matrixFriendService.getFriendSuggestions()

      expect(result).toEqual(suggestions)
    })

    it('should return empty array when no suggestions', async () => {
      mockFriendManager.getFriendSuggestions.mockResolvedValue(undefined)

      const result = await matrixFriendService.getFriendSuggestions()

      expect(result).toEqual([])
    })
  })

  describe('getFriendStatus', () => {
    it('should return friend status', async () => {
      mockFriendManager.getFriendStatus.mockResolvedValue('accepted')

      const result = await matrixFriendService.getFriendStatus('@friend:example.com')

      expect(result).toBe('accepted')
    })

    it('should return null when status unavailable', async () => {
      mockFriendManager.getFriendStatus.mockResolvedValue(undefined)

      const result = await matrixFriendService.getFriendStatus('@friend:example.com')

      expect(result).toBeNull()
    })
  })
})
