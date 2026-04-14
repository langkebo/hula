/**
 * MatrixDirectMessageService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('MatrixDirectMessageService', () => {
  let matrixDirectMessageService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    matrixDirectMessageService = (await import('../MatrixDirectMessageService')).matrixDirectMessageService
  })

  describe('initialize', () => {
    it('should throw error when client is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixDirectMessageService.initialize()).rejects.toThrow('客户端未初始化')
    })
  })

  describe('getDMRooms', () => {
    it('should return empty array when manager is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)

      const result = await matrixDirectMessageService.getDMRooms()

      expect(result).toEqual([])
    })
  })

  describe('getDmForUser', () => {
    it('should return null when manager is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)

      const result = await matrixDirectMessageService.getDmForUser('@user:example.com')

      expect(result).toBeNull()
    })
  })

  describe('getDmRoomInfo', () => {
    it('should return null when manager is not available', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as any)

      const result = await matrixDirectMessageService.getDmRoomInfo('!room:example.com')

      expect(result).toBeNull()
    })
  })

  describe('getCachedDmRooms', () => {
    it('should return empty array for unknown user', async () => {
      const result = matrixDirectMessageService.getCachedDmRooms('@unknown:example.com')

      expect(result).toEqual([])
    })
  })

  describe('stop', () => {
    it('should stop service', async () => {
      matrixDirectMessageService.stop()

      const result = await matrixDirectMessageService.getDMRooms()
      expect(result).toEqual([])
    })
  })
})
