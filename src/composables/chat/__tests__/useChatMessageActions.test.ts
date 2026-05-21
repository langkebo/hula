import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    recallMessage: vi.fn(),
    editMessage: vi.fn(),
    getRoomMessage: vi.fn(),
    sendStructuredMessage: vi.fn(),
    sendTextMessage: vi.fn(),
    sendHtmlMessage: vi.fn(),
    addReaction: vi.fn(),
    removeReaction: vi.fn()
  }
}))

vi.mock('@/services/matrix/messaging/MatrixForwardService', () => ({
  matrixForwardService: {
    forwardEvent: vi.fn(),
    forwardEventToMultipleRooms: vi.fn(),
    forwardRoomMessages: vi.fn()
  }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { matrixForwardService } from '@/services/matrix/messaging/MatrixForwardService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { useChatMessageActions } from '../useChatMessageActions'

describe('useChatMessageActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // recallMessage
  // ============================================================================

  describe('recallMessage', () => {
    it('delegates to matrixMessageService.recallMessage', () => {
      const { recallMessage } = useChatMessageActions()
      recallMessage('room1', 'event1')
      expect(matrixMessageService.recallMessage).toHaveBeenCalledWith('room1', 'event1', undefined)
    })

    it('passes txId parameter', () => {
      const { recallMessage } = useChatMessageActions()
      recallMessage('room1', 'event1', 'tx123')
      expect(matrixMessageService.recallMessage).toHaveBeenCalledWith('room1', 'event1', 'tx123')
    })
  })

  // ============================================================================
  // editMessage
  // ============================================================================

  describe('editMessage', () => {
    it('delegates to matrixMessageService.editMessage', () => {
      const { editMessage } = useChatMessageActions()
      editMessage('room1', 'event1', 'new content')
      expect(matrixMessageService.editMessage).toHaveBeenCalledWith('room1', 'event1', 'new content')
    })
  })

  // ============================================================================
  // getRoomMessage
  // ============================================================================

  describe('getRoomMessage', () => {
    it('returns message from service', async () => {
      const mockEvent = { getId: () => 'event1' } as any
      vi.mocked(matrixMessageService.getRoomMessage).mockResolvedValueOnce(mockEvent)

      const { getRoomMessage } = useChatMessageActions()
      const result = await getRoomMessage('room1', 'event1')

      expect(matrixMessageService.getRoomMessage).toHaveBeenCalledWith('room1', 'event1')
      expect(result).toBe(mockEvent)
    })

    it('returns null when message not found', async () => {
      vi.mocked(matrixMessageService.getRoomMessage).mockResolvedValueOnce(null)

      const { getRoomMessage } = useChatMessageActions()
      const result = await getRoomMessage('room1', 'event1')

      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // sendStructuredMessage
  // ============================================================================

  describe('sendStructuredMessage', () => {
    it('delegates to matrixMessageService.sendStructuredMessage', async () => {
      const mockResponse = { event_id: '$event1' } as any
      vi.mocked(matrixMessageService.sendStructuredMessage).mockResolvedValueOnce(mockResponse)

      const payload = { roomId: 'room1', content: { msgtype: 'm.text', body: 'hello' } } as any
      const { sendStructuredMessage } = useChatMessageActions()
      const result = await sendStructuredMessage(payload)

      expect(matrixMessageService.sendStructuredMessage).toHaveBeenCalledWith(payload)
      expect(result).toBe(mockResponse)
    })
  })

  // ============================================================================
  // sendTextMessage
  // ============================================================================

  describe('sendTextMessage', () => {
    it('delegates to matrixMessageService.sendTextMessage', async () => {
      const mockResponse = { event_id: '$event1' } as any
      vi.mocked(matrixMessageService.sendTextMessage).mockResolvedValueOnce(mockResponse)

      const { sendTextMessage } = useChatMessageActions()
      const result = await sendTextMessage('room1', 'hello')

      expect(matrixMessageService.sendTextMessage).toHaveBeenCalledWith('room1', 'hello', undefined)
      expect(result).toBe(mockResponse)
    })

    it('passes txId parameter', async () => {
      vi.mocked(matrixMessageService.sendTextMessage).mockResolvedValueOnce({} as any)

      const { sendTextMessage } = useChatMessageActions()
      await sendTextMessage('room1', 'hello', 'tx123')

      expect(matrixMessageService.sendTextMessage).toHaveBeenCalledWith('room1', 'hello', 'tx123')
    })
  })

  // ============================================================================
  // sendHtmlMessage
  // ============================================================================

  describe('sendHtmlMessage', () => {
    it('delegates to matrixMessageService.sendHtmlMessage', async () => {
      const mockResponse = { event_id: '$event1' } as any
      vi.mocked(matrixMessageService.sendHtmlMessage).mockResolvedValueOnce(mockResponse)

      const { sendHtmlMessage } = useChatMessageActions()
      const result = await sendHtmlMessage('room1', 'plain text', '<b>html</b>')

      expect(matrixMessageService.sendHtmlMessage).toHaveBeenCalledWith('room1', 'plain text', '<b>html</b>', undefined)
      expect(result).toBe(mockResponse)
    })

    it('passes txId parameter', async () => {
      vi.mocked(matrixMessageService.sendHtmlMessage).mockResolvedValueOnce({} as any)

      const { sendHtmlMessage } = useChatMessageActions()
      await sendHtmlMessage('room1', 'plain', '<b>html</b>', 'tx123')

      expect(matrixMessageService.sendHtmlMessage).toHaveBeenCalledWith('room1', 'plain', '<b>html</b>', 'tx123')
    })
  })

  // ============================================================================
  // addReaction
  // ============================================================================

  describe('addReaction', () => {
    it('delegates to matrixMessageService.addReaction', () => {
      const { addReaction } = useChatMessageActions()
      addReaction('room1', 'event1', '👍')
      expect(matrixMessageService.addReaction).toHaveBeenCalledWith('room1', 'event1', '👍')
    })
  })

  // ============================================================================
  // removeReaction
  // ============================================================================

  describe('removeReaction', () => {
    it('delegates to matrixMessageService.removeReaction', () => {
      const { removeReaction } = useChatMessageActions()
      removeReaction('room1', 'event1', '👍', 'reactionEvent1')
      expect(matrixMessageService.removeReaction).toHaveBeenCalledWith('room1', 'event1', '👍', 'reactionEvent1')
    })
  })

  // ============================================================================
  // forwardEvent
  // ============================================================================

  describe('forwardEvent', () => {
    it('delegates to matrixForwardService.forwardEvent', async () => {
      const mockEvent = { getId: () => 'event1' } as any
      vi.mocked(matrixForwardService.forwardEvent).mockResolvedValueOnce('$forwarded1')

      const { forwardEvent } = useChatMessageActions()
      const result = await forwardEvent(mockEvent, 'targetRoom1')

      expect(matrixForwardService.forwardEvent).toHaveBeenCalledWith(mockEvent, 'targetRoom1')
      expect(result).toBe('$forwarded1')
    })
  })

  // ============================================================================
  // forwardEventToMultipleRooms
  // ============================================================================

  describe('forwardEventToMultipleRooms', () => {
    it('delegates to matrixForwardService.forwardEventToMultipleRooms', async () => {
      const mockEvent = { getId: () => 'event1' } as any
      const mockResults = [{ roomId: 'room1', eventId: '$fwd1', success: true }] as any
      vi.mocked(matrixForwardService.forwardEventToMultipleRooms).mockResolvedValueOnce(mockResults)

      const { forwardEventToMultipleRooms } = useChatMessageActions()
      const result = await forwardEventToMultipleRooms(mockEvent, ['room1', 'room2'])

      expect(matrixForwardService.forwardEventToMultipleRooms).toHaveBeenCalledWith(mockEvent, ['room1', 'room2'])
      expect(result).toBe(mockResults)
    })
  })

  // ============================================================================
  // forwardRoomMessages
  // ============================================================================

  describe('forwardRoomMessages', () => {
    it('delegates to matrixForwardService.forwardRoomMessages', async () => {
      const mockResults = [{ roomId: 'target1', eventId: '$fwd1', success: true }] as any
      vi.mocked(matrixForwardService.forwardRoomMessages).mockResolvedValueOnce(mockResults)

      const { forwardRoomMessages } = useChatMessageActions()
      const result = await forwardRoomMessages('sourceRoom1', ['event1', 'event2'], ['target1'])

      expect(matrixForwardService.forwardRoomMessages).toHaveBeenCalledWith(
        'sourceRoom1',
        ['event1', 'event2'],
        ['target1']
      )
      expect(result).toBe(mockResults)
    })
  })

  // ============================================================================
  // enqueueOfflineMessage
  // ============================================================================

  describe('enqueueOfflineMessage', () => {
    it('delegates to offlineQueueService.enqueue', () => {
      const { enqueueOfflineMessage } = useChatMessageActions()
      const content = { body: 'hello', msgtype: 'm.text' }
      enqueueOfflineMessage('send_message' as any, 'room1', content)

      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('send_message', 'room1', content)
    })
  })

  // ============================================================================
  // error propagation
  // ============================================================================

  describe('error propagation', () => {
    it('recallMessage propagates errors from service', async () => {
      const error = new Error('recall failed')
      vi.mocked(matrixMessageService.recallMessage).mockRejectedValueOnce(error)

      const { recallMessage } = useChatMessageActions()
      await expect(recallMessage('room1', 'event1')).rejects.toThrow('recall failed')
    })

    it('editMessage propagates errors from service', async () => {
      const error = new Error('edit failed')
      vi.mocked(matrixMessageService.editMessage).mockRejectedValueOnce(error)

      const { editMessage } = useChatMessageActions()
      await expect(editMessage('room1', 'event1', 'new')).rejects.toThrow('edit failed')
    })

    it('getRoomMessage propagates errors from service', async () => {
      const error = new Error('get failed')
      vi.mocked(matrixMessageService.getRoomMessage).mockRejectedValueOnce(error)

      const { getRoomMessage } = useChatMessageActions()
      await expect(getRoomMessage('room1', 'event1')).rejects.toThrow('get failed')
    })

    it('sendTextMessage propagates errors from service', async () => {
      const error = new Error('send failed')
      vi.mocked(matrixMessageService.sendTextMessage).mockRejectedValueOnce(error)

      const { sendTextMessage } = useChatMessageActions()
      await expect(sendTextMessage('room1', 'hello')).rejects.toThrow('send failed')
    })

    it('sendHtmlMessage propagates errors from service', async () => {
      const error = new Error('send html failed')
      vi.mocked(matrixMessageService.sendHtmlMessage).mockRejectedValueOnce(error)

      const { sendHtmlMessage } = useChatMessageActions()
      await expect(sendHtmlMessage('room1', 'body', '<b>html</b>')).rejects.toThrow('send html failed')
    })

    it('addReaction propagates errors from service', async () => {
      const error = new Error('reaction failed')
      vi.mocked(matrixMessageService.addReaction).mockRejectedValueOnce(error)

      const { addReaction } = useChatMessageActions()
      await expect(addReaction('room1', 'event1', '👍')).rejects.toThrow('reaction failed')
    })

    it('forwardEvent propagates errors from service', async () => {
      const error = new Error('forward failed')
      vi.mocked(matrixForwardService.forwardEvent).mockRejectedValueOnce(error)

      const { forwardEvent } = useChatMessageActions()
      await expect(forwardEvent({} as any, 'targetRoom1')).rejects.toThrow('forward failed')
    })

    it('enqueueOfflineMessage propagates errors from service', async () => {
      const error = new Error('enqueue failed')
      vi.mocked(offlineQueueService.enqueue).mockRejectedValueOnce(error)

      const { enqueueOfflineMessage } = useChatMessageActions()
      await expect(enqueueOfflineMessage('send_message' as any, 'room1', {})).rejects.toThrow('enqueue failed')
    })
  })
})
