import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixDehydratedDeviceService } from '../MatrixDehydratedDeviceService'

const mockAuthedRequest = vi.fn()
const mockGetUserId = vi.fn(() => '@test:example.com')

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: mockGetUserId,
      http: {
        authedRequest: mockAuthedRequest
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
      mockAuthedRequest.mockResolvedValueOnce({
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

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixDehydratedDeviceService.createDevice({
        initialDeviceDisplayName: 'Test Device'
      })

      expect(result).toBeNull()
    })
  })

  describe('getDevice', () => {
    it('should get device by ID', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
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

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Not found'))

      const result = await matrixDehydratedDeviceService.getDevice('DEVID123')

      expect(result).toBeNull()
    })
  })

  describe('getDevices', () => {
    it('should list all dehydrated devices', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        devices: [
          { device_id: 'DEVID1', initial_device_display_name: 'Device 1' },
          { device_id: 'DEVID2', initial_device_display_name: 'Device 2' }
        ]
      })

      const result = await matrixDehydratedDeviceService.getDevices()

      expect(result).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixDehydratedDeviceService.getDevices()

      expect(result).toEqual([])
    })
  })

  describe('claimDevice', () => {
    it('should claim device with signing key', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        access_token: 'token123',
        device_id: 'DEVID123'
      })

      const result = await matrixDehydratedDeviceService.claimDevice('DEVID123', 'signing_key')

      expect(result).toBeTruthy()
      expect(result?.accessToken).toBe('token123')
    })

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixDehydratedDeviceService.claimDevice('DEVID123', 'signing_key')

      expect(result).toBeNull()
    })
  })

  describe('updateDeviceData', () => {
    it('should update device data', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixDehydratedDeviceService.updateDeviceData('DEVID123', { key: 'value' })

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixDehydratedDeviceService.updateDeviceData('DEVID123', { key: 'value' })

      expect(result).toBe(false)
    })
  })

  describe('deleteDevice', () => {
    it('should delete device', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixDehydratedDeviceService.deleteDevice('DEVID123')

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixDehydratedDeviceService.deleteDevice('DEVID123')

      expect(result).toBe(false)
    })
  })

  describe('getDeviceEvent', () => {
    it('should get device event', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        events: ['event1', 'event2']
      })

      const result = await matrixDehydratedDeviceService.getDeviceEvent('DEVID123')

      expect(result).toBeTruthy()
    })

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixDehydratedDeviceService.getDeviceEvent('DEVID123')

      expect(result).toBeNull()
    })
  })
})
