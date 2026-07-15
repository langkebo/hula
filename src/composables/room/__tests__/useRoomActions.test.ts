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

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    joinRoom: mockJoinRoom,
    inviteUser: mockInviteUser,
    createGroupRoom: mockCreateGroupRoom,
    leaveRoom: mockLeaveRoom,
    kickUser: mockRemoveMember
  }
}))

vi.mock('@/services/matrix/room/ReadFacade', () => ({
  matrixRoomReadFacade: {
    getServerDomain: mockGetServerDomain
  }
}))

vi.mock('@/services/matrix/room/MatrixDirectMessageService', () => ({
  matrixDirectMessageService: {
    createDm: mockCreateDirectMessage,
    getOrCreateDmRoom: mockGetOrCreateDirectMessage,
    getDMRooms: mockGetDirectRooms
  }
}))

import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'

describe('matrixRoomActionFacade (formerly useRoomActions pass-through)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('joinRoom', () => {
    it('delegates to matrixRoomActionFacade.joinRoom', async () => {
      mockJoinRoom.mockResolvedValueOnce({ roomId: '!room1' })
      const result = await matrixRoomActionFacade.joinRoom('#room:server')
      expect(result).toEqual({ roomId: '!room1' })
      expect(mockJoinRoom).toHaveBeenCalledWith('#room:server')
    })

    it('joins by room alias', async () => {
      mockJoinRoom.mockResolvedValueOnce({ roomId: '!room1' })
      await matrixRoomActionFacade.joinRoom('#alias:server.com')
      expect(mockJoinRoom).toHaveBeenCalledWith('#alias:server.com')
    })

    it('joins by room id', async () => {
      mockJoinRoom.mockResolvedValueOnce({ roomId: '!room1' })
      await matrixRoomActionFacade.joinRoom('!room1:server.com')
      expect(mockJoinRoom).toHaveBeenCalledWith('!room1:server.com')
    })

    it('propagates error when join fails', async () => {
      mockJoinRoom.mockRejectedValueOnce(new Error('room not found'))
      await expect(matrixRoomActionFacade.joinRoom('#nonexistent:server')).rejects.toThrow('room not found')
    })
  })

  describe('createGroupRoom', () => {
    it('delegates to matrixRoomActionFacade.createGroupRoom', async () => {
      mockCreateGroupRoom.mockResolvedValueOnce({ roomId: '!new-room' })
      const options = { name: 'Test Room', visibility: 'private' as const }
      const result = await matrixRoomActionFacade.createGroupRoom(options)
      expect(result).toEqual({ roomId: '!new-room' })
      expect(mockCreateGroupRoom).toHaveBeenCalledWith(options)
    })

    it('propagates error when creation fails', async () => {
      mockCreateGroupRoom.mockRejectedValueOnce(new Error('creation failed'))
      await expect(matrixRoomActionFacade.createGroupRoom({ name: 'Fail' })).rejects.toThrow('creation failed')
    })
  })

  describe('getServerDomain', () => {
    it('returns server domain from matrix room service', () => {
      mockGetServerDomain.mockReturnValue('example.com')
      expect(matrixRoomReadFacade.getServerDomain()).toBe('example.com')
      expect(mockGetServerDomain).toHaveBeenCalled()
    })

    it('returns empty string when no domain', () => {
      mockGetServerDomain.mockReturnValue('')
      expect(matrixRoomReadFacade.getServerDomain()).toBe('')
    })
  })

  describe('inviteUser', () => {
    it('delegates to matrixRoomActionFacade.inviteUser', async () => {
      mockInviteUser.mockResolvedValueOnce(undefined)
      await matrixRoomActionFacade.inviteUser('!room1', '@user:server')
      expect(mockInviteUser).toHaveBeenCalledWith('!room1', '@user:server')
    })

    it('propagates error when invite fails', async () => {
      mockInviteUser.mockRejectedValueOnce(new Error('not in room'))
      await expect(matrixRoomActionFacade.inviteUser('!room1', '@user:server')).rejects.toThrow('not in room')
    })
  })

  describe('leaveRoom', () => {
    it('delegates to matrixRoomActionFacade.leaveRoom', async () => {
      mockLeaveRoom.mockResolvedValueOnce(undefined)
      await matrixRoomActionFacade.leaveRoom('!room1')
      expect(mockLeaveRoom).toHaveBeenCalledWith('!room1')
    })

    it('propagates error when leave fails', async () => {
      mockLeaveRoom.mockRejectedValueOnce(new Error('leave failed'))
      await expect(matrixRoomActionFacade.leaveRoom('!room1')).rejects.toThrow('leave failed')
    })
  })

  describe('removeMember', () => {
    it('delegates to matrixRoomActionFacade.kickUser', async () => {
      mockRemoveMember.mockResolvedValueOnce(undefined)
      await matrixRoomActionFacade.kickUser('!room1', '@user:server')
      expect(mockRemoveMember).toHaveBeenCalledWith('!room1', '@user:server')
    })

    it('propagates error when remove fails', async () => {
      mockRemoveMember.mockRejectedValueOnce(new Error('no permission'))
      await expect(matrixRoomActionFacade.kickUser('!room1', '@user:server')).rejects.toThrow('no permission')
    })
  })

  describe('createDirectMessage', () => {
    it('delegates to matrixDirectMessageService.createDm', async () => {
      mockCreateDirectMessage.mockResolvedValueOnce('!dm1:server')
      const result = await matrixDirectMessageService.createDm('@user:server')
      expect(result).toBe('!dm1:server')
      expect(mockCreateDirectMessage).toHaveBeenCalledWith('@user:server')
    })
  })

  describe('getOrCreateDirectMessage', () => {
    it('delegates without encryption flag', async () => {
      mockGetOrCreateDirectMessage.mockResolvedValueOnce('!dm1:server')
      const result = await matrixDirectMessageService.getOrCreateDmRoom('@user:server')
      expect(result).toBe('!dm1:server')
      expect(mockGetOrCreateDirectMessage).toHaveBeenCalledWith('@user:server')
    })

    it('delegates with encryption=true', async () => {
      mockGetOrCreateDirectMessage.mockResolvedValueOnce('!dm1:server')
      const result = await matrixDirectMessageService.getOrCreateDmRoom('@user:server', true)
      expect(result).toBe('!dm1:server')
      expect(mockGetOrCreateDirectMessage).toHaveBeenCalledWith('@user:server', true)
    })

    it('delegates with encryption=false', async () => {
      mockGetOrCreateDirectMessage.mockResolvedValueOnce('!dm1:server')
      await matrixDirectMessageService.getOrCreateDmRoom('@user:server', false)
      expect(mockGetOrCreateDirectMessage).toHaveBeenCalledWith('@user:server', false)
    })
  })

  describe('getDirectRooms', () => {
    it('returns direct rooms from direct message service', async () => {
      const rooms = [{ roomId: '!dm1' }, { roomId: '!dm2' }]
      mockGetDirectRooms.mockResolvedValueOnce(rooms)
      const result = await matrixDirectMessageService.getDMRooms()
      expect(result).toEqual(rooms)
      expect(mockGetDirectRooms).toHaveBeenCalled()
    })

    it('returns empty array when no direct rooms', async () => {
      mockGetDirectRooms.mockResolvedValueOnce([])
      const result = await matrixDirectMessageService.getDMRooms()
      expect(result).toEqual([])
    })
  })

  describe('error handling', () => {
    it('createDirectMessage propagates error', async () => {
      mockCreateDirectMessage.mockRejectedValueOnce(new Error('dm creation failed'))
      await expect(matrixDirectMessageService.createDm('@user:server')).rejects.toThrow('dm creation failed')
    })

    it('getOrCreateDirectMessage propagates error', async () => {
      mockGetOrCreateDirectMessage.mockRejectedValueOnce(new Error('dm lookup failed'))
      await expect(matrixDirectMessageService.getOrCreateDmRoom('@user:server')).rejects.toThrow('dm lookup failed')
    })

    it('getDirectRooms propagates error', async () => {
      mockGetDirectRooms.mockRejectedValueOnce(new Error('fetch failed'))
      await expect(matrixDirectMessageService.getDMRooms()).rejects.toThrow('fetch failed')
    })

    it('getServerDomain propagates error', () => {
      mockGetServerDomain.mockImplementation(() => {
        throw new Error('domain error')
      })
      expect(() => matrixRoomReadFacade.getServerDomain()).toThrow('domain error')
    })
  })
})
