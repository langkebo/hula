import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixMessageService } from '../MatrixMessageService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockGetClient = vi.fn()

vi.mock('../MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => mockGetClient()
  }
}))

describe('MatrixMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendTextMessage', () => {
    it('should send text message successfully', async () => {
      const mockResponse = { event_id: '$event1' }
      const mockClient = {
        sendTextMessage: vi.fn().mockResolvedValue(mockResponse)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.sendTextMessage('!room1', 'Hello')
      expect(result).toEqual(mockResponse)
      expect(mockClient.sendTextMessage).toHaveBeenCalledWith('!room1', 'Hello', expect.any(String))
    })

    it('should return null when client not initialized and throwOnError=false', async () => {
      mockGetClient.mockReturnValue(null)

      const result = await matrixMessageService.sendTextMessage('!room1', 'Hello', undefined, false)
      expect(result).toBeNull()
    })

    it('should throw when client not initialized and throwOnError=true', async () => {
      mockGetClient.mockReturnValue(null)

      await expect(matrixMessageService.sendTextMessage('!room1', 'Hello', undefined, true)).rejects.toThrow()
    })
  })

  describe('sendHtmlMessage', () => {
    it('should send HTML message successfully', async () => {
      const mockResponse = { event_id: '$event2' }
      const mockClient = {
        sendHtmlMessage: vi.fn().mockResolvedValue(mockResponse)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.sendHtmlMessage('!room1', 'plain', '<b>bold</b>')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('recallMessage', () => {
    it('should redact message successfully', async () => {
      const mockClient = {
        redactEvent: vi.fn().mockResolvedValue({})
      }
      mockGetClient.mockReturnValue(mockClient)

      await matrixMessageService.recallMessage('!room1', '$event1')
      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room1', '$event1', expect.any(String))
    })

    it('should not throw when redact fails and throwOnError=false', async () => {
      const mockClient = {
        redactEvent: vi.fn().mockRejectedValue(new Error('Failed'))
      }
      mockGetClient.mockReturnValue(mockClient)

      await expect(matrixMessageService.recallMessage('!room1', '$event1', undefined, false)).resolves.toBeUndefined()
    })
  })

  describe('addReaction', () => {
    it('should add reaction successfully', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$reaction1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      await matrixMessageService.addReaction('!room1', '$event1', '👍')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        expect.any(String),
        expect.objectContaining({
          type: 'm.reaction',
          content: expect.objectContaining({
            'm.relates_to': expect.objectContaining({
              rel_type: 'm.annotation',
              event_id: '$event1',
              key: '👍'
            })
          })
        })
      )
    })
  })

  describe('editMessage', () => {
    it('should edit message successfully', async () => {
      const mockResponse = { event_id: '$edit1' }
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue(mockResponse)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.editMessage('!room1', '$event1', 'edited text')
      expect(result).toEqual(mockResponse)
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        expect.any(String),
        expect.objectContaining({
          type: 'm.room.message',
          content: expect.objectContaining({
            'm.new_content': { msgtype: 'm.text', body: 'edited text' },
            'm.relates_to': { rel_type: 'm.replace', event_id: '$event1' }
          })
        })
      )
    })
  })

  describe('getRoomMessage', () => {
    it('should return message event when found', async () => {
      const mockEvent = { getId: () => '$event1' }
      const mockRoom = {
        findEventById: vi.fn().mockReturnValue(mockEvent)
      }
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.getRoomMessage('!room1', '$event1')
      expect(result).toEqual(mockEvent)
    })

    it('should return null when room not found with throwOnError=false', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.getRoomMessage('!room1', '$event1', false)
      expect(result).toBeNull()
    })

    it('should return null when event not found', async () => {
      const mockRoom = {
        findEventById: vi.fn().mockReturnValue(null)
      }
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.getRoomMessage('!room1', '$event1')
      expect(result).toBeNull()
    })
  })

  describe('markMessagesRead', () => {
    it('should send read receipt', async () => {
      const mockClient = {
        sendReadReceipt: vi.fn().mockResolvedValue({})
      }
      mockGetClient.mockReturnValue(mockClient)

      await matrixMessageService.markMessagesRead('!room1', '$event1')
      expect(mockClient.sendReadReceipt).toHaveBeenCalledWith('!room1', '$event1')
    })
  })

  describe('markMsg', () => {
    it('should return true on success', async () => {
      const mockClient = {
        sendReadReceipt: vi.fn().mockResolvedValue({})
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.markMsg('!room1', '$event1')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      const mockClient = {
        sendReadReceipt: vi.fn().mockRejectedValue(new Error('Failed'))
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.markMsg('!room1', '$event1', false)
      expect(result).toBe(false)
    })
  })

  describe('markMsgs', () => {
    it('should mark multiple messages and return success count', async () => {
      const mockClient = {
        sendReadReceipt: vi.fn().mockResolvedValue({})
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.markMsgs('!room1', ['$e1', '$e2', '$e3'])
      expect(result).toBe(3)
    })

    it('should count partial successes', async () => {
      const mockClient = {
        sendReadReceipt: vi
          .fn()
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValueOnce({})
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.markMsgs('!room1', ['$e1', '$e2', '$e3'])
      expect(result).toBe(2)
    })
  })

  describe('getMsgList', () => {
    it('should return filtered message list', async () => {
      const mockEvents = [
        { getId: () => '$e1', getType: () => 'm.room.message', sender: { userId: '@u1' } },
        { getId: () => '$e2', getType: () => 'm.room.member', sender: { userId: '@u2' } },
        { getId: () => '$e3', getType: () => 'm.room.message', sender: { userId: '@u1' } }
      ]
      const mockRoom = { timeline: mockEvents }
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.getMsgList('!room1', 10, { type: 'm.room.message' })
      expect(result.length).toBe(2)
    })

    it('should return empty array when room not found', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.getMsgList('!nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('retry mechanism', () => {
    it('should retry on transient failure and succeed', async () => {
      const mockResponse = { event_id: '$retry1' }
      const mockClient = {
        sendTextMessage: vi.fn().mockRejectedValueOnce(new Error('ETIMEDOUT')).mockResolvedValueOnce(mockResponse)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixMessageService.sendTextMessage('!room1', 'Hello')
      expect(result).toEqual(mockResponse)
      expect(mockClient.sendTextMessage).toHaveBeenCalledTimes(2)
    })
  })
})
