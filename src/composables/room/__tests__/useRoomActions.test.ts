import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockJoinRoom,
  mockInviteUser,
  mockCreateGroupRoom,
  mockGetServerDomain,
  mockLeaveRoom,
  mockRemoveMember,
  mockCreateDirectMessage,
  mockGetOrCreateDirectMessage,
  mockGetDirectRooms
} = vi.hoisted(() => ({
  mockJoinRoom: vi.fn(),
  mockInviteUser: vi.fn(),
  mockCreateGroupRoom: vi.fn(),
  mockGetServerDomain: vi.fn(),
  mockLeaveRoom: vi.fn(),
  mockRemoveMember: vi.fn(),
  mockCreateDirectMessage: vi.fn(),
  mockGetOrCreateDirectMessage: vi.fn(),
  mockGetDirectRooms: vi.fn()
}))

vi.mock('@/services/matrix/room/MatrixRoomService', () => ({
  matrixRoomService: {
    joinRoom: mockJoinRoom,
    inviteUser: mockInviteUser
  }
}))

vi.mock('@/services/matrix/room/RoomNavigationService', () => ({
  roomNavigationService: {
    createGroupRoom: mockCreateGroupRoom,
    getServerDomain: mockGetServerDomain,
    leaveRoom: mockLeaveRoom,
    removeMember: mockRemoveMember,
    createDirectMessage: mockCreateDirectMessage,
    getOrCreateDirectMessage: mockGetOrCreateDirectMessage,
    getDirectRooms: mockGetDirectRooms
  }
}))

import { useRoomActions } from '../useRoomActions'

describe('useRoomActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('joinRoom', () => {
    it('delegates to matrixRoomService.joinRoom', async () => {
      mockJoinRoom.mockResolvedValueOnce({ roomId: '!room1' })
      const { joinRoom } = useRoomActions()
      const result = await joinRoom('#room:server')
      expect(result).toEqual({ roomId: '!room1' })
      expect(mockJoinRoom).toHaveBeenCalledWith('#room:server')
    })

    it('joins by room alias', async () => {
      mockJoinRoom.mockResolvedValueOnce({ roomId: '!room1' })
      const { joinRoom } = useRoomActions()
      await joinRoom('#alias:server.com')
      expect(mockJoinRoom).toHaveBeenCalledWith('#alias:server.com')
    })

    it('joins by room id', async () => {
      mockJoinRoom.mockResolvedValueOnce({ roomId: '!room1' })
      const { joinRoom } = useRoomActions()
      await joinRoom('!room1:server.com')
      expect(mockJoinRoom).toHaveBeenCalledWith('!room1:server.com')
    })

    it('propagates error when join fails', async () => {
      mockJoinRoom.mockRejectedValueOnce(new Error('room not found'))
      const { joinRoom } = useRoomActions()
      await expect(joinRoom('#nonexistent:server')).rejects.toThrow('room not found')
    })
  })

  describe('createGroupRoom', () => {
    it('delegates to roomNavigationService.createGroupRoom', async () => {
      mockCreateGroupRoom.mockResolvedValueOnce({ roomId: '!new-room' })
      const { createGroupRoom } = useRoomActions()
      const options = { name: 'Test Room', visibility: 'private' as const }
      const result = await createGroupRoom(options)
      expect(result).toEqual({ roomId: '!new-room' })
      expect(mockCreateGroupRoom).toHaveBeenCalledWith(options)
    })

    it('propagates error when creation fails', async () => {
      mockCreateGroupRoom.mockRejectedValueOnce(new Error('creation failed'))
      const { createGroupRoom } = useRoomActions()
      await expect(createGroupRoom({ name: 'Fail' })).rejects.toThrow('creation failed')
    })
  })

  describe('getServerDomain', () => {
    it('returns server domain from navigation service', () => {
      mockGetServerDomain.mockReturnValue('example.com')
      const { getServerDomain } = useRoomActions()
      expect(getServerDomain()).toBe('example.com')
      expect(mockGetServerDomain).toHaveBeenCalled()
    })

    it('returns empty string when no domain', () => {
      mockGetServerDomain.mockReturnValue('')
      const { getServerDomain } = useRoomActions()
      expect(getServerDomain()).toBe('')
    })
  })

  describe('inviteUser', () => {
    it('delegates to matrixRoomService.inviteUser', async () => {
      mockInviteUser.mockResolvedValueOnce(undefined)
      const { inviteUser } = useRoomActions()
      await inviteUser('!room1', '@user:server')
      expect(mockInviteUser).toHaveBeenCalledWith('!room1', '@user:server')
    })

    it('propagates error when invite fails', async () => {
      mockInviteUser.mockRejectedValueOnce(new Error('not in room'))
      const { inviteUser } = useRoomActions()
      await expect(inviteUser('!room1', '@user:server')).rejects.toThrow('not in room')
    })
  })

  describe('leaveRoom', () => {
    it('delegates to roomNavigationService.leaveRoom', async () => {
      mockLeaveRoom.mockResolvedValueOnce(undefined)
      const { leaveRoom } = useRoomActions()
      await leaveRoom('!room1')
      expect(mockLeaveRoom).toHaveBeenCalledWith('!room1')
    })

    it('propagates error when leave fails', async () => {
      mockLeaveRoom.mockRejectedValueOnce(new Error('leave failed'))
      const { leaveRoom } = useRoomActions()
      await expect(leaveRoom('!room1')).rejects.toThrow('leave failed')
    })
  })

  describe('removeMember', () => {
    it('delegates to roomNavigationService.removeMember', async () => {
      mockRemoveMember.mockResolvedValueOnce(undefined)
      const { removeMember } = useRoomActions()
      await removeMember('!room1', '@user:server')
      expect(mockRemoveMember).toHaveBeenCalledWith('!room1', '@user:server')
    })

    it('propagates error when remove fails', async () => {
      mockRemoveMember.mockRejectedValueOnce(new Error('no permission'))
      const { removeMember } = useRoomActions()
      await expect(removeMember('!room1', '@user:server')).rejects.toThrow('no permission')
    })
  })

  describe('createDirectMessage', () => {
    it('delegates to roomNavigationService.createDirectMessage', async () => {
      mockCreateDirectMessage.mockResolvedValueOnce({ roomId: '!dm1' })
      const { createDirectMessage } = useRoomActions()
      const result = await createDirectMessage('@user:server')
      expect(result).toEqual({ roomId: '!dm1' })
      expect(mockCreateDirectMessage).toHaveBeenCalledWith('@user:server')
    })
  })

  describe('getOrCreateDirectMessage', () => {
    it('delegates without encryption flag', async () => {
      mockGetOrCreateDirectMessage.mockResolvedValueOnce({ roomId: '!dm1' })
      const { getOrCreateDirectMessage } = useRoomActions()
      const result = await getOrCreateDirectMessage('@user:server')
      expect(result).toEqual({ roomId: '!dm1' })
      expect(mockGetOrCreateDirectMessage).toHaveBeenCalledWith('@user:server', undefined)
    })

    it('delegates with encryption=true', async () => {
      mockGetOrCreateDirectMessage.mockResolvedValueOnce({ roomId: '!dm1' })
      const { getOrCreateDirectMessage } = useRoomActions()
      const result = await getOrCreateDirectMessage('@user:server', true)
      expect(result).toEqual({ roomId: '!dm1' })
      expect(mockGetOrCreateDirectMessage).toHaveBeenCalledWith('@user:server', true)
    })

    it('delegates with encryption=false', async () => {
      mockGetOrCreateDirectMessage.mockResolvedValueOnce({ roomId: '!dm1' })
      const { getOrCreateDirectMessage } = useRoomActions()
      await getOrCreateDirectMessage('@user:server', false)
      expect(mockGetOrCreateDirectMessage).toHaveBeenCalledWith('@user:server', false)
    })
  })

  describe('getDirectRooms', () => {
    it('returns direct rooms from navigation service', async () => {
      const rooms = [{ roomId: '!dm1' }, { roomId: '!dm2' }]
      mockGetDirectRooms.mockResolvedValueOnce(rooms)
      const { getDirectRooms } = useRoomActions()
      const result = await getDirectRooms()
      expect(result).toEqual(rooms)
      expect(mockGetDirectRooms).toHaveBeenCalled()
    })

    it('returns empty array when no direct rooms', async () => {
      mockGetDirectRooms.mockResolvedValueOnce([])
      const { getDirectRooms } = useRoomActions()
      const result = await getDirectRooms()
      expect(result).toEqual([])
    })
  })

  describe('error handling', () => {
    it('createDirectMessage propagates error', async () => {
      mockCreateDirectMessage.mockRejectedValueOnce(new Error('dm creation failed'))
      const { createDirectMessage } = useRoomActions()
      await expect(createDirectMessage('@user:server')).rejects.toThrow('dm creation failed')
    })

    it('getOrCreateDirectMessage propagates error', async () => {
      mockGetOrCreateDirectMessage.mockRejectedValueOnce(new Error('dm lookup failed'))
      const { getOrCreateDirectMessage } = useRoomActions()
      await expect(getOrCreateDirectMessage('@user:server')).rejects.toThrow('dm lookup failed')
    })

    it('getDirectRooms propagates error', async () => {
      mockGetDirectRooms.mockRejectedValueOnce(new Error('fetch failed'))
      const { getDirectRooms } = useRoomActions()
      await expect(getDirectRooms()).rejects.toThrow('fetch failed')
    })

    it('getServerDomain propagates error', () => {
      mockGetServerDomain.mockImplementation(() => {
        throw new Error('domain error')
      })
      const { getServerDomain } = useRoomActions()
      expect(() => getServerDomain()).toThrow('domain error')
    })
  })
})
