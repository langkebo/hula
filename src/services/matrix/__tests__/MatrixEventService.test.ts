import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixEventService } from '../MatrixEventService'
import { ApiError } from '../BaseManager'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockGetClient = vi.fn()
const mockGetTelemetry = vi.fn()

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: () => mockGetClient(),
    getTelemetry: () => mockGetTelemetry()
  }
}))

describe('MatrixEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendTextMessage', () => {
    it('should send plain text message', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$msg1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.sendTextMessage('!room1', 'Hello')
      expect(result).toBe('$msg1')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          msgtype: 'm.text',
          body: 'Hello'
        })
      )
    })

    it('should send HTML text message', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$msg2' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.sendTextMessage('!room1', 'Hello', '<b>Hello</b>')
      expect(result).toBe('$msg2')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          msgtype: 'm.text',
          body: 'Hello',
          format: 'org.matrix.custom.html',
          formatted_body: '<b>Hello</b>'
        })
      )
    })

    it('should return empty string on error when throwOnError=false', async () => {
      mockGetClient.mockReturnValue(null)

      const result = await matrixEventService.sendTextMessage('!room1', 'Hello', undefined, false)
      expect(result).toBe('')
    })
  })

  describe('sendImageMessage', () => {
    it('should send image with URL', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$img1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.sendImageMessage(
        '!room1',
        'mxc://test/image',
        { size: 1024, mimetype: 'image/png' },
        'photo.png'
      )
      expect(result).toBe('$img1')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          msgtype: 'm.image',
          url: 'mxc://test/image',
          body: 'photo.png'
        })
      )
    })
  })

  describe('sendFileMessage', () => {
    it('should send file with URL', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$file1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.sendFileMessage(
        '!room1',
        'mxc://test/file',
        { size: 2048, mimetype: 'application/pdf' },
        'doc.pdf'
      )
      expect(result).toBe('$file1')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          msgtype: 'm.file',
          url: 'mxc://test/file',
          body: 'doc.pdf'
        })
      )
    })
  })

  describe('redactEvent', () => {
    it('should redact event successfully', async () => {
      const mockClient = {
        redactEvent: vi.fn().mockResolvedValue({})
      }
      mockGetClient.mockReturnValue(mockClient)

      await matrixEventService.redactEvent('!room1', '$event1', 'spam')
      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room1', '$event1', undefined, { reason: 'spam' })
    })

    it('should redact without reason', async () => {
      const mockClient = {
        redactEvent: vi.fn().mockResolvedValue({})
      }
      mockGetClient.mockReturnValue(mockClient)

      await matrixEventService.redactEvent('!room1', '$event1')
      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room1', '$event1', undefined, undefined)
    })
  })

  describe('replyToEvent', () => {
    it('should reply to event', async () => {
      const mockEvent = { getId: () => '$original' }
      const mockRoom = {
        findEventById: vi.fn().mockReturnValue(mockEvent)
      }
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom),
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$reply1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.replyToEvent('!room1', '$original', 'Reply text')
      expect(result).toBe('$reply1')
    })

    it('should throw NotFoundError when room not found', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      mockGetClient.mockReturnValue(mockClient)

      await expect(matrixEventService.replyToEvent('!room1', '$event1', 'Reply', true)).rejects.toThrow()
    })
  })

  describe('editEvent', () => {
    it('should edit event with new content', async () => {
      const mockEvent = {
        getId: () => '$original',
        getContent: vi.fn().mockReturnValue({ msgtype: 'm.text', body: 'original' })
      }
      const mockRoom = {
        findEventById: vi.fn().mockReturnValue(mockEvent)
      }
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom),
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$edit1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.editEvent('!room1', '$original', 'edited text')
      expect(result).toBe('$edit1')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          'm.new_content': { msgtype: 'm.text', body: 'edited text' },
          'm.relates_to': { rel_type: 'm.replace', event_id: '$original' }
        })
      )
    })
  })

  describe('reactToEvent', () => {
    it('should add reaction to event', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$react1' })
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.reactToEvent('!room1', '$event1', '👍')
      expect(result).toBe('$react1')
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.reaction',
        expect.objectContaining({
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: '$event1',
            key: '👍'
          }
        })
      )
    })
  })

  describe('getRoomTimeline', () => {
    it('should return timeline events', async () => {
      const mockEvents = [{ getId: () => '$e1' }, { getId: () => '$e2' }]
      const mockTimeline = {
        getEvents: vi.fn().mockReturnValue(mockEvents)
      }
      const mockTimelineSet = {
        getLiveTimeline: vi.fn().mockReturnValue(mockTimeline)
      }
      const mockRoom = {
        getUnfilteredTimelineSet: vi.fn().mockReturnValue(mockTimelineSet)
      }
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.getRoomTimeline('!room1', 50)
      expect(result).toEqual(mockEvents)
    })

    it('should throw NotFoundError when room not found and throwOnError=true', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      mockGetClient.mockReturnValue(mockClient)

      await expect(matrixEventService.getRoomTimeline('!nonexistent', 50, true)).rejects.toThrow()
    })

    it('should return empty array when room not found and throwOnError=false', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = await matrixEventService.getRoomTimeline('!nonexistent', 50, false)
      expect(result).toEqual([])
    })
  })

  describe('sendMessage', () => {
    it('should send message with burn after read', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$burn1' })
      }
      mockGetClient.mockReturnValue(mockClient)
      mockGetTelemetry.mockReturnValue(null)

      const _result = await matrixEventService.sendMessage({
        roomId: '!room1',
        content: { msgtype: 'm.text', body: 'secret' },
        burnAfterRead: true,
        burnDuration: 30
      })

      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          'org.matrix.msc_burn_after_read': { enabled: true, duration: 30 }
        })
      )
    })

    it('should send message with sticky flag', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$sticky1' })
      }
      mockGetClient.mockReturnValue(mockClient)
      mockGetTelemetry.mockReturnValue(null)

      await matrixEventService.sendMessage({
        roomId: '!room1',
        content: { msgtype: 'm.text', body: 'pinned' },
        isSticky: true
      })

      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        '!room1',
        'm.room.message',
        expect.objectContaining({
          'org.matrix.msc4354.sticky': true
        })
      )
    })
  })

  describe('throwOnError pattern', () => {
    it('should throw ApiError when client not initialized and throwOnError=true', async () => {
      mockGetClient.mockReturnValue(null)

      await expect(matrixEventService.sendTextMessage('!room1', 'test', undefined, true)).rejects.toThrow(ApiError)
    })

    it('should return default value when client not initialized and throwOnError=false', async () => {
      mockGetClient.mockReturnValue(null)

      const result = await matrixEventService.sendTextMessage('!room1', 'test', undefined, false)
      expect(result).toBe('')
    })
  })
})
