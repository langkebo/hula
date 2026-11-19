import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomTimelineService } from '../TimelineService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getRoomUnreadCountMock = vi.fn()
const timestampToEventMock = vi.fn()
const getRoomTimelineMock = vi.fn()
const getRoomNotificationsMock = vi.fn()
const getRoomCallMock = vi.fn()
const getRoomEventPerspectiveMock = vi.fn()
const getRoomEventUrlMock = vi.fn()
const getRoomReducedEventsMock = vi.fn()
const getRoomRenderedMock = vi.fn()
const getRoomFragmentsMock = vi.fn()
const getRoomReceiptsMock = vi.fn()
const createMessagesRequestMock = vi.fn()

describe('MatrixRoomTimelineService', () => {
  let service: InstanceType<typeof MatrixRoomTimelineService>
  let mockClient: {
    getEventContext: ReturnType<typeof vi.fn>
    getRoomManager: () => {
      getRoomUnreadCount: typeof getRoomUnreadCountMock
      getRoomCall: typeof getRoomCallMock
    }
    getRoomSummaryManager: () => {
      getRoomTimeline: typeof getRoomTimelineMock
      getRoomNotifications: typeof getRoomNotificationsMock
      eventOps: {
        getRoomEventPerspective: typeof getRoomEventPerspectiveMock
        getRoomEventUrl: typeof getRoomEventUrlMock
        getRoomReducedEvents: typeof getRoomReducedEventsMock
        getRoomRendered: typeof getRoomRenderedMock
        getRoomFragments: typeof getRoomFragmentsMock
        getRoomReceipts: typeof getRoomReceiptsMock
      }
    }
    mxcUrlToHttp: (url: string) => string | null
    timestampToEvent: typeof timestampToEventMock
    getEventManager: () => { createMessagesRequest: typeof createMessagesRequestMock }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockClient = {
      getEventContext: vi.fn(),
      getRoomManager: () => ({
        getRoomUnreadCount: getRoomUnreadCountMock,
        getRoomCall: getRoomCallMock
      }),
      getRoomSummaryManager: () => ({
        getRoomTimeline: getRoomTimelineMock,
        getRoomNotifications: getRoomNotificationsMock,
        eventOps: {
          getRoomEventPerspective: getRoomEventPerspectiveMock,
          getRoomEventUrl: getRoomEventUrlMock,
          getRoomReducedEvents: getRoomReducedEventsMock,
          getRoomRendered: getRoomRenderedMock,
          getRoomFragments: getRoomFragmentsMock,
          getRoomReceipts: getRoomReceiptsMock
        }
      }),
      mxcUrlToHttp: (url: string) => (url.startsWith('mxc://') ? `https://media.example/${url.slice(6)}` : null),
      timestampToEvent: timestampToEventMock,
      getEventManager: () => ({ createMessagesRequest: createMessagesRequestMock })
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
    it('delegates to RoomSummaryManager.getRoomTimeline without options', async () => {
      getRoomTimelineMock.mockResolvedValue({ chunk: [], start: '', end: '' })
      await service.getRoomTimeline('!r:e')
      expect(getRoomTimelineMock).toHaveBeenCalledWith('!r:e', { from: undefined, limit: undefined, dir: undefined })
    })

    it('forwards from/limit/dir as options', async () => {
      getRoomTimelineMock.mockResolvedValue({ chunk: [], start: '', end: '' })
      await service.getRoomTimeline('!r', { from: 'tok', limit: 20, dir: 'b' })
      expect(getRoomTimelineMock).toHaveBeenCalledWith('!r', { from: 'tok', limit: 20, dir: 'b' })
    })

    it('returns the timeline result shape', async () => {
      getRoomTimelineMock.mockResolvedValue({ chunk: [{ a: 1 }], start: 's', end: 'e' })
      expect(await service.getRoomTimeline('!r')).toEqual({ chunk: [{ a: 1 }], start: 's', end: 'e' })
    })

    it('swallows backend errors and returns empty-chunk shape', async () => {
      getRoomTimelineMock.mockRejectedValue(new Error('boom'))
      expect(await service.getRoomTimeline('!r')).toEqual({ chunk: [], start: '', end: '' })
    })
  })

  describe('getRoomUnreadCount', () => {
    it('delegates to RoomManager.getRoomUnreadCount and maps to unread_* shape', async () => {
      getRoomUnreadCountMock.mockResolvedValue({ notification_count: 3, highlight_count: 0 })
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 3,
        unread_highlighted: 0
      })
      expect(getRoomUnreadCountMock).toHaveBeenCalledWith('!r')
    })

    it('maps notification_count/highlight_count to unread_notifications/unread_highlighted', async () => {
      getRoomUnreadCountMock.mockResolvedValue({ notification_count: 7, highlight_count: 2 })
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 7,
        unread_highlighted: 2
      })
    })

    it('returns zeros when backend throws', async () => {
      getRoomUnreadCountMock.mockRejectedValue(new Error('boom'))
      expect(await service.getRoomUnreadCount('!r')).toEqual({
        unread_notifications: 0,
        unread_highlighted: 0
      })
    })
  })

  describe('timestampToEvent', () => {
    it('delegates to client.timestampToEvent with roomId/timestamp/dir', async () => {
      timestampToEventMock.mockResolvedValue({ event_id: '$e', origin_server_ts: 42 })
      await service.timestampToEvent('!r:e', 42, 'f')
      expect(timestampToEventMock).toHaveBeenCalledWith('!r:e', 42, 'f')
    })

    it('defaults dir to "b" when omitted', async () => {
      timestampToEventMock.mockResolvedValue({ event_id: '$e', origin_server_ts: 10 })
      await service.timestampToEvent('!r', 10)
      expect(timestampToEventMock).toHaveBeenCalledWith('!r', 10, 'b')
    })

    it('swallows errors and returns null', async () => {
      timestampToEventMock.mockRejectedValue(new Error('boom'))
      expect(await service.timestampToEvent('!r', 10)).toBeNull()
    })
  })

  describe('getRoomNotifications', () => {
    it('delegates to RoomSummaryManager.getRoomNotifications', async () => {
      getRoomNotificationsMock.mockResolvedValue({ notifications: [] })
      await service.getRoomNotifications('!r', { from: 'tok', limit: 10 })
      expect(getRoomNotificationsMock).toHaveBeenCalledWith('!r', { from: 'tok', limit: 10 })
    })

    it('swallows backend errors and returns empty notifications', async () => {
      getRoomNotificationsMock.mockRejectedValue(new Error('boom'))
      expect(await service.getRoomNotifications('!r')).toEqual({ notifications: [] })
    })
  })

  describe('getRoomCall', () => {
    it('delegates to RoomManager.getRoomCall', async () => {
      getRoomCallMock.mockResolvedValue({ state: 'ringing' })
      expect(await service.getRoomCall('!r', 'c-1')).toEqual({ state: 'ringing' })
      expect(getRoomCallMock).toHaveBeenCalledWith('!r', 'c-1')
    })

    it('swallows errors and returns null', async () => {
      getRoomCallMock.mockRejectedValue(new Error('boom'))
      expect(await service.getRoomCall('!r', 'c-1')).toBeNull()
    })
  })

  describe('getRoomEventPerspective', () => {
    it('delegates to eventOps and normalizes sorted stats', async () => {
      getRoomEventPerspectiveMock.mockResolvedValue({
        event_id: '$anchor',
        perspective: {
          event_count: 100,
          latest_event_id: '$latest',
          sender_activity: { '@a:e': 40, '@b:e': 60 },
          event_types: { 'm.room.message': 90, 'm.reaction': 9, 'm.bad': 'x' }
        }
      })
      const result = await service.getRoomEventPerspective('!r:e', '$anchor')
      expect(getRoomEventPerspectiveMock).toHaveBeenCalledWith('!r:e', '$anchor')
      expect(result).toEqual({
        status: 'ok',
        stats: {
          eventCount: 100,
          latestEventId: '$latest',
          senderActivity: [
            { userId: '@b:e', count: 60 },
            { userId: '@a:e', count: 40 }
          ],
          eventTypes: [
            { type: 'm.room.message', count: 90 },
            { type: 'm.reaction', count: 9 }
          ]
        }
      })
    })

    it('returns empty when the response lacks the perspective field', async () => {
      getRoomEventPerspectiveMock.mockResolvedValue({ event_id: '$anchor' })
      expect(await service.getRoomEventPerspective('!r:e', '$anchor')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomEventPerspectiveMock.mockRejectedValue(
        Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' })
      )
      expect(await service.getRoomEventPerspective('!r:e', '$anchor')).toEqual({ status: 'unsupported' })
    })

    it('extracts errcode from the error message JSON', async () => {
      getRoomEventPerspectiveMock.mockRejectedValue(
        new Error('Error: {"errcode":"M_UNRECOGNIZED","error":"Unrecognized endpoint"}')
      )
      expect(await service.getRoomEventPerspective('!r:e', '$anchor')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures (e.g. anchor not visible) as error', async () => {
      getRoomEventPerspectiveMock.mockRejectedValue(
        Object.assign(new Error('not found'), { errcode: 'M_NOT_FOUND', httpStatus: 404 })
      )
      expect(await service.getRoomEventPerspective('!r:e', '$anchor')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error instead of throwing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as never)
      expect(await service.getRoomEventPerspective('!r:e', '$anchor')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomEventMediaUrls', () => {
    it('normalizes the backend urls[] shape, dedupes and resolves mxc to http', async () => {
      getRoomEventUrlMock.mockResolvedValue({
        room_id: '!r:e',
        event_id: '$e',
        urls: [
          { type: 'mxc', url: 'mxc://hs.test/abc', field: 'content.url' },
          { type: 'mxc', url: 'mxc://hs.test/abc', field: 'content.info.thumbnail_url' },
          { type: 'mxc', url: 'mxc://hs.test/thumb', field: 'content.info.thumbnail_url' }
        ],
        total: 3
      })

      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({
        status: 'ok',
        urls: [
          {
            type: 'mxc',
            url: 'mxc://hs.test/abc',
            field: 'content.url',
            httpUrl: 'https://media.example/hs.test/abc'
          },
          {
            type: 'mxc',
            url: 'mxc://hs.test/thumb',
            field: 'content.info.thumbnail_url',
            httpUrl: 'https://media.example/hs.test/thumb'
          }
        ]
      })
      expect(getRoomEventUrlMock).toHaveBeenCalledWith('!r:e', '$e')
    })

    it('accepts the SDK-declared url/mxc shape', async () => {
      getRoomEventUrlMock.mockResolvedValue({ url: 'mxc://hs.test/abc' })
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({
        status: 'ok',
        urls: [{ type: 'mxc', url: 'mxc://hs.test/abc', field: 'url', httpUrl: 'https://media.example/hs.test/abc' }]
      })

      getRoomEventUrlMock.mockResolvedValue({ mxc: 'mxc://hs.test/def' })
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({
        status: 'ok',
        urls: [{ type: 'mxc', url: 'mxc://hs.test/def', field: 'mxc', httpUrl: 'https://media.example/hs.test/def' }]
      })
    })

    it('keeps httpUrl null when the client cannot resolve mxc', async () => {
      delete (mockClient as { mxcUrlToHttp?: unknown }).mxcUrlToHttp
      getRoomEventUrlMock.mockResolvedValue({
        urls: [{ type: 'mxc', url: 'mxc://hs.test/abc', field: 'content.url' }]
      })
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({
        status: 'ok',
        urls: [{ type: 'mxc', url: 'mxc://hs.test/abc', field: 'content.url', httpUrl: null }]
      })
    })

    it('returns empty for text messages without attachments', async () => {
      getRoomEventUrlMock.mockResolvedValue({ room_id: '!r:e', event_id: '$e', urls: [], total: 0 })
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomEventUrlMock.mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomEventUrlMock.mockRejectedValue(
        Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN', httpStatus: 403 })
      )
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error instead of throwing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as never)
      expect(await service.getRoomEventMediaUrls('!r:e', '$e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomReducedEvents', () => {
    it('normalizes reduced events and keeps the raw total', async () => {
      getRoomReducedEventsMock.mockResolvedValue({
        events: [
          { event_id: '$1', type: 'm.room.message', sender: '@a:e' },
          { event_id: '$2', type: 'm.room.member', sender: '@b:e' }
        ],
        total: 12
      })

      expect(await service.getRoomReducedEvents('!r:e')).toEqual({
        status: 'ok',
        snapshot: {
          total: 12,
          events: [
            { eventId: '$1', type: 'm.room.message', sender: '@a:e' },
            { eventId: '$2', type: 'm.room.member', sender: '@b:e' }
          ]
        }
      })
      expect(getRoomReducedEventsMock).toHaveBeenCalledWith('!r:e')
    })

    it('drops dirty entries and reports empty when nothing is usable', async () => {
      getRoomReducedEventsMock.mockResolvedValue({ events: [{ foo: 'bar' }] })
      expect(await service.getRoomReducedEvents('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomReducedEventsMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_UNRECOGNIZED' }))
      expect(await service.getRoomReducedEvents('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomReducedEventsMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_FORBIDDEN' }))
      expect(await service.getRoomReducedEvents('!r:e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomRendered', () => {
    it('keeps plain_text and per-event rendered content but never exposes html', async () => {
      getRoomRenderedMock.mockResolvedValue({
        rendered: true,
        plain_text: 'hello',
        html: '<b>hello</b>',
        events: [{ event_id: '$1', rendered_content: 'hello' }]
      })

      const result = await service.getRoomRendered('!r:e')
      expect(result).toEqual({
        status: 'ok',
        snapshot: {
          rendered: true,
          plainText: 'hello',
          events: [{ eventId: '$1', renderedContent: 'hello' }]
        }
      })
      expect(JSON.stringify(result)).not.toContain('<b>')
      expect(getRoomRenderedMock).toHaveBeenCalledWith('!r:e')
    })

    it('keeps rendered=null when the backend omits it', async () => {
      getRoomRenderedMock.mockResolvedValue({ plain_text: 'x' })
      expect(await service.getRoomRendered('!r:e')).toEqual({
        status: 'ok',
        snapshot: { rendered: null, plainText: 'x', events: [] }
      })
    })

    it('reports empty when there is no displayable content', async () => {
      getRoomRenderedMock.mockResolvedValue({ rendered: false })
      expect(await service.getRoomRendered('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomRenderedMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_UNRECOGNIZED' }))
      expect(await service.getRoomRendered('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomRenderedMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_NOT_FOUND' }))
      expect(await service.getRoomRendered('!r:e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomFragments', () => {
    it('normalizes fragments and falls back to the requested user', async () => {
      getRoomFragmentsMock.mockResolvedValue({
        fragments: [
          { start: '$s1', end: '$e1', limited: true },
          { start: '$s2', end: '$e2' }
        ],
        next_batch: 'tok'
      })

      expect(await service.getRoomFragments('!r:e', '@me:e')).toEqual({
        status: 'ok',
        snapshot: {
          userId: '@me:e',
          fragments: [
            { start: '$s1', end: '$e1', limited: true },
            { start: '$s2', end: '$e2', limited: false }
          ],
          prevBatch: null,
          nextBatch: 'tok'
        }
      })
      expect(getRoomFragmentsMock).toHaveBeenCalledWith('!r:e', '@me:e')
    })

    it('drops fragments missing start/end and reports empty', async () => {
      getRoomFragmentsMock.mockResolvedValue({ fragments: [{ start: '$s1' }] })
      expect(await service.getRoomFragments('!r:e', '@me:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomFragmentsMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_UNRECOGNIZED' }))
      expect(await service.getRoomFragments('!r:e', '@me:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomFragmentsMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_FORBIDDEN' }))
      expect(await service.getRoomFragments('!r:e', '@me:e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomReceipts', () => {
    it('reads the receipts[] shape and filters by type/event', async () => {
      getRoomReceiptsMock.mockResolvedValue({
        receipts: [
          {
            type: 'm.read',
            event_id: '$e',
            users: { '@a:e': { ts: 100, thread_id: '$t' }, '@b:e': { ts: 200 } }
          },
          { type: 'm.read.private', event_id: '$e', users: { '@c:e': { ts: 300 } } }
        ]
      })

      expect(await service.getRoomReceipts('!r:e', 'm.read', '$e')).toEqual({
        status: 'ok',
        snapshot: {
          receiptType: 'm.read',
          eventId: '$e',
          users: [
            { userId: '@a:e', ts: 100, threadId: '$t' },
            { userId: '@b:e', ts: 200, threadId: null }
          ]
        }
      })
      expect(getRoomReceiptsMock).toHaveBeenCalledWith('!r:e', 'm.read', '$e')
    })

    it('falls back to a plain users map', async () => {
      getRoomReceiptsMock.mockResolvedValue({ users: { '@a:e': { ts: 100 } } })
      expect(await service.getRoomReceipts('!r:e', 'm.read', '$e')).toEqual({
        status: 'ok',
        snapshot: { receiptType: 'm.read', eventId: '$e', users: [{ userId: '@a:e', ts: 100, threadId: null }] }
      })
    })

    it('reports empty when no user matches', async () => {
      getRoomReceiptsMock.mockResolvedValue({ receipts: [{ type: 'm.read.private', users: { '@c:e': {} } }] })
      expect(await service.getRoomReceipts('!r:e', 'm.read', '$e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomReceiptsMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_UNRECOGNIZED' }))
      expect(await service.getRoomReceipts('!r:e', 'm.read', '$e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomReceiptsMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_FORBIDDEN' }))
      expect(await service.getRoomReceipts('!r:e', 'm.read', '$e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomFiles', () => {
    const fileMessage = (overrides: Record<string, unknown> = {}) => ({
      event_id: '$f1',
      type: 'm.room.message',
      sender: '@alice:e',
      origin_server_ts: 1000,
      content: {
        msgtype: 'm.file',
        body: 'report.pdf',
        url: 'mxc://hs.test/f1',
        info: { size: 2048, mimetype: 'application/pdf' }
      },
      ...overrides
    })

    it('pages backward through /messages and normalizes attachment events', async () => {
      createMessagesRequestMock.mockResolvedValue({
        chunk: [
          fileMessage(),
          // 文本消息不是附件，必须被过滤掉
          { event_id: '$t1', type: 'm.room.message', content: { msgtype: 'm.text', body: 'hi' }, sender: '@a:e' },
          // 非消息事件不应出现在结果里（服务端已按 types 过滤，这里兜底）
          { event_id: '$m1', type: 'm.room.member', content: { membership: 'join' }, sender: '@a:e' }
        ],
        start: 's0',
        end: 'p1'
      })

      const result = await service.getRoomFiles('!r:e')

      expect(createMessagesRequestMock).toHaveBeenCalledWith('!r:e', null, 50, 'b', {
        types: ['m.room.message']
      })
      expect(result).toEqual({
        status: 'ok',
        page: {
          files: [
            {
              eventId: '$f1',
              sender: '@alice:e',
              timestamp: 1000,
              url: 'mxc://hs.test/f1',
              httpUrl: 'https://media.example/hs.test/f1',
              name: 'report.pdf',
              size: 2048,
              mimeType: 'application/pdf',
              kind: 'file',
              encrypted: false,
              encryptedFile: null
            }
          ],
          nextToken: 'p1'
        }
      })
    })

    it('reads encrypted attachments from content.file and keeps unknown metadata null', async () => {
      createMessagesRequestMock.mockResolvedValue({
        chunk: [
          {
            event_id: '$enc1',
            type: 'm.room.message',
            sender: '@bob:e',
            origin_server_ts: 2000,
            content: {
              msgtype: 'm.image',
              body: 'photo.jpg',
              file: { url: 'mxc://hs.test/enc1', key: 'k', iv: 'v', size: 4096 }
            }
          }
        ],
        end: null
      })

      const result = await service.getRoomFiles('!r:e', { from: 'tok', limit: 10 })

      expect(createMessagesRequestMock).toHaveBeenCalledWith('!r:e', 'tok', 10, 'b', {
        types: ['m.room.message']
      })
      expect(result).toEqual({
        status: 'ok',
        page: {
          files: [
            {
              eventId: '$enc1',
              sender: '@bob:e',
              timestamp: 2000,
              url: 'mxc://hs.test/enc1',
              httpUrl: 'https://media.example/hs.test/enc1',
              name: 'photo.jpg',
              size: 4096,
              // content.info 缺失时不编造 MIME
              mimeType: null,
              kind: 'image',
              encrypted: true,
              // 解密描述符必须原样透出，否则下载端无法解密
              encryptedFile: { url: 'mxc://hs.test/enc1', key: 'k', iv: 'v', size: 4096 }
            }
          ],
          // end 为 null 表示已到房间开头
          nextToken: null
        }
      })
    })

    it('dedupes repeated event ids within a page', async () => {
      createMessagesRequestMock.mockResolvedValue({ chunk: [fileMessage(), fileMessage()], end: null })

      const result = await service.getRoomFiles('!r:e')

      expect(result.status).toBe('ok')
      expect(result.status === 'ok' ? result.page.files : []).toHaveLength(1)
    })

    it('treats an empty or all-text page as ok with a null/next token, not as an error', async () => {
      createMessagesRequestMock.mockResolvedValue({ chunk: [], start: 's0', end: 'p2' })
      expect(await service.getRoomFiles('!r:e')).toEqual({
        status: 'ok',
        page: { files: [], nextToken: 'p2' }
      })

      createMessagesRequestMock.mockResolvedValue({ chunk: [], end: null })
      expect(await service.getRoomFiles('!r:e')).toEqual({
        status: 'ok',
        page: { files: [], nextToken: null }
      })
    })

    it('classifies a response without chunk as error instead of rendering an empty room', async () => {
      createMessagesRequestMock.mockResolvedValue({ start: 's0', end: 'p1' })
      expect(await service.getRoomFiles('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      createMessagesRequestMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_UNRECOGNIZED' }))
      expect(await service.getRoomFiles('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      createMessagesRequestMock.mockRejectedValue(Object.assign(new Error('x'), { errcode: 'M_FORBIDDEN' }))
      expect(await service.getRoomFiles('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error instead of throwing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as never)
      expect(await service.getRoomFiles('!r:e')).toEqual({ status: 'error' })
    })
  })
})
