import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixDehydratedDeviceService } from '../MatrixDehydratedDeviceService'

// Mock MatrixClientService
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: vi.fn(() => '@test:example.com'),
      http: {
        authedRequest: vi.fn()
      }
    }))
  }
}))

describe('MatrixDehydratedDeviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDevice', () => {
    it('should create dehydrated device', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        device_id: 'DEVID123',
        device_data: {},
        expires_at: Date.now() + 3600000
      })

      const result = await matrixDehydratedDeviceService.createDevice({
        initialDeviceDisplayName: 'Test Device'
      })

      expect(result).toBeTruthy()
      expect(result?.deviceId).toBe('DEVID123')
    })
  })

  describe('getDevice', () => {
    it('should get device by ID', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        device_id: 'DEVID123',
        initial_device_display_name: 'Test Device',
        device_data: {},
        created_at: Date.now(),
        expires_at: Date.now() + 3600000
      })

      const result = await matrixDehydratedDeviceService.getDevice('DEVID123')

      expect(result).toBeTruthy()
      expect(result?.deviceId).toBe('DEVID123')
    })
  })

  describe('getDevices', () => {
    it('should list all dehydrated devices', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        devices: [
          { device_id: 'DEVID1', initial_device_display_name: 'Device 1' },
          { device_id: 'DEVID2', initial_device_display_name: 'Device 2' }
        ]
      })

      const result = await matrixDehydratedDeviceService.getDevices()

      expect(result).toHaveLength(2)
    })
  })

  describe('claimDevice', () => {
    it('should claim device with signing key', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        access_token: 'token123',
        device_id: 'DEVID123'
      })

      const result = await matrixDehydratedDeviceService.claimDevice('DEVID123', 'signing_key')

      expect(result).toBeTruthy()
      expect(result?.accessToken).toBe('token123')
    })
  })

  describe('updateDeviceData', () => {
    it('should update device data', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixDehydratedDeviceService.updateDeviceData('DEVID123', { key: 'value' })

      expect(result).toBe(true)
    })
  })

  describe('deleteDevice', () => {
    it('should delete device', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixDehydratedDeviceService.deleteDevice('DEVID123')

      expect(result).toBe(true)
    })
  })

  describe('getDeviceEvent', () => {
    it('should get device event', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        events: ['event1', 'event2']
      })

      const result = await matrixDehydratedDeviceService.getDeviceEvent('DEVID123')

      expect(result).toBeTruthy()
    })
  })
})
