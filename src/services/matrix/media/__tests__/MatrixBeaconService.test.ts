/**
 * MatrixBeaconService 单元测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'

// 局部结构类型（mock 断言用）：不直接 import matrix-js-sdk，避免 sdk-boundary 门禁违规
type MockBeacon = {
  beaconInfoId: string
  latestLocationState?: { uri?: string }
}

type MockClient = {
  getBeaconManager(): {
    getBeaconsForRoom(roomId: string): unknown[]
    setLiveBeacon(roomId: string, content: unknown): Promise<unknown>
  }
  getUserId(): string
  search: (...args: unknown[]) => Promise<unknown>
  sendEvent: (...args: unknown[]) => Promise<{ event_id: string }>
  getRoomEvent: (roomId: string, eventId: string) => Promise<{ getContent(): unknown }>
  getRoom(roomId: string): { currentState?: { beacons?: Map<string, MockBeacon> } } | null
}

// 通过真实 getClient 的返回类型对齐注入，避免测试内 import matrix-js-sdk
function mockGetClient(client: MockClient): void {
  vi.mocked(matrixClientService.getClient).mockReturnValue(
    client as unknown as NonNullable<ReturnType<typeof matrixClientService.getClient>>
  )
}

vi.mock('@/services/matrix/MatrixClientService')

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixBeaconService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBeacon', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(
        matrixBeaconService.createBeacon({
          roomId: '!room:id',
          description: 'Test beacon'
        })
      ).rejects.toThrow('Matrix client not initialized')
    })
  })

  describe('getBeaconInfo', () => {
    it('should return null when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const result = await matrixBeaconService.getBeaconInfo('!room:id', '$event:id')

      expect(result).toBeNull()
    })

    it('should read top-level description/timeout/live (not nested beacon_info)', async () => {
      const getRoomEvent = vi.fn().mockResolvedValue({
        sender: { userId: '@alice:example.com' },
        getTs: () => 1700000000000,
        getContent: () => ({ description: 'Alice beacon', timeout: 3600000, live: true })
      })
      const mockClient = { getRoomEvent } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.getBeaconInfo('!room:id', '$beacon_info_1')

      expect(result).toEqual({
        event_id: '$beacon_info_1',
        room_id: '!room:id',
        user_id: '@alice:example.com',
        description: 'Alice beacon',
        timeout: 3600000,
        is_live: true,
        last_updated: 1700000000000
      })
    })
  })

  describe('getActiveBeacons', () => {
    it('should return empty array when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const result = await matrixBeaconService.getActiveBeacons('!room:id')

      expect(result).toEqual([])
    })

    it('should read live beacons via BeaconManager.getBeaconsForRoom without calling client.search', async () => {
      const getBeaconsForRoom = vi.fn().mockReturnValue([
        {
          isLive: true,
          beaconInfoId: '$beacon_info_1',
          beaconInfoOwner: '@alice:example.com',
          beaconInfo: { description: 'Alice beacon', timeout: 3600000, timestamp: 1700000000000 }
        },
        {
          isLive: false,
          beaconInfoId: '$beacon_info_2',
          beaconInfoOwner: '@bob:example.com',
          beaconInfo: { description: 'Bob beacon', timeout: 3600000, timestamp: 1700000001000 }
        }
      ])
      const search = vi.fn()
      const mockClient = {
        getBeaconManager: vi.fn(() => ({ getBeaconsForRoom })),
        getUserId: () => '@alice:example.com',
        search
      } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.getActiveBeacons('!room:id')

      expect(mockClient.getBeaconManager).toHaveBeenCalled()
      expect(getBeaconsForRoom).toHaveBeenCalledWith('!room:id')
      expect(search).not.toHaveBeenCalled()
      // 只返回 live 的信标，字段完整映射
      expect(result).toEqual([
        {
          event_id: '$beacon_info_1',
          room_id: '!room:id',
          user_id: '@alice:example.com',
          description: 'Alice beacon',
          timeout: 3600000,
          is_live: true,
          last_updated: 1700000000000
        }
      ])
    })

    it('should only return live beacons owned by the current user (Blocker 2)', async () => {
      const getBeaconsForRoom = vi.fn().mockReturnValue([
        {
          isLive: true,
          beaconInfoId: '$beacon_info_1',
          beaconInfoOwner: '@alice:example.com',
          beaconInfo: { description: 'Alice beacon', timeout: 3600000, timestamp: 1700000000000 }
        },
        {
          isLive: true,
          beaconInfoId: '$beacon_info_2',
          beaconInfoOwner: '@bob:example.com',
          beaconInfo: { description: 'Bob beacon', timeout: 3600000, timestamp: 1700000001000 }
        }
      ])
      const search = vi.fn()
      const mockClient = {
        getBeaconManager: vi.fn(() => ({ getBeaconsForRoom })),
        getUserId: () => '@alice:example.com',
        search
      } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.getActiveBeacons('!room:id')

      expect(result).toEqual([
        {
          event_id: '$beacon_info_1',
          room_id: '!room:id',
          user_id: '@alice:example.com',
          description: 'Alice beacon',
          timeout: 3600000,
          is_live: true,
          last_updated: 1700000000000
        }
      ])
    })

    it('should return empty array when BeaconManager has no live beacons for the room', async () => {
      const getBeaconsForRoom = vi.fn().mockReturnValue([
        {
          isLive: false,
          beaconInfoId: '$beacon_info_2',
          beaconInfoOwner: '@bob:example.com',
          beaconInfo: { timeout: 3600000 }
        }
      ])
      const search = vi.fn()
      const mockClient = {
        getBeaconManager: vi.fn(() => ({ getBeaconsForRoom })),
        getUserId: () => '@alice:example.com',
        search
      } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.getActiveBeacons('!room:id')

      expect(result).toEqual([])
      expect(search).not.toHaveBeenCalled()
    })
  })

  describe('getBeaconLatestUri', () => {
    it('should return undefined when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      expect(matrixBeaconService.getBeaconLatestUri('!room:id', '$beacon_info_1')).toBeUndefined()
    })

    it('should return undefined when the room is not found', () => {
      const getRoom = vi.fn().mockReturnValue(null)
      const mockClient = { getRoom } as unknown as MockClient
      mockGetClient(mockClient)

      expect(matrixBeaconService.getBeaconLatestUri('!room:id', '$beacon_info_1')).toBeUndefined()
      expect(getRoom).toHaveBeenCalledWith('!room:id')
    })

    it('should return the latest location uri of the matching beacon info event', () => {
      const getRoom = vi.fn().mockReturnValue({
        currentState: {
          beacons: new Map<string, MockBeacon>([
            ['!room:id_@alice', { beaconInfoId: '$beacon_info_1', latestLocationState: { uri: 'geo:39.9,116.3' } }],
            ['!room:id_@bob', { beaconInfoId: '$beacon_info_2', latestLocationState: { uri: 'geo:31.2,121.5' } }]
          ])
        }
      })
      const mockClient = { getRoom } as unknown as MockClient
      mockGetClient(mockClient)

      expect(matrixBeaconService.getBeaconLatestUri('!room:id', '$beacon_info_2')).toBe('geo:31.2,121.5')
    })

    it('should return undefined when the beacon has no latest location state', () => {
      const getRoom = vi.fn().mockReturnValue({
        currentState: {
          beacons: new Map<string, MockBeacon>([['!room:id_@alice', { beaconInfoId: '$beacon_info_1' }]])
        }
      })
      const mockClient = { getRoom } as unknown as MockClient
      mockGetClient(mockClient)

      expect(matrixBeaconService.getBeaconLatestUri('!room:id', '$beacon_info_1')).toBeUndefined()
    })

    it('should return undefined when no beacon matches the info event id', () => {
      const getRoom = vi.fn().mockReturnValue({
        currentState: {
          beacons: new Map<string, MockBeacon>([
            ['!room:id_@alice', { beaconInfoId: '$beacon_info_1', latestLocationState: { uri: 'geo:39.9,116.3' } }]
          ])
        }
      })
      const mockClient = { getRoom } as unknown as MockClient
      mockGetClient(mockClient)

      expect(matrixBeaconService.getBeaconLatestUri('!room:id', '$beacon_info_missing')).toBeUndefined()
    })

    it('should return undefined when getRoom throws', () => {
      const getRoom = vi.fn().mockImplementation(() => {
        throw new Error('room unavailable')
      })
      const mockClient = { getRoom } as unknown as MockClient
      mockGetClient(mockClient)

      expect(matrixBeaconService.getBeaconLatestUri('!room:id', '$beacon_info_1')).toBeUndefined()
    })
  })

  describe('updateBeaconLocation', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(
        matrixBeaconService.updateBeaconLocation({
          roomId: '!room:id',
          beaconInfoEventId: '$event:id',
          latitude: 39.9042,
          longitude: 116.4074
        })
      ).rejects.toThrow('Matrix client not initialized')
    })

    it('should send an M_BEACON event with the standard makeBeaconContent shape', async () => {
      const sendEvent = vi.fn().mockResolvedValue({ event_id: '$beacon_loc_1' })
      const mockClient = { sendEvent } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.updateBeaconLocation({
        roomId: '!room:id',
        beaconInfoEventId: '$beacon_info_1',
        latitude: 39.9042,
        longitude: 116.4074,
        uncertainty: 10
      })

      expect(sendEvent).toHaveBeenCalledTimes(1)
      expect(sendEvent).toHaveBeenCalledWith(
        '!room:id',
        'org.matrix.msc3672.beacon',
        expect.objectContaining({
          'org.matrix.msc3488.location': {
            uri: 'geo:39.9042,116.4074'
          },
          'm.relates_to': {
            rel_type: 'm.reference',
            event_id: '$beacon_info_1'
          },
          'org.matrix.msc3488.ts': expect.any(Number)
        })
      )
      expect(result.event_id).toBe('$beacon_loc_1')
      expect(result.beacon_info_id).toBe('$beacon_info_1')
    })
  })

  describe('getBeaconLocationHistory', () => {
    it('should return empty array when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:id', '$event:id')

      expect(result).toEqual([])
    })

    it('should keep using client.search because BeaconManager has no location history', async () => {
      const search = vi.fn().mockResolvedValue({
        search_categories: {
          room_events: {
            results: [
              {
                result: {
                  event_id: '$beacon_loc_1',
                  origin_server_ts: 1700000002000,
                  content: {
                    'org.matrix.msc3488.location': {
                      uri: 'geo:39.9042,116.4074'
                    },
                    'org.matrix.msc3488.ts': 1700000001500,
                    'm.relates_to': {
                      rel_type: 'm.reference',
                      event_id: '$event:id'
                    }
                  }
                }
              }
            ]
          }
        }
      })
      const mockClient = { search } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:id', '$event:id')

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          room_ids: ['!room:id'],
          filter: expect.objectContaining({ types: ['org.matrix.msc3672.beacon', 'm.beacon'] })
        })
      )
      expect(result).toEqual([
        {
          event_id: '$beacon_loc_1',
          beacon_info_id: '$event:id',
          timestamp: 1700000001500,
          latitude: 39.9042,
          longitude: 116.4074
        }
      ])
    })

    it('should return empty array when search fails', async () => {
      const search = vi.fn().mockRejectedValue(new Error('search failed'))
      const mockClient = { search } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:id', '$event:id')

      expect(result).toEqual([])
    })
  })

  describe('stopBeacon', () => {
    it('should return false when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const result = await matrixBeaconService.stopBeacon('!room:id', '$beacon_info_1')

      expect(result).toBe(false)
    })

    it('should stop beacon via BeaconManager.setLiveBeacon with a live:false state event', async () => {
      const getRoomEvent = vi.fn().mockResolvedValue({
        getContent: () => ({ timeout: 3600000, description: 'Test beacon' })
      })
      const setLiveBeacon = vi.fn().mockResolvedValue({ event_id: '$beacon_info_stopped' })
      const getBeaconManager = vi.fn(() => ({ setLiveBeacon }))
      const mockClient = { getRoomEvent, getBeaconManager } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.stopBeacon('!room:id', '$beacon_info_1')

      expect(result).toBe(true)
      expect(getRoomEvent).toHaveBeenCalledWith('!room:id', '$beacon_info_1')
      expect(getBeaconManager).toHaveBeenCalled()
      expect(setLiveBeacon).toHaveBeenCalledWith(
        '!room:id',
        expect.objectContaining({
          timeout: 3600000,
          live: false,
          description: 'Test beacon'
        })
      )
    })

    it('should default timeout to 3600000 when beacon_info content omits timeout', async () => {
      const getRoomEvent = vi.fn().mockResolvedValue({
        getContent: () => ({ description: 'Test beacon' })
      })
      const setLiveBeacon = vi.fn().mockResolvedValue({ event_id: '$beacon_info_stopped' })
      const getBeaconManager = vi.fn(() => ({ setLiveBeacon }))
      const mockClient = { getRoomEvent, getBeaconManager } as unknown as MockClient
      mockGetClient(mockClient)

      const result = await matrixBeaconService.stopBeacon('!room:id', '$beacon_info_1')

      expect(result).toBe(true)
      expect(setLiveBeacon).toHaveBeenCalledWith(
        '!room:id',
        expect.objectContaining({
          timeout: 3600000,
          live: false,
          description: 'Test beacon'
        })
      )
    })
  })
})
