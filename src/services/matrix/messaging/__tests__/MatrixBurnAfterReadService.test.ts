import { error as logError } from '@tauri-apps/plugin-log'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockManager = {
  enableBurn: vi.fn(),
  disableBurn: vi.fn(),
  getBurnSettings: vi.fn(),
  isBurnEnabled: vi.fn(),
  getPendingBurns: vi.fn(),
  markBurnRead: vi.fn(),
  cancelBurn: vi.fn(),
  setBurnConfig: vi.fn(),
  getBurnStats: vi.fn(),
  sendMessage: vi.fn(),
  burnMessage: vi.fn(),
  extendBurnTime: vi.fn()
}

import matrixClientService from '../../MatrixClientService'
import { matrixBurnAfterReadService } from '../MatrixBurnAfterReadService'

describe('MatrixBurnAfterReadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getBurnAfterReadManager: () => mockManager
    } as never)
    mockManager.enableBurn.mockResolvedValue({ enabled: true, burn_after_ms: 60000 })
    mockManager.disableBurn.mockResolvedValue({ enabled: false, burn_after_ms: 60000 })
    mockManager.getBurnSettings.mockResolvedValue({ enabled: true, burn_after_ms: 60000 })
    mockManager.isBurnEnabled.mockResolvedValue(true)
    mockManager.getPendingBurns.mockResolvedValue([])
    mockManager.markBurnRead.mockResolvedValue({ success: true, will_delete_at: Date.now() + 60000 })
    mockManager.cancelBurn.mockResolvedValue({ success: true })
    mockManager.setBurnConfig.mockResolvedValue({ default_burn_ms: 60000 })
    mockManager.getBurnStats.mockResolvedValue({ total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 })
    mockManager.sendMessage.mockResolvedValue({
      event_id: '$test_event',
      expires_in: 60000,
      expires_at: Date.now() + 60000
    })
    mockManager.burnMessage.mockResolvedValue(undefined)
    mockManager.extendBurnTime.mockResolvedValue(undefined)
  })

  describe('enableBurn', () => {
    it('should call SDK enableBurn and return settings', async () => {
      const result = await matrixBurnAfterReadService.enableBurn('!room:test', 60000)
      expect(mockManager.enableBurn).toHaveBeenCalledWith('!room:test', 60000)
      expect(result).toEqual({ enabled: true, burnAfterMs: 60000 })
    })

    it('should return null on error when throwOnError is false', async () => {
      mockManager.enableBurn.mockRejectedValueOnce(new Error('Network error'))
      const result = await matrixBurnAfterReadService.enableBurn('!room:test')
      expect(result).toBeNull()
    })

    it('should throw on error when throwOnError is true', async () => {
      mockManager.enableBurn.mockRejectedValueOnce(new Error('Network error'))
      await expect(matrixBurnAfterReadService.enableBurn('!room:test', undefined, true)).rejects.toThrow()
    })
  })

  describe('disableBurn', () => {
    it('should call SDK disableBurn', async () => {
      const result = await matrixBurnAfterReadService.disableBurn('!room:test')
      expect(mockManager.disableBurn).toHaveBeenCalledWith('!room:test')
      expect(result?.enabled).toBe(false)
    })
  })

  describe('getBurnSettings', () => {
    it('should call SDK getBurnSettings', async () => {
      const result = await matrixBurnAfterReadService.getBurnSettings('!room:test')
      expect(mockManager.getBurnSettings).toHaveBeenCalledWith('!room:test')
      expect(result?.enabled).toBe(true)
    })
  })

  describe('isBurnEnabled', () => {
    it('should return true when burn is enabled', async () => {
      const result = await matrixBurnAfterReadService.isBurnEnabled('!room:test')
      expect(result).toBe(true)
    })

    it('should return false on error when throwOnError is false (default)', async () => {
      mockManager.isBurnEnabled.mockRejectedValueOnce(new Error('Server error'))
      const result = await matrixBurnAfterReadService.isBurnEnabled('!room:test')
      expect(result).toBe(false)
    })

    // FT-131-A: 安全特性 isBurnEnabled 不能静默吞错，必须记录日志以便排查
    it('FT-131-A: 失败时记录 error 日志（不再静默吞错）', async () => {
      vi.mocked(logError).mockClear()
      mockManager.isBurnEnabled.mockRejectedValueOnce(new Error('Server error'))
      await matrixBurnAfterReadService.isBurnEnabled('!room:test')
      expect(logError).toHaveBeenCalled()
      expect(vi.mocked(logError).mock.calls[0][0]).toContain('isBurnEnabled')
    })

    // FT-131-A: 与其他方法一致，支持 throwOnError 选项让调用方可控地传播错误
    it('FT-131-A: throwOnError=true 时向上抛出错误', async () => {
      mockManager.isBurnEnabled.mockRejectedValueOnce(new Error('Server error'))
      await expect(matrixBurnAfterReadService.isBurnEnabled('!room:test', true)).rejects.toThrow('Server error')
    })
  })

  describe('markBurnRead', () => {
    it('should call SDK markBurnRead', async () => {
      const result = await matrixBurnAfterReadService.markBurnRead('!room:test', '$event1')
      expect(mockManager.markBurnRead).toHaveBeenCalledWith('!room:test', '$event1')
      expect(result).toBe(true)
    })
  })

  describe('cancelBurn', () => {
    it('should call SDK cancelBurn', async () => {
      const result = await matrixBurnAfterReadService.cancelBurn('!room:test', '$event1')
      expect(mockManager.cancelBurn).toHaveBeenCalledWith('!room:test', '$event1')
      expect(result).toBe(true)
    })
  })

  describe('getBurnStats', () => {
    it('should call SDK getBurnStats', async () => {
      const result = await matrixBurnAfterReadService.getBurnStats()
      expect(mockManager.getBurnStats).toHaveBeenCalled()
      expect(result).toEqual({ totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 })
    })
  })

  describe('sendMessage', () => {
    it('should call SDK sendMessage with correct params', async () => {
      const content = { body: 'secret', msgtype: 'm.text' }
      const result = await matrixBurnAfterReadService.sendMessage('!room:test', content, 30000, true)
      expect(mockManager.sendMessage).toHaveBeenCalledWith({
        room_id: '!room:test',
        content,
        expires_in: 30000,
        encrypt: true
      })
      expect(result?.eventId).toBe('$test_event')
      expect(result?.expiresIn).toBe(60000)
    })
  })

  describe('burnMessage', () => {
    it('should call SDK burnMessage', async () => {
      const result = await matrixBurnAfterReadService.burnMessage('$event1')
      expect(mockManager.burnMessage).toHaveBeenCalledWith('$event1')
      expect(result).toBe(true)
    })
  })

  describe('extendBurnTime', () => {
    it('should call SDK extendBurnTime', async () => {
      const result = await matrixBurnAfterReadService.extendBurnTime('$event1', 10000)
      expect(mockManager.extendBurnTime).toHaveBeenCalledWith('$event1', 10000)
      expect(result).toBe(true)
    })
  })

  describe('setBurnConfig', () => {
    it('should call SDK setBurnConfig', async () => {
      const result = await matrixBurnAfterReadService.setBurnConfig(45000)
      expect(mockManager.setBurnConfig).toHaveBeenCalledWith(45000)
      expect(result).toBe(60000)
    })
  })

  describe('getPendingBurns', () => {
    it('should call SDK getPendingBurns and map results', async () => {
      mockManager.getPendingBurns.mockResolvedValueOnce([{ event_id: '$ev1', created_at: 1000, delete_at: 61000 }])
      const result = await matrixBurnAfterReadService.getPendingBurns('!room:test')
      expect(result).toEqual([{ eventId: '$ev1', createdAt: 1000, deleteAt: 61000 }])
    })

    it('should return empty array on error', async () => {
      mockManager.getPendingBurns.mockRejectedValueOnce(new Error('error'))
      const result = await matrixBurnAfterReadService.getPendingBurns('!room:test')
      expect(result).toEqual([])
    })
  })
})
