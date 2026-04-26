import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixMessageService } from '../MatrixMessageService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null)
  }
}))

vi.mock('../MatrixReceiptService', () => ({
  matrixReceiptService: {
    sendReadReceiptByEventId: vi.fn()
  }
}))

vi.mock('../../MatrixEventService', () => ({
  matrixEventService: {
    sendEvent: vi.fn()
  }
}))

vi.mock('../MatrixReactionService', () => ({
  matrixReactionService: {
    addReaction: vi.fn(),
    removeReaction: vi.fn()
  }
}))

vi.mock('../MatrixMessageRelationService', () => ({
  matrixMessageRelationService: {
    editMessage: vi.fn()
  }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { matrixReceiptService } from '../MatrixReceiptService'
import { matrixEventService } from '../../MatrixEventService'
import { matrixReactionService } from '../MatrixReactionService'
import { matrixMessageRelationService } from '../MatrixMessageRelationService'
import { matrixClientService } from '../../MatrixClientService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { MsgEnum } from '@/enums'

describe('MatrixMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
  })

  it('markMessagesRead 通过 MatrixReceiptService 发送已读回执', async () => {
    vi.mocked(matrixReceiptService.sendReadReceiptByEventId).mockResolvedValue('$event')

    await matrixMessageService.markMessagesRead('!room:id', '$event')

    expect(matrixReceiptService.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event')
  })

  it('markMsg 在转调成功时返回 true', async () => {
    vi.mocked(matrixReceiptService.sendReadReceiptByEventId).mockResolvedValue('$event')

    const result = await matrixMessageService.markMsg('!room:id', '$event')

    expect(matrixReceiptService.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event')
    expect(result).toBe(true)
  })

  it('markMsg 在转调失败时返回 false', async () => {
    vi.mocked(matrixReceiptService.sendReadReceiptByEventId).mockRejectedValue(new Error('send failed'))

    const result = await matrixMessageService.markMsg('!room:id', '$event')

    expect(result).toBe(false)
  })

  it('markMsgs 逐条转调并返回成功数量', async () => {
    vi.mocked(matrixReceiptService.sendReadReceiptByEventId)
      .mockResolvedValueOnce('$event-1')
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce('$event-3')

    const result = await matrixMessageService.markMsgs('!room:id', ['$event-1', '$event-2', '$event-3'])

    expect(matrixReceiptService.sendReadReceiptByEventId).toHaveBeenNthCalledWith(1, '!room:id', '$event-1')
    expect(matrixReceiptService.sendReadReceiptByEventId).toHaveBeenNthCalledWith(2, '!room:id', '$event-2')
    expect(matrixReceiptService.sendReadReceiptByEventId).toHaveBeenNthCalledWith(3, '!room:id', '$event-3')
    expect(result).toBe(2)
  })

  it('addReaction 通过 MatrixReactionService 发送反应', async () => {
    vi.mocked(matrixReactionService.addReaction).mockResolvedValue('$reaction')

    await matrixMessageService.addReaction('!room:id', '$event', '👍')

    expect(matrixReactionService.addReaction).toHaveBeenCalledWith('!room:id', '$event', '👍')
  })

  it('recallMessage 在离线时应将操作入队', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    vi.mocked(offlineQueueService.enqueue).mockReturnValue('q-1')

    await matrixMessageService.recallMessage('!room:id', '$event:id')

    expect(offlineQueueService.enqueue).toHaveBeenCalledWith('redact', '!room:id', {
      roomId: '!room:id',
      eventId: '$event:id'
    })

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('recallMessage 正常在线时调用 client.redactEvent', async () => {
    const mockClient = { redactEvent: vi.fn().mockResolvedValue({}) }
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

    await matrixMessageService.recallMessage('!room:id', '$event', 'txn-123')

    expect(mockClient.redactEvent).toHaveBeenCalledWith('!room:id', '$event', 'txn-123')
  })

  it('removeReaction 通过 MatrixReactionService 移除反应', async () => {
    vi.mocked(matrixReactionService.removeReaction).mockResolvedValue(undefined)

    await matrixMessageService.removeReaction('!room:id', '$event', '👍', '$reaction')

    expect(matrixReactionService.removeReaction).toHaveBeenCalledWith('!room:id', '$reaction')
  })

  it('editMessage 通过 MatrixMessageRelationService 编辑消息并兼容返回 event_id', async () => {
    vi.mocked(matrixMessageRelationService.editMessage).mockResolvedValue('$edited')

    const result = await matrixMessageService.editMessage('!room:id', '$event', 'new text')

    expect(matrixMessageRelationService.editMessage).toHaveBeenCalledWith('!room:id', '$event', {
      body: 'new text'
    })
    expect(result).toEqual({ event_id: '$edited' })
  })

  it('getMsgListByIds 会跨房间扫描并按传入顺序返回消息', async () => {
    const event1 = { getId: vi.fn(() => '$event-1') }
    const event2 = { getId: vi.fn(() => '$event-2') }
    const room1 = {
      findEventById: vi.fn((eventId: string) => (eventId === '$event-1' ? event1 : null))
    }
    const room2 = {
      findEventById: vi.fn((eventId: string) => (eventId === '$event-2' ? event2 : null))
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getRooms: vi.fn(() => [room1, room2])
    } as any)

    const result = await matrixMessageService.getMsgListByIds({
      msgIds: ['$event-2', '$event-1', '$missing']
    })

    expect(result).toEqual([event2, event1])
    expect(room1.findEventById).toHaveBeenCalledWith('$event-2')
    expect(room2.findEventById).toHaveBeenCalledWith('$event-2')
    expect(room1.findEventById).toHaveBeenCalledWith('$event-1')
  })

  it('sendStructuredMessage 通过 MatrixEventService 发送文本回复消息', async () => {
    vi.mocked(matrixEventService.sendEvent).mockResolvedValue('$event-text')

    const result = await matrixMessageService.sendStructuredMessage({
      roomId: '!room:id',
      msgType: MsgEnum.TEXT,
      body: {
        content: 'hello',
        reply: {
          id: '$reply'
        }
      }
    })

    expect(matrixEventService.sendEvent).toHaveBeenCalledWith('!room:id', 'm.room.message', {
      msgtype: 'm.text',
      body: 'hello',
      'm.relates_to': {
        'm.in_reply_to': {
          event_id: '$reply'
        }
      }
    })
    expect(result).toEqual({ event_id: '$event-text' })
  })

  it('sendStructuredMessage 使用标准 m.room.message 发送 notice 内容', async () => {
    vi.mocked(matrixEventService.sendEvent).mockResolvedValue('$event-notice')

    await matrixMessageService.sendStructuredMessage({
      roomId: '!room:id',
      msgType: MsgEnum.NOTICE,
      body: {
        content: 'system message'
      }
    })

    expect(matrixEventService.sendEvent).toHaveBeenCalledWith('!room:id', 'm.room.message', {
      msgtype: 'm.notice',
      body: 'system message'
    })
  })

  it('sendTextMessage 在离线时应将操作入队', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    vi.mocked(offlineQueueService.enqueue).mockReturnValue('q-2')

    const response = await matrixMessageService.sendTextMessage('!room:id', 'hello')

    expect(offlineQueueService.enqueue).toHaveBeenCalledWith('message', '!room:id', {
      roomId: '!room:id',
      eventType: 'm.room.message',
      content: {
        msgtype: 'm.text',
        body: 'hello'
      }
    })
    expect(response.event_id).toBe('local-q-2')

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('sendHtmlMessage 在离线时应将操作入队', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    vi.mocked(offlineQueueService.enqueue).mockReturnValue('q-3')

    const response = await matrixMessageService.sendHtmlMessage('!room:id', 'hello', '<b>hello</b>')

    expect(offlineQueueService.enqueue).toHaveBeenCalledWith('message', '!room:id', {
      roomId: '!room:id',
      eventType: 'm.room.message',
      content: {
        msgtype: 'm.text',
        body: 'hello',
        format: 'org.matrix.custom.html',
        formatted_body: '<b>hello</b>'
      }
    })
    expect(response.event_id).toBe('local-q-3')

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('sendEmoteMessage 在离线时应将操作入队', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    vi.mocked(offlineQueueService.enqueue).mockReturnValue('q-4')

    const response = await matrixMessageService.sendEmoteMessage('!room:id', 'dances')

    expect(offlineQueueService.enqueue).toHaveBeenCalledWith('message', '!room:id', {
      roomId: '!room:id',
      eventType: 'm.room.message',
      content: {
        msgtype: 'm.emote',
        body: 'dances'
      }
    })
    expect(response.event_id).toBe('local-q-4')

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })
})
