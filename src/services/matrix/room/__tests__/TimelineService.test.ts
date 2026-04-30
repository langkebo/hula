import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const { MatrixRoomTimelineService } = await import('../TimelineService')

const makeHttpClient = (impl: (method: string, url: string, qp?: unknown, body?: unknown) => unknown) => ({
  http: {
    authedRequest: vi.fn((method: string, url: string, qp?: unknown, body?: unknown) => impl(method, url, qp, body))
  }
})

describe('MatrixRoomTimelineService', () => {
  let service: InstanceType<typeof MatrixRoomTimelineService>

  beforeEach(() => {
    service = new MatrixRoomTimelineService()
    getClientMock.mockReset()
  })

  describe('getEventContext', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getEventContext('!r', '$e')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('forwards to client.getEventContext with the limit option', async () => {
      const payload = { event: {}, events_before: [], events_after: [], state: [] }
      const getEventContext = vi.fn().mockResolvedValue(payload)
      getClientMock.mockReturnValueOnce({ getEventContext })
      expect(await service.getEventContext('!r', '$e', 25)).toBe(payload)
      expect(getEventContext).toHaveBeenCalledWith('!r', '$e', { limit: 25 })
    })

    it('uses default limit=10 when omitted', async () => {
      const getEventContext = vi.fn().mockResolvedValue({})
      getClientMock.mockReturnValueOnce({ getEventContext })
      await service.getEventContext('!r', '$e')
      expect(getEventContext).toHaveBeenCalledWith('!r', '$e', { limit: 10 })
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        getEventContext: vi.fn().mockRejectedValue(new Error('404'))
      })
      await expect(service.getEventContext('!r', '$e')).rejects.toThrow('404')
    })
  })

  describe('getRoomTimeline', () => {
    it('builds URL without query params when no options are passed', async () => {
      const client = makeHttpClient(() => ({ chunk: [], start: '', end: '' }))
      getClientMock.mockReturnValueOnce(client)
      await service.getRoomTimeline('!r:e')
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r:e')}/timeline`,
        undefined
      )
    })

    it('forwards from/limit/dir as query params', async () => {
      const client = makeHttpClient(() => ({ chunk: [], start: 's', end: 'e' }))
      getClientMock.mockReturnValueOnce(client)
      await service.getRoomTimeline('!r', { from: 'tok', limit: 20, dir: 'b' })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/timeline`,
        { from: 'tok', limit: '20', dir: 'b' }
      )
    })

    it('only includes truthy query params', async () => {
      const client = makeHttpClient(() => ({ chunk: [], start: '', end: '' }))
      getClientMock.mockReturnValueOnce(client)
      await service.getRoomTimeline('!r', { dir: 'f' })
      expect(client.http.authedRequest).toHaveBeenCalledWith('GET', expect.any(String), { dir: 'f' })
    })

    it('swallows backend errors and returns empty-chunk shape', async () => {
      getClientMock.mockReturnValueOnce(
        makeHttpClient(() => {
          throw new Error('500')
        })
      )
      expect(await service.getRoomTimeline('!r')).toEqual({ chunk: [], start: '', end: '' })
    })
  })

  describe('getRoomUnreadCount', () => {
    it('GETs /unread_count and defaults missing counters to 0', async () => {
      const client = makeHttpClient(() => ({ unread_notifications: 3 }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 3,
        unread_highlighted: 0
      })
    })

    it('accepts synapse-rust notification_count/highlight_count fields', async () => {
      const client = makeHttpClient(() => ({ notification_count: 7, highlight_count: 2 }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 7,
        unread_highlighted: 2
      })
    })

    it('returns zeros when backend throws', async () => {
      getClientMock.mockReturnValueOnce(
        makeHttpClient(() => {
          throw new Error('500')
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
      const client = makeHttpClient(() => ({ event_id: '$e', origin_server_ts: 42 }))
      getClientMock.mockReturnValueOnce(client)
      await service.timestampToEvent('!r:e', 42, 'f')
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v1/rooms/${encodeURIComponent('!r:e')}/timestamp_to_event`,
        { ts: '42', dir: 'f' }
      )
    })

    it('defaults dir to "b" when omitted', async () => {
      const client = makeHttpClient(() => ({ event_id: '$e', origin_server_ts: 0 }))
      getClientMock.mockReturnValueOnce(client)
      await service.timestampToEvent('!r', 10)
      expect(client.http.authedRequest).toHaveBeenCalledWith('GET', expect.any(String), { ts: '10', dir: 'b' })
    })

    it('swallows errors and returns null', async () => {
      getClientMock.mockReturnValueOnce(
        makeHttpClient(() => {
          throw new Error('404')
        })
      )
      expect(await service.timestampToEvent('!r', 10)).toBeNull()
    })
  })

  describe('getRoomCall', () => {
    it('GETs /rooms/{roomId}/call/{callId}', async () => {
      const client = makeHttpClient(() => ({ state: 'ringing' }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomCall('!r', 'c-1')).toEqual({ state: 'ringing' })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/call/${encodeURIComponent('c-1')}`
      )
    })

    it('swallows errors and returns null', async () => {
      getClientMock.mockReturnValueOnce(
        makeHttpClient(() => {
          throw new Error('404')
        })
      )
      expect(await service.getRoomCall('!r', 'c-1')).toBeNull()
    })
  })
})
