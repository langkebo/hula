/**
 * MatrixAdminService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from '../MatrixAdminService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('should initialize with client', () => {
      const mockManager = {}
      const mockClient = {
        getAdminManager: vi.fn().mockReturnValue(mockManager)
      }

      adminService.initialize(mockClient as any)

      expect(mockClient.getAdminManager).toHaveBeenCalled()
    })
  })

  describe('getUser', () => {
    it('should get user info successfully', async () => {
      const mockUser = {
        user_id: '@user:example.com',
        name: 'Test User',
        avatar_url: null,
        admin: false,
        deactivated: false
      }
      const mockManager = {
        getUser: vi.fn().mockResolvedValue(mockUser)
      }
      const mockClient = {
        getAdminManager: vi.fn().mockReturnValue(mockManager)
      }

      adminService.initialize(mockClient as any)
      const result = await adminService.getUser('@user:example.com')

      expect(result).toEqual({
        userId: '@user:example.com',
        name: 'Test User',
        avatarUrl: null,
        admin: false,
        deactivated: false
      })
    })
  })

  describe('getUsers', () => {
    it('should get users list successfully', async () => {
      const mockUsers = {
        users: [
          { user_id: '@user1:example.com', name: 'User 1' },
          { user_id: '@user2:example.com', name: 'User 2' }
        ],
        next_token: null
      }
      const mockManager = {
        getUsers: vi.fn().mockResolvedValue(mockUsers)
      }
      const mockClient = {
        getAdminManager: vi.fn().mockReturnValue(mockManager)
      }

      adminService.initialize(mockClient as any)
      const result = await adminService.getUsers({ limit: 10 } as any)

      expect(result.users).toHaveLength(2)
    })
  })

  describe('getRoom', () => {
    it('should get room info successfully', async () => {
      const mockRoom = {
        room_id: '!room:example.com',
        name: 'Test Room',
        creator: '@admin:example.com',
        joined_members: 5
      }
      const mockManager = {
        getRoom: vi.fn().mockResolvedValue(mockRoom)
      }
      const mockClient = {
        getAdminManager: vi.fn().mockReturnValue(mockManager)
      }

      adminService.initialize(mockClient as any)
      const result = await adminService.getRoom('!room:example.com')

      expect(result?.roomId).toBe('!room:example.com')
    })
  })

  describe('getRooms', () => {
    it('should get rooms list successfully', async () => {
      const mockRooms = {
        rooms: [
          { room_id: '!room1:example.com', name: 'Room 1' },
          { room_id: '!room2:example.com', name: 'Room 2' }
        ],
        next_batch: null
      }
      const mockManager = {
        getRooms: vi.fn().mockResolvedValue(mockRooms)
      }
      const mockClient = {
        getAdminManager: vi.fn().mockReturnValue(mockManager)
      }

      adminService.initialize(mockClient as any)
      const result = await adminService.getRooms({ limit: 10 } as any)

      expect(result.rooms).toHaveLength(2)
    })
  })

  describe('getServerStats', () => {
    it('should get server stats successfully', async () => {
      const mockStats = {
        room_count: 100,
        user_count: 50,
        daily_active_users: 25,
        total_nonlocal_users: 10,
        server_start_time: 1234567890
      }
      const mockManager = {
        getServerStats: vi.fn().mockResolvedValue(mockStats)
      }
      const mockClient = {
        getAdminManager: vi.fn().mockReturnValue(mockManager)
      }

      adminService.initialize(mockClient as any)
      const result = await adminService.getServerStats()

      expect(result.roomCount).toBe(100)
      expect(result.userCount).toBe(50)
    })
  })
})
