import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixRoomService } from '../MatrixRoomService'
import { ApiError } from '../BaseManager'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockGetClient = vi.fn()

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: () => mockGetClient()
  }
}))

function createMockClient(managers: Record<string, any> = {}) {
  return {
    getRoomManager: vi.fn().mockReturnValue(managers.roomManager ?? {}),
    getRoomSettingsManager: vi.fn().mockReturnValue(managers.roomSettingsManager ?? {}),
    getRoomJoiningManager: vi.fn().mockReturnValue(managers.roomJoiningManager ?? {}),
    getRoomCreationManager: vi.fn().mockReturnValue(managers.roomCreationManager ?? {}),
    getDirectMessageManager: vi.fn().mockReturnValue(managers.directMessageManager ?? {}),
    getPushManager: vi.fn().mockReturnValue(managers.pushManager ?? {}),
    getPowerLevelsManager: vi.fn().mockReturnValue(managers.powerLevelsManager ?? {}),
    getRoomSummaryManager: vi.fn().mockReturnValue(managers.roomSummaryManager ?? {})
  }
}

describe('MatrixRoomService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRooms', () => {
    it('should return rooms from manager', async () => {
      const mockRooms = [{ roomId: '!room1' }, { roomId: '!room2' }]
      const client = createMockClient({
        roomManager: { getRooms: vi.fn().mockReturnValue(mockRooms) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getRooms()
      expect(result).toEqual(mockRooms)
    })

    it('should return empty array on error when throwOnError is false', async () => {
      mockGetClient.mockReturnValue(null)

      const result = await matrixRoomService.getRooms(false)
      expect(result).toEqual([])
    })

    it('should throw ApiError when throwOnError is true and client is null', async () => {
      mockGetClient.mockReturnValue(null)

      await expect(matrixRoomService.getRooms(true)).rejects.toThrow(ApiError)
    })
  })

  describe('getRoom', () => {
    it('should return room by id', async () => {
      const mockRoom = { roomId: '!room1' }
      const client = createMockClient({
        roomManager: { getRoom: vi.fn().mockReturnValue(mockRoom) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getRoom('!room1')
      expect(result).toEqual(mockRoom)
    })

    it('should return null when room not found with throwOnError=false', async () => {
      const client = createMockClient({
        roomManager: { getRoom: vi.fn().mockReturnValue(null) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getRoom('!nonexistent', false)
      expect(result).toBeNull()
    })

    it('should throw NotFoundError when room not found and throwOnError is true', async () => {
      const client = createMockClient({
        roomManager: { getRoom: vi.fn().mockReturnValue(null) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.getRoom('!nonexistent', true)).rejects.toThrow()
    })
  })

  describe('createRoom', () => {
    it('should create room successfully', async () => {
      const client = createMockClient({
        roomCreationManager: { createRoom: vi.fn().mockResolvedValue({ room_id: '!newroom' }) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.createRoom({ name: 'Test Room' })
      expect(result.room_id).toBe('!newroom')
    })

    it('should return empty room_id on error when throwOnError is false', async () => {
      const client = createMockClient({
        roomCreationManager: { createRoom: vi.fn().mockRejectedValue(new Error('Failed')) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.createRoom({ name: 'Test' }, false)
      expect(result.room_id).toBe('')
    })
  })

  describe('createDirectRoom', () => {
    it('should create DM room successfully', async () => {
      const client = createMockClient({
        directMessageManager: { createDmRoom: vi.fn().mockResolvedValue('!dmroom') }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.createDirectRoom('@user:example.com')
      expect(result).toBe('!dmroom')
    })

    it('should throw on error when throwOnError is true', async () => {
      const client = createMockClient({
        directMessageManager: { createDmRoom: vi.fn().mockRejectedValue(new Error('Failed')) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.createDirectRoom('@user:example.com', true)).rejects.toThrow()
    })
  })

  describe('joinRoom', () => {
    it('should join room successfully', async () => {
      const mockRoom = { roomId: '!room1' }
      const client = createMockClient({
        roomJoiningManager: { joinRoom: vi.fn().mockResolvedValue(mockRoom) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.joinRoom('!room1')
      expect(result).toEqual(mockRoom)
    })
  })

  describe('leaveRoom', () => {
    it('should leave room successfully', async () => {
      const client = createMockClient({
        roomJoiningManager: { leaveRoom: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.leaveRoom('!room1')).resolves.toBeUndefined()
    })
  })

  describe('getMembers', () => {
    it('should return members from room', async () => {
      const mockMembers = [{ userId: '@user1:example.com' }, { userId: '@user2:example.com' }]
      const mockRoom = {
        getJoinedMembers: vi.fn().mockReturnValue(mockMembers)
      }
      const client = createMockClient({
        roomManager: { getRoom: vi.fn().mockReturnValue(mockRoom) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getMembers('!room1')
      expect(result).toEqual(mockMembers)
    })

    it('should return empty array when room not found with throwOnError=false', async () => {
      const client = createMockClient({
        roomManager: { getRoom: vi.fn().mockReturnValue(null) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getMembers('!nonexistent', false)
      expect(result).toEqual([])
    })
  })

  describe('inviteUser', () => {
    it('should invite user successfully', async () => {
      const client = createMockClient({
        roomJoiningManager: { inviteUser: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.inviteUser('!room1', '@user:example.com')).resolves.toBeUndefined()
    })
  })

  describe('kickUser', () => {
    it('should kick user successfully', async () => {
      const client = createMockClient({
        roomJoiningManager: { kickUser: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.kickUser('!room1', '@user:example.com')).resolves.toBeUndefined()
    })
  })

  describe('banUser', () => {
    it('should ban user successfully', async () => {
      const client = createMockClient({
        roomJoiningManager: { banUser: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.banUser('!room1', '@user:example.com')).resolves.toBeUndefined()
    })
  })

  describe('setRoomName', () => {
    it('should set room name successfully', async () => {
      const client = createMockClient({
        roomSettingsManager: { setRoomName: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.setRoomName('!room1', 'New Name')).resolves.toBeUndefined()
    })
  })

  describe('setRoomTopic', () => {
    it('should set room topic successfully', async () => {
      const client = createMockClient({
        roomSettingsManager: { setRoomTopic: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await expect(matrixRoomService.setRoomTopic('!room1', 'New Topic')).resolves.toBeUndefined()
    })
  })

  describe('getDirectRooms', () => {
    it('should return direct rooms map', async () => {
      const client = createMockClient({
        directMessageManager: {
          getDirectRoomsByUser: vi.fn().mockResolvedValue({
            '@user1:example.com': ['!dm1', '!dm2'],
            '@user2:example.com': ['!dm3']
          })
        }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getDirectRooms()
      expect(result.get('@user1:example.com')).toEqual(['!dm1', '!dm2'])
      expect(result.get('@user2:example.com')).toEqual(['!dm3'])
    })

    it('should return empty map on error with throwOnError=false', async () => {
      const client = createMockClient({
        directMessageManager: { getDirectRoomsByUser: vi.fn().mockRejectedValue(new Error('Failed')) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getDirectRooms(false)
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })
  })

  describe('getRoomSummary', () => {
    it('should return room summary from manager', async () => {
      const client = createMockClient({
        roomSummaryManager: {
          getRoomSummary: vi.fn().mockResolvedValue({
            room_id: '!room1',
            room_type: 'm.space',
            name: 'Test Room',
            topic: 'Test Topic',
            avatar_url: 'mxc://test',
            canonical_alias: '#test:example.com',
            join_rule: 'public',
            history_visibility: 'shared',
            guest_access: 'can_join',
            is_direct: false,
            is_space: true,
            is_encrypted: true,
            member_count: 10,
            joined_member_count: 8,
            invited_member_count: 2,
            heroes: [{ user_id: '@user1:test', display_name: 'User1', avatar_url: 'mxc://u1' }],
            last_event_ts: 1234567890,
            last_message_ts: 1234567891
          })
        }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getRoomSummary('!room1')
      expect(result).toBeDefined()
      expect(result?.roomId).toBe('!room1')
      expect(result?.roomType).toBe('m.space')
      expect(result?.name).toBe('Test Room')
      expect(result?.isPublic).toBe(true)
      expect(result?.isSpace).toBe(true)
      expect(result?.isEncrypted).toBe(true)
      expect(result?.memberCount).toBe(10)
      expect(result?.joinedCount).toBe(8)
      expect(result?.invitedCount).toBe(2)
      expect(result?.historyVisibility).toBe('shared')
      expect(result?.guestAccess).toBe('can_join')
      expect(result?.heroes).toHaveLength(1)
      expect(result?.lastEventTs).toBe(1234567890)
    })

    it('should return null when summary not found', async () => {
      const client = createMockClient({
        roomSummaryManager: { getRoomSummary: vi.fn().mockResolvedValue(null) }
      })
      mockGetClient.mockReturnValue(client)

      const result = await matrixRoomService.getRoomSummary('!nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('setPushRule', () => {
    it('should delete push rule when enabled=true', async () => {
      const client = createMockClient({
        pushManager: { deletePushRule: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await matrixRoomService.setPushRule('!room1', true)
      expect(client.getPushManager().deletePushRule).toHaveBeenCalledWith('global', 'override', '!room1')
    })

    it('should create push rule when enabled=false', async () => {
      const client = createMockClient({
        pushManager: { createPushRule: vi.fn().mockResolvedValue(undefined) }
      })
      mockGetClient.mockReturnValue(client)

      await matrixRoomService.setPushRule('!room1', false)
      expect(client.getPushManager().createPushRule).toHaveBeenCalled()
    })
  })

  describe('throwOnError pattern', () => {
    it('should throw normalized error when throwOnError=true and client not initialized', async () => {
      mockGetClient.mockReturnValue(null)

      try {
        await matrixRoomService.joinRoom('!room1', true)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
      }
    })

    it('should return default value when throwOnError=false and client not initialized', async () => {
      mockGetClient.mockReturnValue(null)

      const result = await matrixRoomService.getRooms(false)
      expect(result).toEqual([])
    })
  })
})
