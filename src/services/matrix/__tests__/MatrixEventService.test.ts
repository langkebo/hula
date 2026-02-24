import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matrixEventService } from '../MatrixEventService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null),
    isLoggedIn: vi.fn(() => false)
  }
}))

describe('MatrixEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('sendTextMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendTextMessage('!room:id', 'Hello World')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendImageMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendImageMessage('!room:id', 'mxc://matrix.org/image')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendFileMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendFileMessage('!room:id', 'mxc://matrix.org/file')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendVideoMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendVideoMessage('!room:id', 'mxc://matrix.org/video')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendAudioMessage', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendAudioMessage('!room:id', 'mxc://matrix.org/audio')
      ).rejects.toThrow('客户端未初始化')
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
      await expect(
        matrixEventService.sendLocationMessage('!room:id', 'geo:0,0', 'Location')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('redactEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.redactEvent('!room:id', '$event:id')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendMessageReceipt', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendMessageReceipt('!room:id', '$event:id')
      ).rejects.toThrow('客户端未初始化')
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
      await expect(
        matrixEventService.replyToEvent('!room:id', '$event:id', 'Reply text')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('editEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.editEvent('!room:id', '$event:id', 'Edited text')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('reactToEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.reactToEvent('!room:id', '$event:id', '👍')
      ).rejects.toThrow('客户端未初始化')
    })
  })

  describe('sendEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(
        matrixEventService.sendEvent('!room:id', 'm.room.message', { body: 'test' })
      ).rejects.toThrow('客户端未初始化')
    })
  })
})
