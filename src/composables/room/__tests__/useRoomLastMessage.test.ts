import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRoomMock } = vi.hoisted(() => ({ getRoomMock: vi.fn() }))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getRoom: getRoomMock
  }
}))

import { useRoomLastMessage } from '../useRoomLastMessage'

const buildRoom = (events: Array<Record<string, unknown>>) => ({
  getLiveTimeline: () => ({ getEvents: () => events })
})

describe('useRoomLastMessage', () => {
  beforeEach(() => {
    getRoomMock.mockReset()
  })

  it('无 roomId 时清空结果且不访问 SDK', () => {
    const state = useRoomLastMessage({ roomId: () => null, members: () => [] })

    state.resolveLastMessage()

    expect(getRoomMock).not.toHaveBeenCalled()
    expect(state.lastMessage.value).toBeNull()
    expect(state.lastMessageSender.value).toBeNull()
    expect(state.lastMessageTime.value).toBeNull()
  })

  it('取最后一条消息并映射发送者显示名', () => {
    getRoomMock.mockReturnValue(
      buildRoom([
        {
          getType: () => 'm.room.message',
          getContent: () => ({ body: 'first' }),
          getSender: () => '@a:hs',
          getTs: () => 1
        },
        { getType: () => 'm.room.member' },
        {
          getType: () => 'm.room.message',
          getContent: () => ({ body: 'last' }),
          getSender: () => '@b:hs',
          getTs: () => 9
        }
      ])
    )
    const state = useRoomLastMessage({
      roomId: () => '!room:hs',
      members: () => [{ userId: '@b:hs', displayName: 'Bob' }] as never
    })

    state.resolveLastMessage()

    expect(state.lastMessage.value).toBe('last')
    expect(state.lastMessageSender.value).toBe('Bob')
    expect(state.lastMessageTime.value).toBe(9)
  })

  it('房间存在但无消息事件时清空结果', () => {
    getRoomMock.mockReturnValue(buildRoom([{ getType: () => 'm.room.member' }]))
    const state = useRoomLastMessage({ roomId: () => '!room:hs', members: () => [] })
    state.lastMessage.value = 'stale'

    state.resolveLastMessage()

    expect(state.lastMessage.value).toBeNull()
  })

  it('房间读取异常时清空结果而不抛出', () => {
    getRoomMock.mockImplementation(() => {
      throw new Error('boom')
    })
    const state = useRoomLastMessage({ roomId: () => '!room:hs', members: () => [] })
    state.lastMessage.value = 'stale'

    expect(() => state.resolveLastMessage()).not.toThrow()
    expect(state.lastMessage.value).toBeNull()
  })

  it('resetLastMessage 清空全部字段', () => {
    const state = useRoomLastMessage({ roomId: () => '!room:hs', members: () => [] })
    state.lastMessage.value = 'x'
    state.lastMessageSender.value = 'y'
    state.lastMessageTime.value = 1

    state.resetLastMessage()

    expect(state.lastMessage.value).toBeNull()
    expect(state.lastMessageSender.value).toBeNull()
    expect(state.lastMessageTime.value).toBeNull()
  })
})
