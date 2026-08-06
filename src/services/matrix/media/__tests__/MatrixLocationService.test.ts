/**
 * MatrixLocationService 单元测试
 */

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'

const { getClientMock, loggerSpy } = vi.hoisted(() => ({
  getClientMock: vi.fn(() => null as MatrixClient | null),
  loggerSpy: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpy
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getClient: getClientMock
  },
  matrixClientService: {
    getClient: getClientMock
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn()
}

vi.stubGlobal('navigator', {
  geolocation: mockGeolocation
})

describe('MatrixLocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getCurrentPosition', () => {
    it('should reject when geolocation is not supported', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        writable: true
      })

      await expect(matrixLocationService.getCurrentPosition()).rejects.toThrow('浏览器不支持地理位置')

      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true
      })
    })

    it('should resolve with location data on success', async () => {
      const mockPosition = {
        coords: {
          latitude: 39.9042,
          longitude: 116.4074,
          accuracy: 10
        },
        timestamp: Date.now()
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const result = await matrixLocationService.getCurrentPosition()

      expect(result.latitude).toBe(39.9042)
      expect(result.longitude).toBe(116.4074)
      expect(result.accuracy).toBe(10)
      expect(result.timestamp).toBe(mockPosition.timestamp)
    })

    it('should reject with error on failure', async () => {
      const mockError = new Error('Position unavailable')

      mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
        error(mockError)
      })

      await expect(matrixLocationService.getCurrentPosition()).rejects.toThrow('Position unavailable')
    })
  })

  describe('sendLocation', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(
        matrixLocationService.sendLocation('!room:id', {
          latitude: 39.9042,
          longitude: 116.4074,
          timestamp: Date.now()
        })
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('startLiveLocationShare', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixLocationService.startLiveLocationShare('!room:id', 3600000)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('updateLiveLocation', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(
        matrixLocationService.updateLiveLocation('!room:id', '$event:id', {
          latitude: 39.9042,
          longitude: 116.4074,
          timestamp: Date.now()
        })
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('parseLocationEvent', () => {
    it('should return null for non-location events', () => {
      const mockEvent = {
        getContent: () => ({ msgtype: 'm.text' })
      }

      const result = matrixLocationService.parseLocationEvent(mockEvent as unknown as MatrixEvent)

      expect(result).toBeNull()
    })
  })

  describe('getGoogleMapsUrl', () => {
    it('should return correct Google Maps URL', () => {
      const location = {
        latitude: 39.9042,
        longitude: 116.4074,
        timestamp: Date.now()
      }

      const url = matrixLocationService.getGoogleMapsUrl(location)

      expect(url).toContain('39.9042')
      expect(url).toContain('116.4074')
      expect(url).toContain('google.com')
    })
  })

  describe('getOpenStreetMapUrl', () => {
    it('should return correct OpenStreetMap URL', () => {
      const location = {
        latitude: 39.9042,
        longitude: 116.4074,
        timestamp: Date.now()
      }

      const url = matrixLocationService.getOpenStreetMapUrl(location)

      expect(url).toContain('39.9042')
      expect(url).toContain('116.4074')
      expect(url).toContain('openstreetmap.org')
    })
  })
})

describe('R-19: error logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs a warning when parseLocationEvent throws and returns null', () => {
    const mockEvent = {
      getContent: () => {
        throw new Error('getContent failed')
      }
    }

    const result = matrixLocationService.parseLocationEvent(mockEvent as unknown as MatrixEvent)

    expect(result).toBeNull()
    expect(loggerSpy.warn).toHaveBeenCalledTimes(1)
    expect(loggerSpy.warn).toHaveBeenCalledWith('parseLocation failed:', expect.any(Error))
  })
})
