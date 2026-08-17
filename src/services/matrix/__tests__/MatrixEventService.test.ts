import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import { matrixEventService } from '../MatrixEventService'
import { matrixRoomQueryService } from '../room/QueryService'

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
    vi.spyOn(matrixRoomQueryService, 'getRoom').mockResolvedValue(null)
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

    it('no longer maps m.beacon position updates into a BEACON bubble (Blocker 3)', () => {
      const content = {
        'm.location': { uri: 'geo:39.9,116.4' },
        'm.ts': 1700000001000
      }
      const msg = matrixEventService.convertEventToMessage(makeEvent('m.beacon', content), makeRoom())

      expect(msg?.message.type).toBe(MsgEnum.TEXT)
      expect(msg?.message.body).toEqual(content)
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

  describe('getPagedRoomMessages', () => {
    const makeMessageEvent = (id: string): MatrixEvent =>
      ({
        getId: () => id,
        getSender: () => '@alice:e',
        getType: () => 'm.room.message',
        getContent: () => ({ msgtype: 'm.text', body: `body-${id}` }),
        getTs: () => 1700000000000
      }) as unknown as MatrixEvent

    const makeRoom = (
      events: MatrixEvent[],
      opts: { getEvents?: ReturnType<typeof vi.fn>; getPaginationToken?: ReturnType<typeof vi.fn> } = {}
    ): Room =>
      ({
        roomId: '!room:e',
        getLiveTimeline: () => ({
          getEvents: opts.getEvents ?? (() => events),
          getPaginationToken: opts.getPaginationToken ?? (() => null)
        }),
        getMember: () => ({ name: 'Alice', getMxcAvatarUrl: () => 'mxc://a' })
      }) as unknown as Room

    it('初始加载返回整个 live 窗口；loadMore 用 /messages 反向分页取更早历史直到 isLast', async () => {
      let events = Array.from({ length: 50 }, (_, i) => makeMessageEvent(`event-${i + 1}`))
      const getEvents = vi.fn(() => events)
      const room = makeRoom([], { getEvents })
      vi.mocked(matrixRoomQueryService.getRoom).mockResolvedValue(room)

      // loadMore 用 /messages 反向分页，前置 20 条更早事件（初始加载时不会被调用）
      const paginate = vi.fn(
        async (_timeline: unknown, _opts: { backwards: boolean; limit: number }) => {
          const older = Array.from({ length: 20 }, (_, i) => makeMessageEvent(`older-${i + 1}`))
          events = [...older, ...events]
          return true // hasMore
        }
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue({ paginateEventTimeline: paginate } as unknown as MatrixClient)

      // 初始：live 窗口 50 >= pageSize 20，不触发 scrollback，返回全部；cursor=最旧
      const first = await matrixEventService.getPagedRoomMessages('!room:e', 20, '')
      expect(first.messages.length).toBe(50)
      expect(first.messages[0].message.id).toBe('event-1')
      expect(first.isLast).toBe(false)

      // loadMore：/messages 反向分页，仅返回新增的更早事件
      const second = await matrixEventService.getPagedRoomMessages('!room:e', 20, first.cursor)
      expect(paginate).toHaveBeenCalledTimes(1)
      expect(paginate.mock.calls[0][1]).toEqual({ backwards: true, limit: 20 })
      expect(second.messages.length).toBe(20)
      expect(second.messages[0].message.id).toBe('older-1')
      expect(second.isLast).toBe(false)

      // 无更多历史：paginate 返回 false 且无新增 => isLast=true
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        paginateEventTimeline: vi.fn(async () => false)
      } as unknown as MatrixClient)
      const last = await matrixEventService.getPagedRoomMessages('!room:e', 20, second.cursor)
      expect(last.messages.length).toBe(0)
      expect(last.isLast).toBe(true)
    })

    it('初始 live 窗口不足一页时，scrollback 从服务端补齐最近历史', async () => {
      let events = Array.from({ length: 15 }, (_, i) => makeMessageEvent(`local-${i + 1}`))
      const getEvents = vi.fn(() => events)
      const room = makeRoom([], { getEvents })
      vi.mocked(matrixRoomQueryService.getRoom).mockResolvedValue(room)

      const scrollback = vi.fn(async () => {
        const server = Array.from({ length: 15 }, (_, i) => makeMessageEvent(`server-${i + 1}`))
        events = [...server, ...events] // 服务端更早，前置到时间线
        return room
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({ scrollback } as unknown as MatrixClient)

      const first = await matrixEventService.getPagedRoomMessages('!room:e', 20, '')
      expect(scrollback).toHaveBeenCalledTimes(1)
      expect(first.messages.length).toBe(30)
      expect(first.messages[0].message.id).toBe('server-1')
      expect(first.isLast).toBe(false)
    })
  })
})
