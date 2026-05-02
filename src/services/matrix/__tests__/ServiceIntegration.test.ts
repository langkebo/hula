import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixCacheManager } from '../MatrixCacheManager'
import { matrixClientService } from '../MatrixClientService'
import { MatrixRequestDeduper } from '../MatrixRequestDeduper'

vi.mock('../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('Service Integration Tests', () => {
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = { authedRequest: vi.fn() }
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      http: mockHttp as unknown as MatrixClient['http'],
      getUserId: vi.fn(() => '@user:server'),
      getDeviceId: vi.fn(() => 'DEVICE1'),
      getDomain: vi.fn(() => 'server'),
      getRoom: vi.fn()
    } as unknown as MatrixClient)
    MatrixCacheManager.clear()
    MatrixRequestDeduper.clear()
  })

  describe('Cache + Request Integration', () => {
    it('should cache room capabilities and avoid duplicate requests', async () => {
      const mockCaps = { capabilities: { 'm.room.tombstone': { enabled: true } } }
      mockHttp.authedRequest.mockResolvedValue(mockCaps)

      const fetchRoomCaps = async (roomId: string) => {
        return MatrixCacheManager.getOrFetch(
          `room_caps:${roomId}`,
          async () => {
            const client = matrixClientService.getClient()
            const result = await client!.http.authedRequest(
              'GET',
              `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/capabilities`
            )
            return result as Record<string, unknown>
          },
          60000
        )
      }

      const result1 = await fetchRoomCaps('!room:server')
      const result2 = await fetchRoomCaps('!room:server')

      expect(result1).toEqual(mockCaps)
      expect(result2).toEqual(mockCaps)
      expect(mockHttp.authedRequest).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when room is modified', async () => {
      mockHttp.authedRequest.mockResolvedValue({ capabilities: {} })

      await MatrixCacheManager.getOrFetch('room_caps:!room:server', async () => {
        const client = matrixClientService.getClient()
        return client!.http.authedRequest('GET', '/_matrix/client/v3/rooms/!room%3Aserver/capabilities')
      })

      expect(MatrixCacheManager.has('room_caps:!room:server')).toBe(true)

      MatrixCacheManager.deleteByPrefix('room_caps:')
      expect(MatrixCacheManager.has('room_caps:!room:server')).toBe(false)
    })
  })

  describe('Deduper + Cache Integration', () => {
    it('should dedupe concurrent requests and cache results', async () => {
      let callCount = 0
      const fetcher = vi.fn().mockImplementation(async () => {
        callCount++
        await new Promise((resolve) => setTimeout(resolve, 30))
        return { data: `result-${callCount}` }
      })

      const smartFetch = async (roomId: string) => {
        const cacheKey = `room:${roomId}`
        const cached = MatrixCacheManager.get<Record<string, string>>(cacheKey)
        if (cached) return cached

        return MatrixRequestDeduper.dedupe(cacheKey, async () => {
          const result = await fetcher()
          MatrixCacheManager.set(cacheKey, result, 60000)
          return result
        })
      }

      const results = await Promise.all([
        smartFetch('!room1:server'),
        smartFetch('!room1:server'),
        smartFetch('!room1:server')
      ])

      expect(results[0]).toEqual({ data: 'result-1' })
      expect(results[1]).toEqual({ data: 'result-1' })
      expect(results[2]).toEqual({ data: 'result-1' })
      expect(fetcher).toHaveBeenCalledTimes(1)

      const cachedResult = await smartFetch('!room1:server')
      expect(cachedResult).toEqual({ data: 'result-1' })
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  describe('Auth + Room Service Integration', () => {
    it('should handle client not initialized across services', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      expect(MatrixCacheManager.get('any_key')).toBeNull()
    })

    it('should handle reconnection scenario with cache invalidation', async () => {
      mockHttp.authedRequest.mockResolvedValue({ data: 'old' })

      await MatrixCacheManager.getOrFetch('session:info', async () => {
        const client = matrixClientService.getClient()
        return client!.http.authedRequest('GET', '/_matrix/client/v3/account/whoami')
      })

      expect(MatrixCacheManager.has('session:info')).toBe(true)

      MatrixCacheManager.deleteByPrefix('session:')
      expect(MatrixCacheManager.has('session:info')).toBe(false)

      mockHttp.authedRequest.mockResolvedValue({ data: 'new' })
      const refreshed = await MatrixCacheManager.getOrFetch('session:info', async () => {
        const client = matrixClientService.getClient()
        return client!.http.authedRequest('GET', '/_matrix/client/v3/account/whoami')
      })

      expect(refreshed).toEqual({ data: 'new' })
      expect(mockHttp.authedRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('Space + Room Service Integration', () => {
    it('should fetch space hierarchy with caching', async () => {
      const mockHierarchy = {
        rooms: [{ room_id: '!room1:server', name: 'Room 1' }],
        next_batch: 'token1'
      }
      mockHttp.authedRequest.mockResolvedValue(mockHierarchy)

      const result = await MatrixCacheManager.getOrFetch(
        'space_hierarchy:!space:server',
        async () => {
          const client = matrixClientService.getClient()
          return client!.http.authedRequest(
            'GET',
            `/_matrix/client/v1/spaces/${encodeURIComponent('!space:server')}/hierarchy`
          )
        },
        30000
      )

      expect(result).toEqual(mockHierarchy)
      expect(mockHttp.authedRequest).toHaveBeenCalledTimes(1)

      const cached = await MatrixCacheManager.getOrFetch(
        'space_hierarchy:!space:server',
        async () => {
          throw new Error('Should not be called')
        },
        30000
      )
      expect(cached).toEqual(mockHierarchy)
    })
  })

  describe('Error Recovery Integration', () => {
    it('should recover from network errors with retry', async () => {
      let attempt = 0
      mockHttp.authedRequest.mockImplementation(async () => {
        attempt++
        if (attempt === 1) throw new Error('Network error')
        return { success: true }
      })

      const retryFetch = async (key: string, maxRetries = 2): Promise<Record<string, unknown> | null> => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            const client = matrixClientService.getClient()
            const result = await client!.http.authedRequest('GET', key)
            MatrixCacheManager.set(key, result, 30000)
            return result as Record<string, unknown>
          } catch {
            if (i === maxRetries - 1) return null
          }
        }
        return null
      }

      const result = await retryFetch('/_matrix/client/v3/capabilities')
      expect(result).toEqual({ success: true })
      expect(attempt).toBe(2)
    })

    it('should handle cache expiration gracefully', async () => {
      MatrixCacheManager.set('temp_key', { data: 'temp' }, 1)

      await new Promise((resolve) => setTimeout(resolve, 5))

      const cached = MatrixCacheManager.get('temp_key')
      expect(cached).toBeNull()
    })
  })
})
