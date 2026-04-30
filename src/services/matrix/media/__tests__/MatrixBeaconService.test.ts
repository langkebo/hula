/**
 * MatrixBeaconService 单元测试
 */

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
  })
})
