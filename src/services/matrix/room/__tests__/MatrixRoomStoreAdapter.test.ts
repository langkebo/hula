import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import matrixRoomStoreAdapter from '../MatrixRoomStoreAdapter'

function createEventLike(
  overrides: Partial<{
    id: string
    roomId: string
    type: string
    sender: string
    content: Record<string, unknown>
    ts: number
  }> = {}
) {
  return {
    getId: vi.fn(() => overrides.id ?? '$event'),
    getRoomId: vi.fn(() => overrides.roomId ?? '!room:id'),
    getType: vi.fn(() => overrides.type ?? 'm.room.message'),
    getSender: vi.fn(() => overrides.sender ?? '@user:server'),
    getContent: vi.fn(() => overrides.content ?? { body: 'hello', msgtype: 'm.text' }),
    getTs: vi.fn(() => overrides.ts ?? 1000)
  }
}

function createMessage(overrides: Partial<MessageType['message']>): MessageType {
  return {
    fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
    message: {
      id: '$message',
      roomId: '!room:id',
      type: MsgEnum.TEXT,
      body: {},
      sendTime: 1,
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS,
      ...overrides
    },
    sendTime: 1,
    loading: false
  }
}

describe('MatrixRoomStoreAdapter', () => {
  it('should build room preview for common event types', () => {
    expect(matrixRoomStoreAdapter.getTimelineEventPreview('m.room.message', { body: 'hi', msgtype: 'm.text' })).toBe(
      'hi'
    )
    expect(
      matrixRoomStoreAdapter.getTimelineEventPreview('m.room.message', { body: 'photo.jpg', msgtype: 'm.image' })
    ).toBe('[图片]')
    expect(
      matrixRoomStoreAdapter.getTimelineEventPreview('m.room.member', { membership: 'join' } as Record<string, unknown>)
    ).toBe('加入了房间')
  })

  it('should build message preview for display messages', () => {
    expect(
      matrixRoomStoreAdapter.getMessagePreview(
        createMessage({ id: '$text', body: { body: 'hello', content: 'hello' } })
      )
    ).toBe('hello')

    expect(
      matrixRoomStoreAdapter.getMessagePreview(createMessage({ id: '$image', type: MsgEnum.IMAGE, body: {} }))
    ).toBe('[图片]')
  })

  it('should convert room to room info and merge unread overrides', () => {
    const room = {
      roomId: '!room:id',
      name: 'Room',
      getLiveTimeline: vi.fn(() => ({
        getEvents: vi.fn(() => [createEventLike({ content: { body: 'last', msgtype: 'm.text' }, ts: 999 })])
      })),
      getMxcAvatarUrl: vi.fn(() => 'mxc://room/avatar'),
      getJoinedMembers: vi.fn(() => [
        {
          userId: '@user:server',
          name: 'User',
          powerLevel: 100,
          getMxcAvatarUrl: vi.fn(() => 'mxc://user/avatar')
        }
      ]),
      getUnreadNotificationCount: vi.fn((kind?: string) => {
        if (kind === 'highlight') return 1
        if (kind === 'notification') return 2
        return 2
      }),
      isSpaceRoom: vi.fn(() => false),
      getDMInviter: vi.fn(() => '@peer:server')
    }

    const roomInfo = matrixRoomStoreAdapter.convertRoomToRoomInfo(room as unknown as Room, true)
    const merged = matrixRoomStoreAdapter.applySlidingSyncUnreadCounts(roomInfo, {
      notificationCount: 8,
      highlightCount: 3
    })

    expect(merged).toMatchObject({
      roomId: '!room:id',
      name: 'Room',
      isDirect: true,
      isEncrypted: true,
      unreadCount: 8,
      highlightCount: 3,
      notificationCount: 8,
      lastMessage: 'last',
      lastMessageTime: 999
    })
    expect(merged.members).toEqual([
      {
        userId: '@user:server',
        name: 'User',
        avatarUrl: 'mxc://user/avatar',
        powerLevel: 100
      }
    ])
  })

  it('should convert sdk and timeline events to store messages', () => {
    const event = createEventLike({
      id: '$sdk',
      roomId: '!room:id',
      content: { body: 'voice.ogg', msgtype: 'm.voice' }
    })
    const sdkMessage = matrixRoomStoreAdapter.convertMatrixEventToMessage(event as unknown as MatrixEvent)
    const timelineMessage = matrixRoomStoreAdapter.convertTimelineEventToMessage('!room:id', {
      event_id: '$timeline',
      type: 'm.room.member',
      sender: '@user:server',
      content: { membership: 'leave' },
      origin_server_ts: 2000
    })

    expect(sdkMessage.message.type).toBe(MsgEnum.VOICE)
    expect(sdkMessage.message.body).toMatchObject({
      body: 'voice.ogg',
      content: 'voice.ogg',
      msgtype: 'm.voice'
    })
    expect(timelineMessage.message.type).toBe(MsgEnum.SYSTEM)
    expect(timelineMessage.message.body).toMatchObject({
      membership: 'leave',
      msgtype: 'm.text'
    })
  })

  it('should identify displayable sdk message events', () => {
    expect(
      matrixRoomStoreAdapter.isDisplayableMessageEvent(
        createEventLike({ type: 'm.room.message' }) as unknown as MatrixEvent
      )
    ).toBe(true)
    expect(
      matrixRoomStoreAdapter.isDisplayableMessageEvent(
        createEventLike({ type: 'm.room.encrypted' }) as unknown as MatrixEvent
      )
    ).toBe(true)
    expect(
      matrixRoomStoreAdapter.isDisplayableMessageEvent(
        createEventLike({ type: 'm.room.topic' }) as unknown as MatrixEvent
      )
    ).toBe(false)
  })

  it('should filter unsupported sdk events when converting message lists', () => {
    const messages = matrixRoomStoreAdapter.convertMatrixEventsToMessages([
      createEventLike({
        id: '$m1',
        type: 'm.room.message',
        content: { body: 'hello', msgtype: 'm.text' }
      }) as unknown as MatrixEvent,
      createEventLike({ id: '$ignore', type: 'm.room.topic', content: { topic: 'ignored' } }) as unknown as MatrixEvent,
      createEventLike({
        id: '$m2',
        type: 'm.room.encrypted',
        content: { body: 'cipher', msgtype: 'm.text' }
      }) as unknown as MatrixEvent
    ])

    expect(messages.map((item) => item.message.id)).toEqual(['$m1', '$m2'])
  })
})
