import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixSpaceService } from '../MatrixSpaceService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { mockGetClient } = vi.hoisted(() => ({
  mockGetClient: vi.fn()
}))

vi.mock('../MatrixClientService', () => {
  const mockService = {
    getClient: mockGetClient
  }
  return {
    matrixClientService: mockService,
    default: mockService
  }
})

describe('MatrixSpaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSpace', () => {
    it('should create space successfully', async () => {
      const mockSpace = {
        space_id: '!space:example.com',
        name: 'Test Space'
      }
      const mockManager = {
        createSpace: vi.fn().mockResolvedValue(mockSpace),
        getSpaceStats: vi.fn().mockResolvedValue({ member_count: 0, child_count: 0 })
      }
      const mockClient = {
        getSpaceManager: vi.fn().mockReturnValue(mockManager)
      }

      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixSpaceService.createSpace({
        name: 'Test Space',
        topic: 'Test topic'
      })

      expect(result).toBeDefined()
      expect(result?.spaceId).toBe('!space:example.com')
    })
  })

  describe('getSpaceChildren', () => {
    it('should get space children successfully', async () => {
      const mockChildren = [
        { room_id: '!room1:example.com', name: 'Room 1' },
        { room_id: '!room2:example.com', name: 'Room 2' }
      ]
      const mockManager = {
        getSpaceChildren: vi.fn().mockResolvedValue(mockChildren)
      }
      const mockClient = {
        getSpaceManager: vi.fn().mockReturnValue(mockManager)
      }

      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixSpaceService.getSpaceChildren('!space:example.com')

      expect(result).toEqual(mockChildren)
    })
  })

  describe('isSpace', () => {
    it('should check if room is space', async () => {
      const mockManager = {
        isSpace: vi.fn().mockResolvedValue(true)
      }
      const mockClient = {
        getSpaceManager: vi.fn().mockReturnValue(mockManager)
      }

      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixSpaceService.isSpace('!room:example.com')

      expect(result).toBe(true)
    })
  })
})
