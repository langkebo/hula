import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClientExtended } from '@/types/matrix-extensions'
import matrixClientService from '../../MatrixClientService'
import type { Device } from '../MatrixDeviceService'
import { matrixDeviceService } from '../MatrixDeviceService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixDeviceService', () => {
  let mockClient: Partial<MatrixClient>
  let mockDeviceManager: {
    getDevices: ReturnType<typeof vi.fn>
    getDevice: ReturnType<typeof vi.fn>
    updateDevice: ReturnType<typeof vi.fn>
    deleteDevice: ReturnType<typeof vi.fn>
    deleteDevices: ReturnType<typeof vi.fn>
    getDeviceListUpdates: ReturnType<typeof vi.fn>
  }
  let mockRoomKeysManager: {
    getRoomKeyRequests: ReturnType<typeof vi.fn>
    deleteRoomKeyRequest: ReturnType<typeof vi.fn>
  }
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  const authedRequestImpl = vi
    .fn()
    .mockImplementation(async (method: string, path: string, _queryParams?: unknown, body?: unknown) => {
      const prefixedPath = path.startsWith('/_') ? path : `${PREFIX_V3}${path}`
      const url = `${TEST_BASE_URL}${prefixedPath}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token'
      }
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })

  beforeEach(() => {
    vi.clearAllMocks()

    mockDeviceManager = {
      getDevices: vi.fn(),
      getDevice: vi.fn(),
      updateDevice: vi.fn(),
      deleteDevice: vi.fn(),
      deleteDevices: vi.fn(),
      getDeviceListUpdates: vi.fn()
    }

    mockRoomKeysManager = {
      getRoomKeyRequests: vi.fn(),
      deleteRoomKeyRequest: vi.fn()
    }

    mockHttp = { authedRequest: authedRequestImpl }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      getDeviceManager: vi.fn(
        () => mockDeviceManager as unknown as MatrixClientExtended['getDeviceManager'] extends () => infer T ? T : never
      ),
      getRoomKeysManager: vi.fn(() => mockRoomKeysManager),
      getDeviceId: vi.fn(() => 'CURRENT_DEVICE')
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
  })

  describe('getDevices', () => {
    it('应该通过 DeviceManager 获取设备列表', async () => {
      const mockDevices: Device[] = [
        { device_id: 'DEVICE1', display_name: 'Device 1', verified: true },
        { device_id: 'DEVICE2', display_name: 'Device 2', verified: false }
      ]

      mockDeviceManager.getDevices.mockResolvedValue(mockDevices)

      const devices = await matrixDeviceService.getDevices()

      expect(devices).toEqual(mockDevices)
      expect(mockDeviceManager.getDevices).toHaveBeenCalled()
    })

    it('应该在 DeviceManager 不可用时抛出错误', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      await expect(matrixDeviceService.getDevices()).rejects.toThrow('DeviceManager not available')
    })

    it('应该处理获取失败', async () => {
      mockDeviceManager.getDevices.mockRejectedValue(new Error('Network error'))

      await expect(matrixDeviceService.getDevices()).rejects.toThrow('Network error')
    })
  })

  describe('getDevice', () => {
    it('应该获取单个设备详情', async () => {
      const mockDevice: Device = {
        device_id: 'DEVICE1',
        display_name: 'My Device',
        last_seen_ts: Date.now(),
        last_seen_ip: '192.168.1.1',
        verified: true
      }

      mockDeviceManager.getDevice.mockResolvedValue(mockDevice)

      const device = await matrixDeviceService.getDevice('DEVICE1')

      expect(device).toEqual(mockDevice)
      expect(mockDeviceManager.getDevice).toHaveBeenCalledWith('DEVICE1')
    })

    it('应该在 DeviceManager 不可用时抛出错误', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      await expect(matrixDeviceService.getDevice('DEVICE1')).rejects.toThrow('DeviceManager not available')
    })
  })

  describe('updateDevice', () => {
    it('应该更新设备显示名称', async () => {
      mockDeviceManager.updateDevice.mockResolvedValue(undefined)

      const result = await matrixDeviceService.updateDevice('DEVICE1', 'New Name')

      expect(result.device_id).toBe('DEVICE1')
      expect(result.display_name).toBe('New Name')
      expect(mockDeviceManager.updateDevice).toHaveBeenCalledWith('DEVICE1', { display_name: 'New Name' })
    })

    it('应该在 DeviceManager 不可用时抛出错误', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      await expect(matrixDeviceService.updateDevice('DEVICE1', 'New Name')).rejects.toThrow(
        'DeviceManager not available'
      )
    })

    it('应该拒绝超过 100 字符的设备名称', async () => {
      const longName = 'a'.repeat(101)

      await expect(matrixDeviceService.updateDevice('DEVICE1', longName)).rejects.toThrow('设备名称不能超过 100 个字符')
    })
  })

  describe('deleteDevice', () => {
    it('应该删除单个设备', async () => {
      mockDeviceManager.deleteDevice.mockResolvedValue(undefined)

      await matrixDeviceService.deleteDevice('DEVICE1')

      expect(mockDeviceManager.deleteDevice).toHaveBeenCalledWith('DEVICE1', undefined)
    })

    it('应该使用认证信息删除设备', async () => {
      const auth = { type: 'm.login.password', password: 'secret' }
      mockDeviceManager.deleteDevice.mockResolvedValue(undefined)

      await matrixDeviceService.deleteDevice('DEVICE1', auth)

      expect(mockDeviceManager.deleteDevice).toHaveBeenCalledWith('DEVICE1', auth)
    })

    it('应该在 DeviceManager 不可用时抛出错误', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      await expect(matrixDeviceService.deleteDevice('DEVICE1')).rejects.toThrow('DeviceManager not available')
    })

    it('应该防止删除当前设备', () => {
      const currentDeviceId = 'CURRENT_DEVICE'

      const isCurrentDevice = matrixDeviceService.isCurrentDevice(currentDeviceId)

      expect(isCurrentDevice).toBe(true)
    })
  })

  describe('deleteDevices', () => {
    it('应该批量删除设备', async () => {
      const deviceIds = ['DEVICE1', 'DEVICE2', 'DEVICE3']
      mockDeviceManager.deleteDevices.mockResolvedValue(undefined)

      await matrixDeviceService.deleteDevices(deviceIds)

      expect(mockDeviceManager.deleteDevices).toHaveBeenCalledWith(deviceIds, undefined)
    })

    it('应该使用认证信息批量删除设备', async () => {
      const deviceIds = ['DEVICE1', 'DEVICE2']
      const auth = { type: 'm.login.password', password: 'secret' }

      mockDeviceManager.deleteDevices.mockResolvedValue(undefined)

      await matrixDeviceService.deleteDevices(deviceIds, auth)

      expect(mockDeviceManager.deleteDevices).toHaveBeenCalledWith(deviceIds, auth)
    })

    it('应该在 DeviceManager 不可用时抛出错误', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      await expect(matrixDeviceService.deleteDevices(['DEVICE1'])).rejects.toThrow('DeviceManager not available')
    })
  })

  describe('getCurrentDeviceId', () => {
    it('应该返回当前设备ID', () => {
      const deviceId = matrixDeviceService.getCurrentDeviceId()

      expect(deviceId).toBe('CURRENT_DEVICE')
    })

    it('应该在客户端未初始化时返回 null', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const deviceId = matrixDeviceService.getCurrentDeviceId()

      expect(deviceId).toBeNull()
    })
  })

  describe('isCurrentDevice', () => {
    it('应该正确识别当前设备', () => {
      expect(matrixDeviceService.isCurrentDevice('CURRENT_DEVICE')).toBe(true)
      expect(matrixDeviceService.isCurrentDevice('OTHER_DEVICE')).toBe(false)
    })
  })

  describe('getDeviceListUpdates', () => {
    it('应该获取设备列表变更', async () => {
      const request = {
        users: ['@user1:example.com', '@user2:example.com'],
        since: 'token123'
      }

      const mockResponse = {
        changed: ['@user1:example.com'],
        left: [],
        stream_id: 456
      }

      mockDeviceManager.getDeviceListUpdates.mockResolvedValue(mockResponse)

      const updates = await matrixDeviceService.getDeviceListUpdates(request)

      expect(updates).toEqual(mockResponse)
      expect(mockDeviceManager.getDeviceListUpdates).toHaveBeenCalledWith(request.users, request.since)
    })

    it('应该在 DeviceManager 不可用时抛出错误', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)
      const request = {
        users: ['@user1:example.com']
      }

      await expect(matrixDeviceService.getDeviceListUpdates(request)).rejects.toThrow('DeviceManager not available')
    })
  })

  describe('getRoomKeyRequests', () => {
    it('应该通过 RoomKeysManager 获取密钥请求列表', async () => {
      mockRoomKeysManager.getRoomKeyRequests.mockResolvedValue({ requests: [{ request_id: 'REQ1' }] })

      const requests = await matrixDeviceService.getRoomKeyRequests()

      expect(requests).toEqual([{ request_id: 'REQ1' }])
      expect(mockRoomKeysManager.getRoomKeyRequests).toHaveBeenCalled()
    })

    it('应该在失败时返回空数组', async () => {
      mockRoomKeysManager.getRoomKeyRequests.mockRejectedValue(new Error('network error'))

      const requests = await matrixDeviceService.getRoomKeyRequests()

      expect(requests).toEqual([])
    })
  })

  describe('deleteRoomKeyRequest', () => {
    it('应该通过 RoomKeysManager 删除密钥请求', async () => {
      mockRoomKeysManager.deleteRoomKeyRequest.mockResolvedValue(undefined)

      const result = await matrixDeviceService.deleteRoomKeyRequest('REQ1')

      expect(result).toBe(true)
      expect(mockRoomKeysManager.deleteRoomKeyRequest).toHaveBeenCalledWith('REQ1')
    })

    it('应该在失败时返回 false', async () => {
      mockRoomKeysManager.deleteRoomKeyRequest.mockRejectedValue(new Error('network error'))

      const result = await matrixDeviceService.deleteRoomKeyRequest('REQ1')

      expect(result).toBe(false)
    })
  })
})
