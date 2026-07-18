import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomTimelineService } from '../TimelineService'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}/rooms/:roomId/timeline`, () => {
    return HttpResponse.json({ chunk: [], start: '', end: '' })
  }),
  http.get(`${TEST_BASE_URL}/rooms/:roomId/unread_count`, () => {
    return HttpResponse.json({ unread_notifications: 0, unread_highlighted: 0 })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/rooms/:roomId/timestamp_to_event`, () => {
    return HttpResponse.json({ event_id: '$e', origin_server_ts: 42 })
  }),
  http.get(`${TEST_BASE_URL}/rooms/:roomId/notifications`, () => {
    return HttpResponse.json({ notifications: [] })
  }),
  http.get(`${TEST_BASE_URL}/rooms/:roomId/call/:callId`, () => {
    return HttpResponse.json({ state: 'ringing' })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const authedRequestImpl = vi.fn()

describe('MatrixRoomTimelineService', () => {
  let service: InstanceType<typeof MatrixRoomTimelineService>
  let mockClient: { http: { authedRequest: typeof authedRequestImpl }; getEventContext: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown, opts?: { prefix?: string }) => {
        const prefix = opts?.prefix ?? ''
        const url = new URL(`${TEST_BASE_URL}${prefix}${path}`)
        if (queryParams && typeof queryParams === 'object') {
          for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
            url.searchParams.set(key, value)
          }
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      }
    )

    mockClient = {
      http: { authedRequest: authedRequestImpl },
      getEventContext: vi.fn()
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as never)
    service = new MatrixRoomTimelineService()
  })

  describe('getEventContext', () => {
    it('throws when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as never)
      await expect(service.getEventContext('!r', '$e')).rejects.toThrow('客户端未初始化')
    })

    it('forwards to client.getEventContext with the limit option', async () => {
      const payload = { event: {}, events_before: [], events_after: [], state: [] }
      mockClient.getEventContext.mockResolvedValue(payload)
      expect(await service.getEventContext('!r', '$e', 25)).toBe(payload)
      expect(mockClient.getEventContext).toHaveBeenCalledWith('!r', '$e', { limit: 25 })
    })

    it('uses default limit=10 when omitted', async () => {
      mockClient.getEventContext.mockResolvedValue({})
      await service.getEventContext('!r', '$e')
      expect(mockClient.getEventContext).toHaveBeenCalledWith('!r', '$e', { limit: 10 })
    })

    it('re-throws backend errors', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getEventContext: vi.fn().mockRejectedValue(new Error('404'))
      } as never)
      await expect(service.getEventContext('!r', '$e')).rejects.toThrow('404')
    })
  })

  describe('getRoomTimeline', () => {
    it('builds URL without query params when no options are passed', async () => {
      await service.getRoomTimeline('!r:e')
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', `/rooms/${encodeURIComponent('!r:e')}/timeline`, undefined)
    })

    it('forwards from/limit/dir as query params', async () => {
      await service.getRoomTimeline('!r', { from: 'tok', limit: 20, dir: 'b' })
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', `/rooms/${encodeURIComponent('!r')}/timeline`, {
        from: 'tok',
        limit: '20',
        dir: 'b'
      })
    })

    it('only includes truthy query params', async () => {
      await service.getRoomTimeline('!r', { dir: 'f' })
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', expect.any(String), { dir: 'f' })
    })

    it('swallows backend errors and returns empty-chunk shape', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/rooms/:roomId/timeline`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      expect(await service.getRoomTimeline('!r')).toEqual({ chunk: [], start: '', end: '' })
    })
  })

  describe('getRoomUnreadCount', () => {
    it('GETs /unread_count and defaults missing counters to 0', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/rooms/:roomId/unread_count`, () => {
          return HttpResponse.json({ unread_notifications: 3 })
        })
      )
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 3,
        unread_highlighted: 0
      })
    })

    it('accepts synapse-rust notification_count/highlight_count fields', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/rooms/:roomId/unread_count`, () => {
          return HttpResponse.json({ notification_count: 7, highlight_count: 2 })
        })
      )
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 7,
        unread_highlighted: 2
      })
    })

    it('returns zeros when backend throws', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/rooms/:roomId/unread_count`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 0,
        unread_highlighted: 0
      })
    })
  })

  describe('timestampToEvent', () => {
    it('hits v1 timestamp_to_event with { ts, dir }', async () => {
      await service.timestampToEvent('!r:e', 42, 'f')
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        `/rooms/${encodeURIComponent('!r:e')}/timestamp_to_event`,
        { ts: '42', dir: 'f' },
        undefined,
        { prefix: '/_matrix/client/v1' }
      )
    })

    it('defaults dir to "b" when omitted', async () => {
      await service.timestampToEvent('!r', 10)
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', expect.any(String), { ts: '10', dir: 'b' }, undefined, {
        prefix: '/_matrix/client/v1'
      })
    })

    it('swallows errors and returns null', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v1/rooms/:roomId/timestamp_to_event`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )
      expect(await service.timestampToEvent('!r', 10)).toBeNull()
    })
  })

  describe('getRoomCall', () => {
    it('GETs /rooms/{roomId}/call/{callId}', async () => {
      expect(await service.getRoomCall('!r', 'c-1')).toEqual({ state: 'ringing' })
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        `/rooms/${encodeURIComponent('!r')}/call/${encodeURIComponent('c-1')}`
      )
    })

    it('swallows errors and returns null', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/rooms/:roomId/call/:callId`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )
      expect(await service.getRoomCall('!r', 'c-1')).toBeNull()
    })
  })
})
