/**
 * MatrixBeaconService 单元测试
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'

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
        search
      } as unknown as MatrixClient
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

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
        search
      } as unknown as MatrixClient
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

      const result = await matrixBeaconService.getActiveBeacons('!room:id')

      expect(result).toEqual([])
      expect(search).not.toHaveBeenCalled()
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
                    beacon: {
                      event_id: '$event:id',
                      timestamp: 1700000001500,
                      location: {
                        uri: 'geo:39.9042,116.4074',
                        timestamp: 1700000001500,
                        accuracy: 10,
                        altitude: 50,
                        speed: 1.5,
                        bearing: 90
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      })
      const mockClient = { search } as unknown as MatrixClient
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:id', '$event:id')

      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          room_ids: ['!room:id'],
          filter: expect.objectContaining({ types: ['m.beacon'] })
        })
      )
      expect(result).toEqual([
        {
          event_id: '$beacon_loc_1',
          beacon_info_id: '$event:id',
          timestamp: 1700000001500,
          latitude: 39.9042,
          longitude: 116.4074,
          uncertainty: 10,
          altitude: 50,
          speed: 1.5,
          bearing: 90
        }
      ])
    })

    it('should return empty array when search fails', async () => {
      const search = vi.fn().mockRejectedValue(new Error('search failed'))
      const mockClient = { search } as unknown as MatrixClient
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

      const result = await matrixBeaconService.getBeaconLocationHistory('!room:id', '$event:id')

      expect(result).toEqual([])
    })
  })
})
