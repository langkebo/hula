import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixMessageRelationService } from '../MatrixMessageRelationService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

function createMockEvent(id: string, sender: string, content: Record<string, unknown>, ts = Date.now()) {
  return {
    getId: () => id,
    getSender: () => sender,
    getContent: () => content,
    getTs: () => ts
  }
}

describe('MatrixMessageRelationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isEdited', () => {
    it('should return true for edited event', () => {
      const event = createMockEvent('$1', '@user:server', {
        body: '* edited',
        'm.new_content': { body: 'edited', msgtype: 'm.text' },
        'm.relates_to': { rel_type: 'm.replace', event_id: '$0' }
      })
      expect(matrixMessageRelationService.isEdited(event as unknown as MatrixEvent)).toBe(true)
    })

    it('should return false for non-edited event', () => {
      const event = createMockEvent('$1', '@user:server', { body: 'hello', msgtype: 'm.text' })
      expect(matrixMessageRelationService.isEdited(event as unknown as MatrixEvent)).toBe(false)
    })
  })

  describe('getEditedContent', () => {
    it('should return new content for edited event', () => {
      const newContent = { body: 'edited', msgtype: 'm.text' }
      const event = createMockEvent('$1', '@user:server', {
        body: '* edited',
        'm.new_content': newContent
      })
      expect(matrixMessageRelationService.getEditedContent(event as unknown as MatrixEvent)).toEqual(newContent)
    })

    it('should return original content for non-edited event', () => {
      const content = { body: 'hello', msgtype: 'm.text' }
      const event = createMockEvent('$1', '@user:server', content)
      expect(matrixMessageRelationService.getEditedContent(event as unknown as MatrixEvent)).toEqual(content)
    })
  })

  describe('getReplyToEventId', () => {
    it('should extract reply event id', () => {
      const event = createMockEvent('$1', '@user:server', {
        body: 'reply',
        'm.relates_to': { 'm.in_reply_to': { event_id: '$0' } }
      })
      expect(matrixMessageRelationService.getReplyToEventId(event as unknown as MatrixEvent)).toBe('$0')
    })

    it('should return null for non-reply event', () => {
      const event = createMockEvent('$1', '@user:server', { body: 'hello' })
      expect(matrixMessageRelationService.getReplyToEventId(event as unknown as MatrixEvent)).toBeNull()
    })
  })

  describe('getThreadRootId', () => {
    it('should extract thread root id', () => {
      const event = createMockEvent('$1', '@user:server', {
        body: 'thread reply',
        'm.relates_to': { rel_type: 'm.thread', event_id: '$root' }
      })
      expect(matrixMessageRelationService.getThreadRootId(event as unknown as MatrixEvent)).toBe('$root')
    })

    it('should return null for non-thread event', () => {
      const event = createMockEvent('$1', '@user:server', {
        body: 'reply',
        'm.relates_to': { 'm.in_reply_to': { event_id: '$0' } }
      })
      expect(matrixMessageRelationService.getThreadRootId(event as unknown as MatrixEvent)).toBeNull()
    })
  })

  describe('editMessage', () => {
    it('should throw if client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(matrixMessageRelationService.editMessage('!r:s', '$e', { body: 'new' })).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should throw if room not found', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => null),
        getUserId: vi.fn(() => '@me:server')
      } as unknown as MatrixClient)
      await expect(matrixMessageRelationService.editMessage('!r:s', '$e', { body: 'new' })).rejects.toThrow(
        '房间不存在'
      )
    })

    it('should throw if original event not found', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({ findEventById: vi.fn(() => null) })),
        getUserId: vi.fn(() => '@me:server')
      } as unknown as MatrixClient)
      await expect(matrixMessageRelationService.editMessage('!r:s', '$e', { body: 'new' })).rejects.toThrow(
        '原始消息不存在'
      )
    })

    it('should throw if not own message', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          findEventById: vi.fn(() => createMockEvent('$e', '@other:server', { body: 'old' }))
        })),
        getUserId: vi.fn(() => '@me:server')
      } as unknown as MatrixClient)
      await expect(matrixMessageRelationService.editMessage('!r:s', '$e', { body: 'new' })).rejects.toThrow(
        '只能编辑自己发送的消息'
      )
    })

    it('should send edit event successfully', async () => {
      const sendEvent = vi.fn().mockResolvedValue({ event_id: '$new' })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          findEventById: vi.fn(() => createMockEvent('$e', '@me:server', { body: 'old', msgtype: 'm.text' }))
        })),
        getUserId: vi.fn(() => '@me:server'),
        sendEvent
      } as unknown as MatrixClient)
      const result = await matrixMessageRelationService.editMessage('!r:s', '$e', { body: 'new text' })
      expect(result).toBe('$new')
      expect(sendEvent).toHaveBeenCalled()
    })
  })

  describe('replyToMessage', () => {
    it('should throw if client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(matrixMessageRelationService.replyToMessage('!r:s', '$e', { body: 'reply' })).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should send reply event successfully', async () => {
      const sendEvent = vi.fn().mockResolvedValue({ event_id: '$reply' })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          findEventById: vi.fn(() => createMockEvent('$e', '@other:server', { body: 'orig' }))
        })),
        sendEvent
      } as unknown as MatrixClient)
      const result = await matrixMessageRelationService.replyToMessage('!r:s', '$e', { body: 'my reply' })
      expect(result).toBe('$reply')
    })
  })

  describe('replyInThread', () => {
    it('should send thread reply successfully', async () => {
      const sendEvent = vi.fn().mockResolvedValue({ event_id: '$thread_reply' })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        sendEvent
      } as unknown as MatrixClient)
      const result = await matrixMessageRelationService.replyInThread('!r:s', '$root', { body: 'thread reply' })
      expect(result).toBe('$thread_reply')
      expect(sendEvent).toHaveBeenCalledWith(
        '!r:s',
        'm.room.message',
        expect.objectContaining({
          'm.relates_to': { rel_type: 'm.thread', event_id: '$root', 'm.in_reply_to': { event_id: '$root' } }
        })
      )
    })
  })

  describe('getEditHistory', () => {
    it('should return empty array when no client', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      const result = matrixMessageRelationService.getEditHistory('!r:s', '$e')
      expect(result).toEqual([])
    })

    it('should collect edit events', () => {
      const editEvent = createMockEvent(
        '$edit1',
        '@me:server',
        {
          body: '* edited',
          'm.new_content': { body: 'edited' },
          'm.relates_to': { rel_type: 'm.replace', event_id: '$e' }
        },
        2000
      )
      const otherEvent = createMockEvent('$other', '@me:server', { body: 'other' }, 1000)

      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: vi.fn(() => ({
          getUnfilteredTimelineSet: () => ({
            getLiveTimeline: () => ({ getEvents: () => [otherEvent, editEvent] })
          })
        }))
      } as unknown as MatrixClient)

      const result = matrixMessageRelationService.getEditHistory('!r:s', '$e')
      expect(result).toHaveLength(1)
      expect(result[0].eventId).toBe('$edit1')
    })
  })
})
