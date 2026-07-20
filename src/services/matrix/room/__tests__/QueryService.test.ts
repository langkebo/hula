import type { Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixRoomQueryService } from '../QueryService'

function mockRoom(overrides: Partial<Room> = {}): Room {
  return {
    roomId: '!default:server',
    name: 'Default Room',
    getMxcAvatarUrl: vi.fn().mockReturnValue('mxc://server/default'),
    ...overrides
  } as unknown as Room
}

describe('MatrixRoomQueryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  describe('searchGroup', () => {
    it('should return empty array when keyword is empty', async () => {
      const result = await matrixRoomQueryService.searchGroup('')
      expect(result).toEqual([])
    })

    it('should return empty array when keyword is only whitespace', async () => {
      const result = await matrixRoomQueryService.searchGroup('   ')
      expect(result).toEqual([])
    })

    it('should return empty array when client throws (not initialized)', async () => {
      const result = await matrixRoomQueryService.searchGroup('test')
      expect(result).toEqual([])
    })

    it('should return matching rooms filtered by keyword in room name', async () => {
      const room1 = mockRoom({ roomId: '!room1:server', name: 'Test Group' })
      const room2 = mockRoom({ roomId: '!room2:server', name: 'Other Room' })
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([room1, room2])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixRoomQueryService.searchGroup('test')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Group')
      expect(result[0].roomId).toBe('!room1:server')
      expect(result[0].account).toBe('!room1:server')
      expect(result[0].avatar).toBe('mxc://server/default')
    })

    it('should match rooms by roomId when keyword is in roomId', async () => {
      const room1 = mockRoom({ roomId: '!test123:server', name: undefined as unknown as string })
      const room2 = mockRoom({ roomId: '!other:server', name: 'Some Room' })
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([room1, room2])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixRoomQueryService.searchGroup('test123')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('!test123:server')
    })

    it('should perform case-insensitive matching', async () => {
      const room = mockRoom({ roomId: '!MyRoom:server', name: 'UPPERCASE GROUP' })
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([room])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result1 = await matrixRoomQueryService.searchGroup('uppercase')
      expect(result1).toHaveLength(1)
      expect(result1[0].name).toBe('UPPERCASE GROUP')

      const result2 = await matrixRoomQueryService.searchGroup('myroom')
      expect(result2).toHaveLength(1)
      expect(result2[0].name).toBe('UPPERCASE GROUP')
    })

    it('should return empty array when no rooms match', async () => {
      const room = mockRoom({ roomId: '!room:server', name: 'Unrelated' })
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([room])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixRoomQueryService.searchGroup('nonexistent')
      expect(result).toEqual([])
    })

    it('should handle rooms with undefined avatar', async () => {
      const room = mockRoom({
        roomId: '!room:server',
        name: 'Test',
        getMxcAvatarUrl: undefined as unknown as () => string | null
      })
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([room])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixRoomQueryService.searchGroup('test')
      expect(result).toHaveLength(1)
      expect(result[0].avatar).toBeUndefined()
    })

    it('should return empty array when client.getRooms returns empty', async () => {
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixRoomQueryService.searchGroup('test')
      expect(result).toEqual([])
    })

    it('should return all matching rooms when multiple match', async () => {
      const room1 = mockRoom({ roomId: '!room1:server', name: 'Test Group A' })
      const room2 = mockRoom({ roomId: '!room2:server', name: 'Test Group B' })
      const room3 = mockRoom({ roomId: '!room3:server', name: 'Other' })
      const mockClient = {
        getRooms: vi.fn().mockReturnValue([room1, room2, room3])
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixRoomQueryService.searchGroup('test')
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Test Group A')
      expect(result[1].name).toBe('Test Group B')
    })
  })
})
