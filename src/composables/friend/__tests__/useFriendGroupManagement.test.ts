import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetFriendGroups,
  mockCreateFriendGroup,
  mockRenameFriendGroup,
  mockDeleteFriendGroup,
  mockAddFriendToGroup,
  mockRemoveFriendFromGroup,
  mockShowFeedback
} = vi.hoisted(() => ({
  mockGetFriendGroups: vi.fn(),
  mockCreateFriendGroup: vi.fn(),
  mockRenameFriendGroup: vi.fn(),
  mockDeleteFriendGroup: vi.fn(),
  mockAddFriendToGroup: vi.fn(),
  mockRemoveFriendFromGroup: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendGroups: mockGetFriendGroups,
    createFriendGroup: mockCreateFriendGroup,
    renameFriendGroup: mockRenameFriendGroup,
    deleteFriendGroup: mockDeleteFriendGroup,
    addFriendToGroup: mockAddFriendToGroup,
    removeFriendFromGroup: mockRemoveFriendFromGroup
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import { useFriendGroupManagement } from '../useFriendGroupManagement'

describe('useFriendGroupManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load', () => {
    it('loads friend groups successfully', async () => {
      mockGetFriendGroups.mockResolvedValueOnce([
        { group_id: 'g1', name: 'Family', member_count: 3 },
        { group_id: 'g2', name: 'Work', member_count: 5 }
      ])

      const flow = useFriendGroupManagement()
      await flow.load()

      expect(flow.groups.value).toHaveLength(2)
      expect(flow.groupCount.value).toBe(2)
      expect(flow.loading.value).toBe(false)
    })

    it('returns empty array when service returns null', async () => {
      mockGetFriendGroups.mockResolvedValueOnce(null)

      const flow = useFriendGroupManagement()
      await flow.load()

      expect(flow.groups.value).toEqual([])
    })

    it('sets errorMessage when load throws', async () => {
      mockGetFriendGroups.mockRejectedValueOnce(new Error('network'))

      const flow = useFriendGroupManagement()
      await flow.load()

      expect(flow.errorMessage.value).toBe('friend.group.load_failed')
      expect(flow.loading.value).toBe(false)
    })

    it('skips load when disabled', async () => {
      const flow = useFriendGroupManagement({ enabled: false })
      await flow.load()

      expect(mockGetFriendGroups).not.toHaveBeenCalled()
      expect(flow.enabled.value).toBe(false)
    })
  })

  describe('createGroup', () => {
    it('creates group and appends to list', async () => {
      mockCreateFriendGroup.mockResolvedValueOnce({ group_id: 'g3', name: 'New Group' })

      const flow = useFriendGroupManagement()
      const result = await flow.createGroup('New Group')

      expect(result).not.toBeNull()
      expect(result?.group_id).toBe('g3')
      expect(flow.groups.value).toHaveLength(1)
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.create_success', 'success')
      expect(flow.creating.value).toBe(false)
    })

    it('trims whitespace from name', async () => {
      mockCreateFriendGroup.mockResolvedValueOnce({ group_id: 'g3', name: 'New' })

      const flow = useFriendGroupManagement()
      await flow.createGroup('  New  ')

      expect(mockCreateFriendGroup).toHaveBeenCalledWith('New')
    })

    it('returns null when name is empty', async () => {
      const flow = useFriendGroupManagement()
      const result = await flow.createGroup('   ')

      expect(result).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.create_failed', 'error')
      expect(mockCreateFriendGroup).not.toHaveBeenCalled()
    })

    it('shows error feedback when create throws', async () => {
      mockCreateFriendGroup.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useFriendGroupManagement()
      const result = await flow.createGroup('New')

      expect(result).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.create_failed', 'error')
    })
  })

  describe('renameGroup', () => {
    it('renames group and updates local list', async () => {
      mockRenameFriendGroup.mockResolvedValueOnce(undefined)
      const groups = [{ group_id: 'g1', name: 'Old' }]
      mockGetFriendGroups.mockResolvedValueOnce(groups)

      const flow = useFriendGroupManagement()
      await flow.load()
      const result = await flow.renameGroup('g1', 'New Name')

      expect(result).toBe(true)
      expect(flow.groups.value[0].name).toBe('New Name')
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.rename_success', 'success')
    })

    it('returns false when name is empty', async () => {
      const flow = useFriendGroupManagement()
      const result = await flow.renameGroup('g1', '   ')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.rename_failed', 'error')
    })

    it('shows error feedback when rename throws', async () => {
      mockRenameFriendGroup.mockRejectedValueOnce(new Error('failed'))

      const flow = useFriendGroupManagement()
      const result = await flow.renameGroup('g1', 'New')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.rename_failed', 'error')
    })
  })

  describe('deleteGroup', () => {
    it('deletes group and removes from local list', async () => {
      mockDeleteFriendGroup.mockResolvedValueOnce(undefined)
      mockGetFriendGroups.mockResolvedValueOnce([
        { group_id: 'g1', name: 'A' },
        { group_id: 'g2', name: 'B' }
      ])

      const flow = useFriendGroupManagement()
      await flow.load()
      const result = await flow.deleteGroup('g1')

      expect(result).toBe(true)
      expect(flow.groups.value).toHaveLength(1)
      expect(flow.groups.value[0].group_id).toBe('g2')
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.delete_success', 'success')
    })

    it('shows error feedback when delete throws', async () => {
      mockDeleteFriendGroup.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useFriendGroupManagement()
      const result = await flow.deleteGroup('g1')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.delete_failed', 'error')
    })
  })

  describe('addFriendToGroup', () => {
    it('adds friend to group and shows success', async () => {
      mockAddFriendToGroup.mockResolvedValueOnce(undefined)

      const flow = useFriendGroupManagement()
      const result = await flow.addFriendToGroup('g1', '@user:s')

      expect(result).toBe(true)
      expect(mockAddFriendToGroup).toHaveBeenCalledWith('g1', '@user:s')
    })

    it('returns false when add throws', async () => {
      mockAddFriendToGroup.mockRejectedValueOnce(new Error('failed'))

      const flow = useFriendGroupManagement()
      const result = await flow.addFriendToGroup('g1', '@user:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.create_failed', 'error')
    })
  })

  describe('removeFriendFromGroup', () => {
    it('removes friend from group and shows success', async () => {
      mockRemoveFriendFromGroup.mockResolvedValueOnce(undefined)

      const flow = useFriendGroupManagement()
      const result = await flow.removeFriendFromGroup('g1', '@user:s')

      expect(result).toBe(true)
      expect(mockRemoveFriendFromGroup).toHaveBeenCalledWith('g1', '@user:s')
    })

    it('returns false when remove throws', async () => {
      mockRemoveFriendFromGroup.mockRejectedValueOnce(new Error('failed'))

      const flow = useFriendGroupManagement()
      const result = await flow.removeFriendFromGroup('g1', '@user:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('friend.group.delete_failed', 'error')
    })
  })
})
