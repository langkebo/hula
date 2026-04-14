/**
 * MatrixPresenceService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixPresenceService } from '../MatrixPresenceService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixPresenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('should initialize with client', () => {
      const mockManager = {}
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPresenceService.initialize(mockClient as any)

      expect(mockClient.getPresenceManager).toHaveBeenCalled()
    })
  })

  describe('setPresence', () => {
    it('should set presence to online successfully', async () => {
      const mockManager = {
        setOnline: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPresenceService.initialize(mockClient as any)
      await matrixPresenceService.setPresence('online', 'Working')

      expect(mockManager.setOnline).toHaveBeenCalledWith('Working')
    })

    it('should set presence to offline successfully', async () => {
      const mockManager = {
        setOffline: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPresenceService.initialize(mockClient as any)
      await matrixPresenceService.setPresence('offline')

      expect(mockManager.setOffline).toHaveBeenCalled()
    })
  })

  describe('getPresence', () => {
    it('should get user presence successfully', async () => {
      const mockPresenceData = {
        presence: 'online',
        status_msg: 'Working',
        last_active_ago: 12345,
        currently_active: true
      }
      const mockManager = {
        getPresence: vi.fn().mockResolvedValue(mockPresenceData)
      }
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(mockManager),
        getUserId: vi.fn().mockReturnValue('@test:example.com')
      }

      matrixPresenceService.initialize(mockClient as any)
      const result = await matrixPresenceService.getPresence('@user:example.com')

      expect(result).toEqual({
        userId: '@user:example.com',
        presence: 'online',
        statusMsg: 'Working',
        lastActiveAgo: 12345,
        currentlyActive: true
      })
    })

    it('should return null when manager is not available with throwOnError=false', async () => {
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(null),
        getPresence: vi.fn().mockRejectedValue(new Error('Failed'))
      }

      matrixPresenceService.initialize(mockClient as any)
      const result = await matrixPresenceService.getPresence('@user:example.com', false)

      expect(result).toBeNull()
    })
  })

  describe('getCachedPresence', () => {
    it('should get cached presence', () => {
      const mockCachedData = {
        presence: 'online',
        status_msg: 'Working'
      }
      const mockManager = {
        getCachedPresence: vi.fn().mockReturnValue(mockCachedData)
      }
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPresenceService.initialize(mockClient as any)
      const result = matrixPresenceService.getCachedPresence('@user:example.com')

      expect(result).toEqual({
        userId: '@user:example.com',
        presence: 'online',
        statusMsg: 'Working',
        lastActiveAgo: undefined,
        currentlyActive: undefined
      })
    })

    it('should return null when manager is not available', () => {
      const mockClient = {
        getPresenceManager: vi.fn().mockReturnValue(null)
      }

      matrixPresenceService.initialize(mockClient as any)
      const result = matrixPresenceService.getCachedPresence('@user:example.com')

      expect(result).toBeNull()
    })
  })
})
