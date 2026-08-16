import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import { matrixEventService } from '../MatrixEventService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import matrixClientService from '../MatrixClientService'

describe('MatrixEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
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

  describe('redactEvent', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixEventService.redactEvent('!room:id', '$event:id')).rejects.toThrow('客户端未初始化')
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

  describe('convertEventToMessage', () => {
    const makeEvent = (type: string, content: Record<string, unknown>): MatrixEvent =>
      ({
        getId: () => '$evt',
        getSender: () => '@alice:e',
        getType: () => type,
        getContent: () => content,
        getTs: () => 1700000000000
      }) as unknown as MatrixEvent

    const makeRoom = (): Room =>
      ({
        roomId: '!room:e',
        getMember: () => ({ name: 'Alice', getMxcAvatarUrl: () => 'mxc://a' })
      }) as unknown as Room

    it('maps m.location into a LocationBody', () => {
      const msg = matrixEventService.convertEventToMessage(
        makeEvent('m.room.message', {
          msgtype: 'm.location',
          body: '位置',
          geo_uri: 'geo:39.9042,116.4074',
          'm.location': { uri: 'geo:39.9042,116.4074', description: '北京' },
          'm.ts': 1700000000000
        }),
        makeRoom()
      )

      expect(msg?.message.type).toBe(MsgEnum.LOCATION)
      expect(msg?.message.body).toEqual({
        latitude: '39.9042',
        longitude: '116.4074',
        address: '北京',
        precision: '',
        timestamp: '1700000000000'
      })
    })

    it('maps m.beacon_info into a BeaconBody', () => {
      const msg = matrixEventService.convertEventToMessage(
        makeEvent('m.beacon_info', {
          description: '实时',
          timeout: 3600000,
          live: true,
          'm.ts': 1700000000000
        }),
        makeRoom()
      )

      expect(msg?.message.type).toBe(MsgEnum.BEACON)
      expect(msg?.message.body).toMatchObject({
        description: '实时',
        timeout: 3600000,
        isLive: true,
        lastUpdateTs: 1700000000000
      })
    })

    it('maps m.beacon into a BeaconBody with uri', () => {
      const msg = matrixEventService.convertEventToMessage(
        makeEvent('m.beacon', {
          'm.location': { uri: 'geo:39.9,116.4' },
          'm.ts': 1700000001000
        }),
        makeRoom()
      )

      expect(msg?.message.type).toBe(MsgEnum.BEACON)
      expect(msg?.message.body).toMatchObject({
        uri: 'geo:39.9,116.4',
        lastUpdateTs: 1700000001000
      })
    })

    it('maps unstable beacon event names into a BeaconBody', () => {
      const msg = matrixEventService.convertEventToMessage(
        makeEvent('org.matrix.msc3672.beacon_info', { timeout: 1000 }),
        makeRoom()
      )

      expect(msg?.message.type).toBe(MsgEnum.BEACON)
      expect(msg?.message.body).toMatchObject({ timeout: 1000 })
    })

    it('keeps raw content passthrough for non-location/beacon types', () => {
      const content = { msgtype: 'm.text', body: 'hello' }
      const msg = matrixEventService.convertEventToMessage(makeEvent('m.room.message', content), makeRoom())

      expect(msg?.message.type).toBe(MsgEnum.TEXT)
      expect(msg?.message.body).toEqual(content)
    })
  })
})
