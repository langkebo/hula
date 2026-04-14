/**
 * MatrixAccountService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixAccountService } from '../MatrixAccountService'
import matrixClientService from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

describe('MatrixAccountService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDevices', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixAccountService.getDevices()).rejects.toThrow('[MatrixAccount] 客户端未初始化')
    })

    it('should return devices list successfully', async () => {
      const mockDevices = [
        { device_id: 'device1', display_name: 'Device 1', last_seen_ts: 1234567890 },
        { device_id: 'device2', display_name: 'Device 2', last_seen_ts: 1234567891 }
      ]
      const mockManager = {
        getDevices: vi.fn().mockResolvedValue(mockDevices)
      }
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(mockManager),
        getUserId: vi.fn().mockReturnValue('@user:example.com')
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.getDevices()

      expect(result).toHaveLength(2)
      expect(result[0].deviceId).toBe('device1')
      expect(result[1].deviceId).toBe('device2')
    })
  })

  describe('getDevice', () => {
    it('should throw error when manager is not available', async () => {
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(null)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      await expect(matrixAccountService.getDevice('device1')).rejects.toThrow('[MatrixAccount] DeviceManager 不可用')
    })

    it('should return device successfully', async () => {
      const mockDevice = {
        device_id: 'device1',
        display_name: 'My Device',
        last_seen_ts: 1234567890
      }
      const mockManager = {
        getDevice: vi.fn().mockResolvedValue(mockDevice)
      }
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(mockManager),
        getUserId: vi.fn().mockReturnValue('@user:example.com')
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.getDevice('device1')
      expect(result).not.toBeNull()
      expect(result!.deviceId).toBe('device1')
      expect(result!.displayName).toBe('My Device')
      expect(mockManager.getDevice).toHaveBeenCalledWith('device1')
    })
  })

  describe('setDeviceName', () => {
    it('should set device name successfully', async () => {
      const mockManager = {
        renameDevice: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(mockManager)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.setDeviceName('device1', 'New Device Name')

      expect(result).toBe(true)
      expect(mockManager.renameDevice).toHaveBeenCalledWith('device1', 'New Device Name')
    })
  })

  describe('deleteDevice', () => {
    it('should delete device successfully', async () => {
      const mockManager = {
        deleteDevice: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(mockManager)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.deleteDevice('device1')

      expect(result).toBe(true)
      expect(mockManager.deleteDevice).toHaveBeenCalledWith('device1', undefined)
    })

    it('should delete device with auth data', async () => {
      const mockManager = {
        deleteDevice: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(mockManager)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
      const authData = { session: 'test-session' }

      const result = await matrixAccountService.deleteDevice('device1', authData)

      expect(result).toBe(true)
      expect(mockManager.deleteDevice).toHaveBeenCalledWith('device1', authData)
    })
  })

  describe('deleteDevices', () => {
    it('should delete multiple devices successfully', async () => {
      const mockManager = {
        deleteDevices: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getDeviceManager: vi.fn().mockReturnValue(mockManager)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.deleteDevices(['device1', 'device2'])

      expect(result).toBe(true)
      expect(mockManager.deleteDevices).toHaveBeenCalledWith({ devices: ['device1', 'device2'], auth: undefined })
    })
  })

  describe('getThreePids', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixAccountService.getThreePids()).rejects.toThrow('[MatrixAccount] 客户端未初始化')
    })

    it('should return threepids successfully', async () => {
      const mockThreepids = {
        threepids: [
          { medium: 'email', address: 'test@example.com', validated_at: 1234567890, added_at: 1234567800 }
        ]
      }
      const mockClient = {
        getThreePids: vi.fn().mockResolvedValue(mockThreepids)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.getThreePids()

      expect(result.threepids).toHaveLength(1)
      expect(result.threepids[0].address).toBe('test@example.com')
    })
  })

  describe('getIgnoredUsers', () => {
    it('should throw error when getAccountDataFromServer throws and throwOnError=true', async () => {
      const mockClient = {
        getAccountDataFromServer: vi.fn().mockRejectedValue(new Error('Not available'))
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      await expect(matrixAccountService.getIgnoredUsers()).rejects.toThrow()
    })

    it('should return empty list when getAccountDataFromServer throws and throwOnError=false', async () => {
      const mockClient = {
        getAccountDataFromServer: vi.fn().mockRejectedValue(new Error('Not available'))
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.getIgnoredUsers(false)

      expect(result).toEqual([])
    })

    it('should return ignored users list successfully', async () => {
      const mockAccountData = {
        ignored_users: [{ user_id: '@user1:example.com' }, { user_id: '@user2:example.com' }]
      }
      const mockClient = {
        getAccountDataFromServer: vi.fn().mockResolvedValue(mockAccountData)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const result = await matrixAccountService.getIgnoredUsers()

      expect(result).toEqual(['@user1:example.com', '@user2:example.com'])
    })
  })

  describe('setIgnoredUsers', () => {
    it('should return false when client is not initialized and throwOnError=false', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const result = await matrixAccountService.setIgnoredUsers(['@user1:example.com'])
      expect(result).toBe(false)
    })

    it('should throw error when client is not initialized and throwOnError=true', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixAccountService.setIgnoredUsers(['@user1:example.com'], true)).rejects.toThrow(
        '[MatrixAccount] 客户端未初始化'
      )
    })
  })
})
