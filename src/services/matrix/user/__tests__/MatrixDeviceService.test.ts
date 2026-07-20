import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import type { MatrixClientExtended } from '@/types/matrix-extensions'
import matrixClientService from '../../MatrixClientService'
import type { Device } from '../MatrixDeviceService'
import { matrixDeviceService } from '../MatrixDeviceService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const _server = setupMswServer(
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/devices`, () => {
    return HttpResponse.json({
      devices: [
        { device_id: 'DEVICE1', display_name: 'Device 1' },
        { device_id: 'DEVICE2', display_name: 'Device 2' }
      ]
    })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/devices/:deviceId`, () => {
    return HttpResponse.json({
      device_id: 'DEVICE1',
      display_name: 'My Device',
      device: {
        device_id: 'DEVICE1',
        display_name: 'My Device',
        last_seen_ts: 1000000
      }
    })
  }),
  http.put(`${TEST_BASE_URL}/_matrix/client/v3/devices/:deviceId`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      device_id: 'DEVICE1',
      display_name: (body as Record<string, unknown>)?.display_name ?? 'New Name',
      updated_ts: Date.now()
    })
  }),
  http.delete(`${TEST_BASE_URL}/_matrix/client/v3/devices/:deviceId`, () => {
    return HttpResponse.json({})
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/delete_devices`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as Record<string, unknown>)
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/room_keys/request`, () => {
    return HttpResponse.json({ requests: [] })
  }),
  http.delete(`${TEST_BASE_URL}/_matrix/client/v3/room_keys/request/:requestId`, () => {
    return HttpResponse.json({})
  })
)

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

    mockHttp = { authedRequest: authedRequestImpl }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      getDeviceManager: vi.fn(
        () => mockDeviceManager as unknown as MatrixClientExtended['getDeviceManager'] extends () => infer T ? T : never
      ),
      getDeviceId: vi.fn(() => 'CURRENT_DEVICE')
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
  })

  describe('getDevices', () => {
    it('应该在未调用 initialize 时回退到 matrixClientService', async () => {
      const mockDevices: Device[] = [{ device_id: 'DEVICE1', display_name: 'Device 1', verified: true }]
      mockDeviceManager.getDevices.mockResolvedValue(mockDevices)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)

      const service = new (matrixDeviceService.constructor as unknown as new () => typeof matrixDeviceService)()
      const devices = await service.getDevices()

      expect(matrixClientService.getClient).toHaveBeenCalled()
      expect(devices).toEqual(mockDevices)
    })

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

    it('应该降级到 HTTP 调用', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      const devices = await matrixDeviceService.getDevices()

      expect(devices).toEqual([
        { device_id: 'DEVICE1', display_name: 'Device 1' },
        { device_id: 'DEVICE2', display_name: 'Device 2' }
      ])
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', '/devices')
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

    it('应该处理嵌套的 device 对象', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      const device = await matrixDeviceService.getDevice('DEVICE1')

      expect(device).toEqual({
        device_id: 'DEVICE1',
        display_name: 'My Device',
        last_seen_ts: 1000000
      })
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

    it('应该通过 HTTP 更新设备', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)

      const result = await matrixDeviceService.updateDevice('DEVICE1', 'New Name')

      expect(result.device_id).toBe('DEVICE1')
      expect(result.display_name).toBe('New Name')
      expect(authedRequestImpl).toHaveBeenCalledWith('PUT', '/devices/DEVICE1', undefined, {
        display_name: 'New Name'
      })
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

    it('应该通过 HTTP 批量删除', async () => {
      mockClient.getDeviceManager = vi.fn(() => null)
      const deviceIds = ['DEVICE1', 'DEVICE2']
      const auth = { type: 'm.login.password', password: 'secret' }

      await matrixDeviceService.deleteDevices(deviceIds, auth)

      expect(authedRequestImpl).toHaveBeenCalledWith('POST', '/delete_devices', undefined, {
        device_ids: deviceIds,
        auth
      })
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
  })
})
