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

const enqueueMock = vi.fn()
vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: (...args: any[]) => enqueueMock(...args)
  }
}))

const { MatrixRoomPinsService } = await import('../PinsService')

describe('MatrixRoomPinsService', () => {
  let service: InstanceType<typeof MatrixRoomPinsService>

  beforeEach(() => {
    service = new MatrixRoomPinsService()
    getClientMock.mockReset()
    enqueueMock.mockReset()
  })

  describe('getPinnedEvents', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getPinnedEvents('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('returns [] when room is not in local cache', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await service.getPinnedEvents('!r')).toEqual([])
    })

    it('reads m.room.pinned_events state event content', async () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({
            getContent: () => ({ pinned: ['$e1', '$e2'] })
          }))
        }
      }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await service.getPinnedEvents('!r')).toEqual(['$e1', '$e2'])
      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('m.room.pinned_events', '')
    })

    it('returns [] when state event content lacks `pinned`', async () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({ getContent: () => ({}) }))
        }
      }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await service.getPinnedEvents('!r')).toEqual([])
    })

    it('swallows backend errors and returns []', async () => {
      getClientMock.mockReturnValueOnce({
        getRoom: () => {
          throw new Error('boom')
        }
      })
      expect(await service.getPinnedEvents('!r')).toEqual([])
    })
  })

  describe('setPinnedEvents', () => {
    it('sends m.room.pinned_events state event with `pinned` payload', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ sendStateEvent })
      await service.setPinnedEvents('!r', ['$e1'])
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e1'] }, '')
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        sendStateEvent: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.setPinnedEvents('!r', [])).rejects.toThrow('403')
    })

    it('enqueues pinned events when offline', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      await service.setPinnedEvents('!r', ['$e1'])
      expect(enqueueMock).toHaveBeenCalledWith('pin', '!r', { roomId: '!r', type: 'pinned', eventIds: ['$e1'] })
      vi.stubGlobal('navigator', { onLine: true })
    })
  })

  describe('getStickyEvents', () => {
    it('GETs /sticky_events and returns the payload as-is', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ a: 1 })
      getClientMock.mockReturnValueOnce({ http: { authedRequest } })
      expect(await service.getStickyEvents('!r:e')).toEqual({ a: 1 })
      expect(authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r:e')}/sticky_events`
      )
    })

    it('swallows backend errors and returns {}', async () => {
      getClientMock.mockReturnValueOnce({
        http: {
          authedRequest: vi.fn().mockRejectedValue(new Error('500'))
        }
      })
      expect(await service.getStickyEvents('!r')).toEqual({})
    })
  })

  describe('setStickyEvents', () => {
    it('POSTs /sticky_events with the events body', async () => {
      const authedRequest = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ http: { authedRequest } })
      await service.setStickyEvents('!r', { x: 1 })
      expect(authedRequest).toHaveBeenCalledWith(
        'POST',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/sticky_events`,
        undefined,
        { x: 1 }
      )
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        http: { authedRequest: vi.fn().mockRejectedValue(new Error('403')) }
      })
      await expect(service.setStickyEvents('!r', {})).rejects.toThrow('403')
    })

    it('enqueues sticky events when offline', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      await service.setStickyEvents('!r', { x: 1 })
      expect(enqueueMock).toHaveBeenCalledWith('pin', '!r', { roomId: '!r', type: 'sticky', events: { x: 1 } })
      vi.stubGlobal('navigator', { onLine: true })
    })
  })
})
