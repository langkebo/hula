import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetInvitedMembers,
  mockGetBannedMembers,
  mockInviteUser,
  mockKickUser,
  mockBanUser,
  mockUnbanUser,
  mockShowFeedback
} = vi.hoisted(() => ({
  mockGetInvitedMembers: vi.fn(),
  mockGetBannedMembers: vi.fn(),
  mockInviteUser: vi.fn(),
  mockKickUser: vi.fn(),
  mockBanUser: vi.fn(),
  mockUnbanUser: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/room/MembershipService', () => ({
  matrixRoomMembershipService: {
    getInvitedMembers: mockGetInvitedMembers,
    getBannedMembers: mockGetBannedMembers,
    inviteUser: mockInviteUser,
    kickUser: mockKickUser,
    banUser: mockBanUser,
    unbanUser: mockUnbanUser
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

import { useRoomListManagement } from '../useRoomListManagement'

const makeMember = (userId: string, membership: string, name?: string, reason?: string) => ({
  userId,
  name,
  rawDisplayName: name,
  avatarUrl: undefined,
  membership,
  events: reason ? [{ sender: '@admin:s', content: { reason } }] : []
})

describe('useRoomListManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load', () => {
    it('loads invited and banned members in parallel', async () => {
      mockGetInvitedMembers.mockResolvedValueOnce([makeMember('@alice:s', 'invite', 'Alice')])
      mockGetBannedMembers.mockResolvedValueOnce([makeMember('@bob:s', 'ban', 'Bob', 'spam')])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      await flow.load()

      expect(flow.allowlist.value).toHaveLength(1)
      expect(flow.allowlist.value[0].userId).toBe('@alice:s')
      expect(flow.denylist.value).toHaveLength(1)
      expect(flow.denylist.value[0].userId).toBe('@bob:s')
      expect(flow.denylist.value[0].reason).toBe('spam')
      expect(flow.loading.value).toBe(false)
    })

    it('skips loading when roomId is null', async () => {
      const flow = useRoomListManagement({ roomId: null })
      await flow.load()

      expect(mockGetInvitedMembers).not.toHaveBeenCalled()
      expect(mockGetBannedMembers).not.toHaveBeenCalled()
      expect(flow.allowlist.value).toEqual([])
      expect(flow.denylist.value).toEqual([])
    })

    it('sets errorMessage when loading throws', async () => {
      mockGetInvitedMembers.mockRejectedValueOnce(new Error('network'))
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      await flow.load()

      expect(flow.errorMessage.value).toBe('room_advanced.denylist.add_failed')
      expect(flow.loading.value).toBe(false)
    })

    it('maps member to ListMember with fallback name', async () => {
      mockGetInvitedMembers.mockResolvedValueOnce([makeMember('@alice:s', 'invite', undefined)])
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      await flow.load()

      expect(flow.allowlist.value[0].name).toBe('@alice:s')
    })
  })

  describe('computed', () => {
    it('allowlistCount and denylistCount reflect list lengths', async () => {
      mockGetInvitedMembers.mockResolvedValueOnce([makeMember('@a:s', 'invite'), makeMember('@b:s', 'invite')])
      mockGetBannedMembers.mockResolvedValueOnce([makeMember('@c:s', 'ban')])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      await flow.load()

      expect(flow.allowlistCount.value).toBe(2)
      expect(flow.denylistCount.value).toBe(1)
    })

    it('canManage defaults to true when roomId provided', () => {
      const flow = useRoomListManagement({ roomId: '!r:s' })
      expect(flow.canManage.value).toBe(true)
    })

    it('canManage is false when explicitly disabled', () => {
      const flow = useRoomListManagement({ roomId: '!r:s', canManage: false })
      expect(flow.canManage.value).toBe(false)
    })

    it('canManage is false when roomId is null', () => {
      const flow = useRoomListManagement({ roomId: null })
      expect(flow.canManage.value).toBe(false)
    })
  })

  describe('addToAllowlist', () => {
    it('invites user and reloads list', async () => {
      mockInviteUser.mockResolvedValueOnce(undefined)
      mockGetInvitedMembers.mockResolvedValueOnce([makeMember('@new:s', 'invite', 'New')])
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.addToAllowlist('@new:s')

      expect(result).toBe(true)
      expect(mockInviteUser).toHaveBeenCalledWith('!r:s', '@new:s')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.allowlist.user_added', 'success')
      expect(flow.adding.value).toBe(false)
    })

    it('trims whitespace from userId', async () => {
      mockInviteUser.mockResolvedValueOnce(undefined)
      mockGetInvitedMembers.mockResolvedValueOnce([])
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      await flow.addToAllowlist('  @new:s  ')

      expect(mockInviteUser).toHaveBeenCalledWith('!r:s', '@new:s')
    })

    it('returns false when roomId is null', async () => {
      const flow = useRoomListManagement({ roomId: null })
      const result = await flow.addToAllowlist('@new:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.allowlist.add_failed', 'error')
      expect(mockInviteUser).not.toHaveBeenCalled()
    })

    it('returns false when userId is empty', async () => {
      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.addToAllowlist('   ')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.allowlist.add_failed', 'error')
    })

    it('shows error feedback when invite throws', async () => {
      mockInviteUser.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.addToAllowlist('@new:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.allowlist.add_failed', 'error')
      expect(flow.adding.value).toBe(false)
    })
  })

  describe('removeFromAllowlist', () => {
    it('kicks user and reloads list', async () => {
      mockKickUser.mockResolvedValueOnce(undefined)
      mockGetInvitedMembers.mockResolvedValueOnce([])
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.removeFromAllowlist('@alice:s')

      expect(result).toBe(true)
      expect(mockKickUser).toHaveBeenCalledWith('!r:s', '@alice:s')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.allowlist.user_removed', 'success')
      expect(flow.removing.value['@alice:s']).toBe(false)
    })

    it('returns false when roomId is null', async () => {
      const flow = useRoomListManagement({ roomId: null })
      const result = await flow.removeFromAllowlist('@alice:s')

      expect(result).toBe(false)
      expect(mockKickUser).not.toHaveBeenCalled()
    })

    it('shows error feedback when kick throws', async () => {
      mockKickUser.mockRejectedValueOnce(new Error('failed'))

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.removeFromAllowlist('@alice:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.allowlist.remove_failed', 'error')
    })
  })

  describe('addToDenylist', () => {
    it('bans user with reason and reloads list', async () => {
      mockBanUser.mockResolvedValueOnce(undefined)
      mockGetInvitedMembers.mockResolvedValueOnce([])
      mockGetBannedMembers.mockResolvedValueOnce([makeMember('@bad:s', 'ban', 'Bad', 'spam')])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.addToDenylist('@bad:s', 'spam')

      expect(result).toBe(true)
      expect(mockBanUser).toHaveBeenCalledWith('!r:s', '@bad:s', 'spam')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.denylist.user_added', 'success')
    })

    it('passes undefined when reason is empty', async () => {
      mockBanUser.mockResolvedValueOnce(undefined)
      mockGetInvitedMembers.mockResolvedValueOnce([])
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      await flow.addToDenylist('@bad:s', '   ')

      expect(mockBanUser).toHaveBeenCalledWith('!r:s', '@bad:s', undefined)
    })

    it('returns false when roomId is null', async () => {
      const flow = useRoomListManagement({ roomId: null })
      const result = await flow.addToDenylist('@bad:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.denylist.add_failed', 'error')
    })

    it('shows error feedback when ban throws', async () => {
      mockBanUser.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.addToDenylist('@bad:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.denylist.add_failed', 'error')
    })
  })

  describe('removeFromDenylist', () => {
    it('unbans user and reloads list', async () => {
      mockUnbanUser.mockResolvedValueOnce(undefined)
      mockGetInvitedMembers.mockResolvedValueOnce([])
      mockGetBannedMembers.mockResolvedValueOnce([])

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.removeFromDenylist('@bob:s')

      expect(result).toBe(true)
      expect(mockUnbanUser).toHaveBeenCalledWith('!r:s', '@bob:s')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.denylist.user_removed', 'success')
      expect(flow.removing.value['@bob:s']).toBe(false)
    })

    it('returns false when roomId is null', async () => {
      const flow = useRoomListManagement({ roomId: null })
      const result = await flow.removeFromDenylist('@bob:s')

      expect(result).toBe(false)
      expect(mockUnbanUser).not.toHaveBeenCalled()
    })

    it('shows error feedback when unban throws', async () => {
      mockUnbanUser.mockRejectedValueOnce(new Error('failed'))

      const flow = useRoomListManagement({ roomId: '!r:s' })
      const result = await flow.removeFromDenylist('@bob:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.denylist.remove_failed', 'error')
    })
  })
})
