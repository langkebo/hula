/**
 * MatrixRoomAccountDataService 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MatrixRoomAccountDataService from '../MatrixRoomAccountDataService'
import matrixClientService from '../MatrixClientService'

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixRoomAccountDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getRoomNote', () => {
    it('应该成功获取房间备注', async () => {
      const mockNote = {
        content: '测试备注',
        updated_at: Date.now()
      }

      const mockClient = {
        getAccountDataManager: vi.fn().mockReturnValue({
          getRoomAccountDataFromServer: vi.fn().mockResolvedValue(mockNote)
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixRoomAccountDataService.getRoomNote('!test:example.com')

      expect(result).toEqual(mockNote)
    })

    it('应该在无备注时返回 null', async () => {
      const mockClient = {
        getAccountDataManager: vi.fn().mockReturnValue({
          getRoomAccountDataFromServer: vi.fn().mockResolvedValue(null)
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixRoomAccountDataService.getRoomNote('!test:example.com')

      expect(result).toBeNull()
    })
  })

  describe('setRoomNote', () => {
    it('应该成功设置房间备注', async () => {
      const mockClient = {
        getAccountDataManager: vi.fn().mockReturnValue({
          getRoomAccountDataFromServer: vi.fn().mockResolvedValue(null)
        }),
        setRoomAccountData: vi.fn().mockResolvedValue(undefined)
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixRoomAccountDataService.setRoomNote('!test:example.com', '新备注')

      expect(result).toBe(true)
      expect(mockClient.setRoomAccountData).toHaveBeenCalled()
    })
  })

  describe('getReadPosition', () => {
    it('应该成功获取阅读位置', async () => {
      const mockPosition = {
        event_id: '$event123',
        updated_at: Date.now()
      }

      const mockClient = {
        getAccountDataManager: vi.fn().mockReturnValue({
          getRoomAccountDataFromServer: vi.fn().mockResolvedValue(mockPosition)
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixRoomAccountDataService.getReadPosition('!test:example.com')

      expect(result).toEqual(mockPosition)
    })
  })

  describe('setReadPosition', () => {
    it('应该成功设置阅读位置', async () => {
      const mockClient = {
        getAccountDataManager: vi.fn().mockReturnValue({
          getRoomAccountDataFromServer: vi.fn().mockResolvedValue(null)
        }),
        setRoomAccountData: vi.fn().mockResolvedValue(undefined)
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await MatrixRoomAccountDataService.setReadPosition('!test:example.com', '$event123')

      expect(result).toBe(true)
    })
  })
})
