import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockClient = {
  _unstable_sendDelayedEvent: vi.fn(),
  _unstable_sendDelayedStateEvent: vi.fn(),
  _unstable_sendStickyDelayedEvent: vi.fn(),
  _unstable_getDelayedEvents: vi.fn(),
  _unstable_cancelScheduledDelayedEvent: vi.fn(),
  _unstable_restartScheduledDelayedEvent: vi.fn(),
  _unstable_sendScheduledDelayedEvent: vi.fn()
}

import matrixClientService from '../../MatrixClientService'
import { matrixDelayedEventsService } from '../MatrixDelayedEventsService'

describe('MatrixDelayedEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as never)
  })

  describe('sendDelayedEvent', () => {
    it('forwards args to SDK _unstable_sendDelayedEvent and returns delay_id', async () => {
      mockClient._unstable_sendDelayedEvent.mockResolvedValue({ delay_id: 'd1' })
      const result = await matrixDelayedEventsService.sendDelayedEvent(
        '!room:test',
        'm.room.message',
        { body: 'hi' },
        { delay: 5000 },
        null,
        'txn-1'
      )
      expect(mockClient._unstable_sendDelayedEvent).toHaveBeenCalledWith(
        '!room:test',
        { delay: 5000 },
        null,
        'm.room.message',
        { body: 'hi' },
        'txn-1'
      )
      expect(result).toEqual({ delay_id: 'd1' })
    })

    it('throws when client is not initialized', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as never)
      await expect(
        matrixDelayedEventsService.sendDelayedEvent('!room:test', 'm.room.message', {}, { delay: 1000 })
      ).rejects.toThrow(/Matrix client not initialized/)
    })
  })

  describe('sendDelayedStateEvent', () => {
    it('forwards args to SDK _unstable_sendDelayedStateEvent', async () => {
      mockClient._unstable_sendDelayedStateEvent.mockResolvedValue({ delay_id: 'd2' })
      const result = await matrixDelayedEventsService.sendDelayedStateEvent(
        '!room:test',
        'm.room.name',
        { name: 'New Name' },
        { delay: 10000 },
        ''
      )
      expect(mockClient._unstable_sendDelayedStateEvent).toHaveBeenCalledWith(
        '!room:test',
        { delay: 10000 },
        'm.room.name',
        { name: 'New Name' },
        ''
      )
      expect(result).toEqual({ delay_id: 'd2' })
    })
  })

  describe('sendStickyDelayedEvent', () => {
    it('forwards args including stickDuration', async () => {
      mockClient._unstable_sendStickyDelayedEvent.mockResolvedValue({ delay_id: 'd3' })
      const result = await matrixDelayedEventsService.sendStickyDelayedEvent(
        '!room:test',
        30000,
        'm.room.message',
        { body: 'sticky', msc4354_sticky_key: 'k1' },
        { delay: 5000 }
      )
      expect(mockClient._unstable_sendStickyDelayedEvent).toHaveBeenCalledWith(
        '!room:test',
        30000,
        { delay: 5000 },
        null,
        'm.room.message',
        { body: 'sticky', msc4354_sticky_key: 'k1' },
        undefined
      )
      expect(result).toEqual({ delay_id: 'd3' })
    })
  })

  describe('getDelayedEvents', () => {
    it('forwards status/delayId/fromToken to SDK and returns DelayedEventInfo', async () => {
      const info = { scheduled: [], finalised: [] }
      mockClient._unstable_getDelayedEvents.mockResolvedValue(info)
      const result = await matrixDelayedEventsService.getDelayedEvents('scheduled', 'd1', 'tok')
      expect(mockClient._unstable_getDelayedEvents).toHaveBeenCalledWith('scheduled', 'd1', 'tok')
      expect(result).toBe(info)
    })
  })

  describe('updateScheduledDelayedEvent', () => {
    it('cancel routes to _unstable_cancelScheduledDelayedEvent', async () => {
      mockClient._unstable_cancelScheduledDelayedEvent.mockResolvedValue({})
      const result = await matrixDelayedEventsService.updateScheduledDelayedEvent('d1', 'cancel')
      expect(mockClient._unstable_cancelScheduledDelayedEvent).toHaveBeenCalledWith('d1')
      expect(result).toEqual({ ok: true })
    })

    it('restart routes to _unstable_restartScheduledDelayedEvent', async () => {
      mockClient._unstable_restartScheduledDelayedEvent.mockResolvedValue({})
      await matrixDelayedEventsService.updateScheduledDelayedEvent('d1', 'restart')
      expect(mockClient._unstable_restartScheduledDelayedEvent).toHaveBeenCalledWith('d1')
    })

    it('send routes to _unstable_sendScheduledDelayedEvent', async () => {
      mockClient._unstable_sendScheduledDelayedEvent.mockResolvedValue({})
      await matrixDelayedEventsService.updateScheduledDelayedEvent('d1', 'send')
      expect(mockClient._unstable_sendScheduledDelayedEvent).toHaveBeenCalledWith('d1')
    })
  })

  describe('convenience wrappers', () => {
    it('cancelScheduledDelayedEvent delegates to updateScheduledDelayedEvent(cancel)', async () => {
      mockClient._unstable_cancelScheduledDelayedEvent.mockResolvedValue({})
      const result = await matrixDelayedEventsService.cancelScheduledDelayedEvent('d1')
      expect(mockClient._unstable_cancelScheduledDelayedEvent).toHaveBeenCalledWith('d1')
      expect(result).toEqual({ ok: true })
    })

    it('restartScheduledDelayedEvent delegates to updateScheduledDelayedEvent(restart)', async () => {
      mockClient._unstable_restartScheduledDelayedEvent.mockResolvedValue({})
      await matrixDelayedEventsService.restartScheduledDelayedEvent('d1')
      expect(mockClient._unstable_restartScheduledDelayedEvent).toHaveBeenCalledWith('d1')
    })

    it('sendScheduledDelayedEvent delegates to updateScheduledDelayedEvent(send)', async () => {
      mockClient._unstable_sendScheduledDelayedEvent.mockResolvedValue({})
      await matrixDelayedEventsService.sendScheduledDelayedEvent('d1')
      expect(mockClient._unstable_sendScheduledDelayedEvent).toHaveBeenCalledWith('d1')
    })
  })
})
