import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixBeaconService } from '../MatrixBeaconService'

const mockSendEvent = vi.fn()
const mockSendStateEvent = vi.fn()
const mockGetUserId = vi.fn(() => '@test:example.com')
const mockSearch = vi.fn()
const mockGetRoomEvent = vi.fn()
const mockRedactEvent = vi.fn()
const mockGetRoom = vi.fn()
const mockGetStateEvent = vi.fn()
const mockGetBeaconManager = vi.fn(() => null)

vi.mock('@/services/matrix/BaseManager', () => {
  return {
    BaseManager: class {
      protected handleError<T>(error: unknown, _operation: string, defaultValue: T, throwOnError: boolean): T {
        if (throwOnError) throw error
        return defaultValue
      }
      protected normalizeError(error: unknown, _operation: string) {
        return error
      }
    }
  }
})

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: mockGetUserId,
      sendEvent: mockSendEvent,
      sendStateEvent: mockSendStateEvent,
      search: mockSearch,
      getRoomEvent: mockGetRoomEvent,
      redactEvent: mockRedactEvent,
      getRoom: mockGetRoom,
      getStateEvent: mockGetStateEvent,
      getBeaconManager: mockGetBeaconManager
    }))
  }
}))

describe('MatrixBeaconService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBeacon', () => {
    it('should create a beacon with valid params', async () => {
      mockSendStateEvent.mockResolvedValueOnce({ event_id: '$beacon123' })

      const result = await matrixBeaconService.createBeacon({
        roomId: '!room:example.com',
        description: 'Test beacon'
      })

      expect(result).toBeTruthy()
      expect(result?.event_id).toBe('$beacon123')
      expect(result?.room_id).toBe('!room:example.com')
    })

    it('should throw error when sendEvent fails', async () => {
      mockSendStateEvent.mockResolvedValueOnce(null)

      await expect(
        matrixBeaconService.createBeacon({
          roomId: '!room:example.com',
          description: 'Test beacon'
        })
      ).rejects.toThrow('Failed to send beacon state event')
    })
  })

  describe('getActiveBeacons', () => {
    it('should return active beacons', async () => {
      const mockStateEvents = [
        {
          getId: () => '$beacon123',
          getSender: () => '@user:example.com',
          getContent: () => ({
            live: true,
            description: 'Test',
            timeout: 3600000
          }),
          getTs: () => Date.now()
        }
      ]

      mockGetRoom.mockReturnValueOnce({
        currentState: {
          getStateEvents: vi.fn(() => mockStateEvents)
        }
      })

      const result = await matrixBeaconService.getActiveBeacons('!room:example.com')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    })

    it('should return empty array on error', async () => {
      mockGetRoom.mockReturnValueOnce(null)

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
      mockGetStateEvent.mockResolvedValueOnce({
        live: true,
        description: 'Test'
      })
      mockSendStateEvent.mockResolvedValueOnce({})

      const result = await matrixBeaconService.stopBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(true)
    })

    it('should return false when getRoomEvent fails', async () => {
      mockGetStateEvent.mockRejectedValueOnce(new Error('Not found'))

      const result = await matrixBeaconService.stopBeacon('!room:example.com', '$beacon123')

      expect(result).toBe(false)
    })
  })

  describe('getBeaconLocationHistory', () => {
    it('should get beacon location history', async () => {
      const mockTimelineEvents = [
        {
          getType: () => 'm.beacon',
          getId: () => '$location123',
          getTs: () => Date.now(),
          getContent: () => ({
            'm.beacon': {
              event_id: '$beacon123',
              location: {
                uri: 'geo:40.7128,-74.006',
                timestamp: Date.now()
              }
            }
          })
        }
      ]

      mockGetRoom.mockReturnValueOnce({
        getLiveTimeline: () => ({
          getEvents: () => mockTimelineEvents
        })
      })

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:example.com', '$beacon123')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    })

    it('should return empty array on error', async () => {
      mockGetRoom.mockReturnValueOnce(null)

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
