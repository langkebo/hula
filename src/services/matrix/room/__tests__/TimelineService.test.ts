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
    }
    timestampToEvent: typeof timestampToEventMock
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
        getRoomNotifications: getRoomNotificationsMock
      }),
      timestampToEvent: timestampToEventMock
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
})
