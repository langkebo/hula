import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixBeaconService } from '../MatrixBeaconService'

// Mock MatrixClientService
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: vi.fn(() => '@test:example.com'),
      getRoom: vi.fn(() => null),
      getMediaApiUrl: vi.fn(() => 'https://example.com/_matrix/media'),
      http: {
        authedRequest: vi.fn()
      }
    }))
  }
}))

describe('MatrixBeaconService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBeacon', () => {
    it('should create a beacon with valid params', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest as any).mockResolvedValue({
        beacon_info_event_id: '$beacon123',
        duration: 3600000
      })

      const result = await matrixBeaconService.createBeacon({
        roomId: '!room:example.com',
        description: 'Test beacon'
      })

      expect(result).toBeTruthy()
      expect(result?.room_id).toBe('!room:example.com')
    })
  })

  describe('getActiveBeacons', () => {
    it('should return active beacons', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest as any).mockResolvedValue({
        beacons: [
          {
            beacon_info_event_id: '$beacon123',
            room_id: '!room:example.com',
            description: 'Test',
            type: 'm.live'
          }
        ]
      })

      const result = await matrixBeaconService.getActiveBeacons('!room:example.com')

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('updateBeaconLocation', () => {
    it('should update beacon location', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest as any).mockResolvedValue({
        event_id: '$location123'
      })

      const result = await matrixBeaconService.updateBeaconLocation({
        roomId: '!room:example.com',
        beaconInfoEventId: '$beacon123',
        latitude: 40.7128,
        longitude: -74.006
      })

      expect(result).toBeTruthy()
    })
  })

  describe('stopBeacon', () => {
    it('should stop a beacon', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest as any).mockResolvedValue({})

      const result = await matrixBeaconService.stopBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(true)
    })
  })

  describe('getBeaconLocationHistory', () => {
    it('should get beacon location history', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest as any).mockResolvedValue({
        events: [
          {
            type: 'm.beacon',
            event_id: '$location123',
            content: {
              msgtype: 'm.location',
              body: 'Location update',
              geo_uri: 'geo:40.7128,-74.006'
            }
          }
        ]
      })

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:example.com', '$beacon123')

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('deleteBeacon', () => {
    it('should delete a beacon', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest as any).mockResolvedValue({})

      const result = await matrixBeaconService.deleteBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(true)
    })
  })
})
