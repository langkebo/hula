import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixEvent } from 'matrix-js-sdk'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

const mockSendEvent = vi.fn()
const mockGetRoomMessage = vi.fn()

vi.mock('../../MatrixEventService', () => ({
  matrixEventService: {
    sendEvent: mockSendEvent
  }
}))

vi.mock('../MatrixMessageService', () => ({
  matrixMessageService: {
    getRoomMessage: mockGetRoomMessage
  }
}))

const { matrixForwardService } = await import('../MatrixForwardService')

describe('MatrixForwardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should forward event with reference relation payload', async () => {
    const mockEvent = {
      getType: () => 'm.room.message',
      getId: () => '$source-event',
      getContent: () => ({
        body: 'hello',
        msgtype: 'm.text'
      })
    } as unknown as MatrixEvent

    mockSendEvent.mockResolvedValueOnce('$forwarded')

    const result = await matrixForwardService.forwardEvent(mockEvent, '!target:example.com')

    expect(result).toBe('$forwarded')
    expect(mockSendEvent).toHaveBeenCalledWith('!target:example.com', 'm.room.message', {
      body: 'hello',
      msgtype: 'm.text',
      'm.relates_to': {
        rel_type: 'm.reference',
        event_id: '$source-event'
      }
    })
  })

  it('should collect per-room success and failure results', async () => {
    const mockEvent = {
      getType: () => 'm.room.message',
      getId: () => '$source-event',
      getContent: () => ({
        body: 'hello'
      })
    } as unknown as MatrixEvent

    mockSendEvent.mockResolvedValueOnce('$event-a')
    mockSendEvent.mockRejectedValueOnce(new Error('send failed'))

    const result = await matrixForwardService.forwardEventToMultipleRooms(mockEvent, [
      '!a:example.com',
      '!b:example.com'
    ])

    expect(result).toEqual([
      {
        roomId: '!a:example.com',
        success: true,
        eventId: '$event-a'
      },
      {
        roomId: '!b:example.com',
        success: false,
        error: 'send failed'
      }
    ])
  })

  it('should forward room messages by event ids to multiple rooms', async () => {
    const firstEvent = {
      getType: () => 'm.room.message',
      getId: () => '$source-1',
      getContent: () => ({
        body: 'hello',
        msgtype: 'm.text'
      })
    } as unknown as MatrixEvent

    const secondEvent = {
      getType: () => 'm.room.message',
      getId: () => '$source-2',
      getContent: () => ({
        body: 'image.png',
        msgtype: 'm.image'
      })
    } as unknown as MatrixEvent

    mockGetRoomMessage.mockResolvedValueOnce(firstEvent)
    mockGetRoomMessage.mockResolvedValueOnce(secondEvent)
    mockSendEvent
      .mockResolvedValueOnce('$a-1')
      .mockResolvedValueOnce('$b-1')
      .mockResolvedValueOnce('$a-2')
      .mockResolvedValueOnce('$b-2')

    const result = await matrixForwardService.forwardRoomMessages(
      '!source:example.com',
      ['$source-1', '$source-2'],
      ['!a:example.com', '!b:example.com']
    )

    expect(mockGetRoomMessage).toHaveBeenNthCalledWith(1, '!source:example.com', '$source-1')
    expect(mockGetRoomMessage).toHaveBeenNthCalledWith(2, '!source:example.com', '$source-2')
    expect(result).toEqual([
      { roomId: '!a:example.com', success: true, eventId: '$a-1' },
      { roomId: '!b:example.com', success: true, eventId: '$b-1' },
      { roomId: '!a:example.com', success: true, eventId: '$a-2' },
      { roomId: '!b:example.com', success: true, eventId: '$b-2' }
    ])
  })

  it('should report missing source event without sending forwarded messages', async () => {
    mockGetRoomMessage.mockResolvedValueOnce(null)

    const result = await matrixForwardService.forwardRoomMessages(
      '!source:example.com',
      ['$missing'],
      ['!a:example.com', '!b:example.com']
    )

    expect(mockSendEvent).not.toHaveBeenCalled()
    expect(result).toEqual([
      { roomId: '!a:example.com', success: false, error: '源消息不存在: $missing' },
      { roomId: '!b:example.com', success: false, error: '源消息不存在: $missing' }
    ])
  })
})
