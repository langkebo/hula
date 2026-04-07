import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixBeaconService } from '../MatrixBeaconService'

const mockSendEvent = vi.fn()
const mockGetUserId = vi.fn(() => '@test:example.com')
const mockSearch = vi.fn()
const mockGetRoomEvent = vi.fn()
const mockRedactEvent = vi.fn()

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: mockGetUserId,
      sendEvent: mockSendEvent,
      search: mockSearch,
      getRoomEvent: mockGetRoomEvent,
      redactEvent: mockRedactEvent
    }))
  }
}))

describe('MatrixBeaconService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBeacon', () => {
    it('should create a beacon with valid params', async () => {
      mockSendEvent.mockResolvedValueOnce({ event_id: '$beacon123' })

      const result = await matrixBeaconService.createBeacon({
        roomId: '!room:example.com',
        description: 'Test beacon'
      })

      expect(result).toBeTruthy()
      expect(result?.event_id).toBe('$beacon123')
      expect(result?.room_id).toBe('!room:example.com')
    })

    it('should throw error when sendEvent fails', async () => {
      mockSendEvent.mockResolvedValueOnce(null)

      await expect(
        matrixBeaconService.createBeacon({
          roomId: '!room:example.com',
          description: 'Test beacon'
        })
      ).rejects.toThrow('Failed to send beacon event')
    })
  })

  describe('getActiveBeacons', () => {
    it('should return active beacons', async () => {
      mockSearch.mockResolvedValueOnce({
        events: [
          {
            eventId: '$beacon123',
            sender: { userId: '@user:example.com' },
            getContent: () => ({
              beacon_info: { live: true, description: 'Test', timeout: 3600000 }
            }),
            originServerTs: Date.now()
          }
        ]
      })

      const result = await matrixBeaconService.getActiveBeacons('!room:example.com')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    })

    it('should return empty array on error', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixBeaconService.getActiveBeacons('!room:example.com')

      expect(result).toEqual([])
    })
  })

  describe('updateBeaconLocation', () => {
    it('should update beacon location', async () => {
      mockSendEvent.mockResolvedValueOnce({ event_id: '$location123' })

      const result = await matrixBeaconService.updateBeaconLocation({
        roomId: '!room:example.com',
        beaconInfoEventId: '$beacon123',
        latitude: 40.7128,
        longitude: -74.006
      })

      expect(result).toBeTruthy()
      expect(result?.event_id).toBe('$location123')
    })
  })

  describe('stopBeacon', () => {
    it('should stop a beacon', async () => {
      mockGetRoomEvent.mockResolvedValueOnce({
        getContent: () => ({
          beacon_info: { live: true, description: 'Test' }
        })
      })
      mockSendEvent.mockResolvedValueOnce({})

      const result = await matrixBeaconService.stopBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(true)
    })

    it('should return false when getRoomEvent fails', async () => {
      mockGetRoomEvent.mockRejectedValueOnce(new Error('Not found'))

      const result = await matrixBeaconService.stopBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(false)
    })
  })

  describe('getBeaconLocationHistory', () => {
    it('should get beacon location history', async () => {
      mockSearch.mockResolvedValueOnce({
        events: [
          {
            eventId: '$location123',
            sender: { userId: '@user:example.com' },
            getContent: () => ({
              beacon: {
                location: {
                  uri: 'geo:40.7128,-74.006',
                  timestamp: Date.now()
                }
              }
            }),
            originServerTs: Date.now()
          }
        ]
      })

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:example.com', '$beacon123')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    })

    it('should return empty array on error', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:example.com', '$beacon123')

      expect(result).toEqual([])
    })
  })

  describe('deleteBeacon', () => {
    it('should delete a beacon', async () => {
      mockRedactEvent.mockResolvedValueOnce({})

      const result = await matrixBeaconService.deleteBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockRedactEvent.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixBeaconService.deleteBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(false)
    })
  })
})
