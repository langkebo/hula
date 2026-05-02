import type { MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReceiptType } from '@/types/matrix-js-sdk'
import { matrixEventService } from '../MatrixEventService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null as MatrixClient | null),
    isLoggedIn: vi.fn(() => false)
  }
}))

vi.mock('../messaging/MatrixReceiptService', () => ({
  matrixReceiptService: {
    sendReadReceiptByEventId: vi.fn()
  }
}))

vi.mock('../messaging/MatrixReactionService', () => ({
  matrixReactionService: {
    addReaction: vi.fn()
  }
}))

vi.mock('../messaging/MatrixMessageRelationService', () => ({
  matrixMessageRelationService: {
    replyToMessage: vi.fn(),
    editMessage: vi.fn()
  }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import matrixClientService from '../MatrixClientService'
import { matrixMessageRelationService } from '../messaging/MatrixMessageRelationService'
import { matrixReactionService } from '../messaging/MatrixReactionService'
import { matrixReceiptService } from '../messaging/MatrixReceiptService'

describe('MatrixEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('sendTextMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.sendTextMessage('!room:id', 'Hello World')).rejects.toThrow('客户端未初始化')
    })

    it('should send text message with formatted body when html is provided', async () => {
      const mockClient = {
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$text' })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const result = await matrixEventService.sendTextMessage('!room:id', 'Hello World', '<b>Hello World</b>')

      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room:id', 'm.room.message', {
        msgtype: 'm.text',
        body: 'Hello World',
        format: 'org.matrix.custom.html',
        formatted_body: '<b>Hello World</b>'
      })
      expect(result).toBe('$text')
    })
  })

  describe('sendImageMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.sendImageMessage('!room:id', 'mxc://matrix.org/image')).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should upload local file before sending image message', async () => {
      const file = new File(['image'], 'demo.png', { type: 'image/png' })
      const mockClient = {
        uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://matrix.org/uploaded-image' }),
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$image' })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const result = await matrixEventService.sendImageMessage('!room:id', file, undefined, 'custom.png')

      expect(mockClient.uploadContent).toHaveBeenCalledWith(file, { type: 'image/png' })
      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room:id', 'm.room.message', {
        msgtype: 'm.image',
        body: 'custom.png',
        info: {
          size: file.size,
          mimetype: 'image/png'
        },
        url: 'mxc://matrix.org/uploaded-image'
      })
      expect(result).toBe('$image')
    })
  })

  describe('sendFileMessage', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixEventService.sendFileMessage('!room:id', new File([], 'f.txt'))).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should upload local file before sending file message', async () => {
      const file = new File(['content'], 'demo.txt', { type: 'text/plain' })
      const mockClient = {
        uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://matrix.org/uploaded-file' }),
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$file' })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const result = await matrixEventService.sendFileMessage('!room:id', file)

      expect(mockClient.uploadContent).toHaveBeenCalledWith(file, { type: 'text/plain' })
      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room:id', 'm.room.message', {
        msgtype: 'm.file',
        body: 'demo.txt',
        info: {
          size: file.size,
          mimetype: 'text/plain'
        },
        url: 'mxc://matrix.org/uploaded-file'
      })
      expect(result).toBe('$file')
    })
  })

  describe('sendVideoMessage', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixEventService.sendVideoMessage('!room:id', new File([], 'v.mp4'))).rejects.toThrow(
        '客户端未初始化'
      )
    })
  })

  describe('sendAudioMessage', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixEventService.sendAudioMessage('!room:id', new File([], 'a.mp3'))).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should upload local file before sending audio message', async () => {
      const file = new File(['audio'], 'demo.ogg', { type: 'audio/ogg' })
      const mockClient = {
        uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://matrix.org/uploaded-audio' }),
        sendEvent: vi.fn().mockResolvedValue({ event_id: '$audio' })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const result = await matrixEventService.sendAudioMessage('!room:id', file)

      expect(mockClient.uploadContent).toHaveBeenCalledWith(file, { type: 'audio/ogg' })
      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room:id', 'm.room.message', {
        msgtype: 'm.audio',
        body: 'demo.ogg',
        info: {
          size: file.size,
          mimetype: 'audio/ogg'
        },
        url: 'mxc://matrix.org/uploaded-audio'
      })
      expect(result).toBe('$audio')
    })
  })

  describe('sendVoiceMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendVoiceMessage('!room:id', 'mxc://matrix.org/voice', {
          size: 1024,
          duration: 5000
        })
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendLocationMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.sendLocationMessage('!room:id', 'geo:0,0', 'Location')).rejects.toThrow(
        '客户端未初始化'
      )
    })
  })

  describe('redactEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.redactEvent('!room:id', '$event:id')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendMessageReceipt', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.sendMessageReceipt('!room:id', '$event:id')).rejects.toThrow('客户端未初始化')
    })

    it('should delegate read receipts to MatrixReceiptService', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)
      vi.mocked(matrixReceiptService.sendReadReceiptByEventId).mockResolvedValue('$event:id')

      await matrixEventService.sendMessageReceipt('!room:id', '$event:id')

      expect(matrixReceiptService.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event:id')
    })

    it('should keep fallback path for non-read receipt types', async () => {
      const mockEvent = { getId: vi.fn(() => '$event:id') }
      const mockRoom = {
        findEventById: vi.fn(() => mockEvent)
      }
      const mockClient = {
        getRoom: vi.fn(() => mockRoom),
        sendReadReceipt: vi.fn().mockResolvedValue(undefined)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      await matrixEventService.sendMessageReceipt('!room:id', '$event:id', ReceiptType.ReadPrivate)

      expect(mockClient.sendReadReceipt).toHaveBeenCalledWith(mockEvent, ReceiptType.ReadPrivate)
    })
  })

  describe('getRoomTimeline', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.getRoomTimeline('!room:id')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('paginateTimeline', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.paginateTimeline('!room:id')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('replyToEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.replyToEvent('!room:id', '$event:id', 'Reply text')).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should delegate replies to MatrixMessageRelationService', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)
      vi.mocked(matrixMessageRelationService.replyToMessage).mockResolvedValue('$reply')

      const result = await matrixEventService.replyToEvent('!room:id', '$event:id', 'Reply text')

      expect(matrixMessageRelationService.replyToMessage).toHaveBeenCalledWith('!room:id', '$event:id', {
        body: 'Reply text'
      })
      expect(result).toBe('$reply')
    })
  })

  describe('editEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.editEvent('!room:id', '$event:id', 'Edited text')).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should delegate edits to MatrixMessageRelationService', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)
      vi.mocked(matrixMessageRelationService.editMessage).mockResolvedValue('$edited')

      const result = await matrixEventService.editEvent('!room:id', '$event:id', 'Edited text')

      expect(matrixMessageRelationService.editMessage).toHaveBeenCalledWith('!room:id', '$event:id', {
        body: 'Edited text'
      })
      expect(result).toBe('$edited')
    })
  })

  describe('reactToEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.reactToEvent('!room:id', '$event:id', '👍')).rejects.toThrow('客户端未初始化')
    })

    it('should delegate reactions to MatrixReactionService', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)
      vi.mocked(matrixReactionService.addReaction).mockResolvedValue('$reaction')

      const result = await matrixEventService.reactToEvent('!room:id', '$event:id', '👍')

      expect(matrixReactionService.addReaction).toHaveBeenCalledWith('!room:id', '$event:id', '👍')
      expect(result).toBe('$reaction')
    })
  })

  describe('sendEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.sendEvent('!room:id', 'm.room.message', { body: 'test' })).rejects.toThrow(
        '客户端未初始化'
      )
    })

    it('should enqueue event when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      vi.mocked(offlineQueueService.enqueue).mockReturnValue('q-5')

      const result = await matrixEventService.sendEvent('!room:id', 'm.room.message', { body: 'hello' })

      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('message', '!room:id', {
        roomId: '!room:id',
        eventType: 'm.room.message',
        content: { body: 'hello' }
      })
      expect(result).toBe('local-q-5')

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    })
  })
})
