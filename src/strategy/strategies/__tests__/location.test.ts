import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { AppException } from '@/common/exception'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { LocationMessageStrategyImpl } from '../location'

const getUserInfoMock = vi.fn()

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: getUserInfoMock
  })
}))

describe('LocationMessageStrategyImpl', () => {
  const strategy = new LocationMessageStrategyImpl()

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  const validLocationJson = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      latitude: 39.9042,
      longitude: 116.4074,
      address: 'Beijing',
      ...overrides
    })

  beforeEach(() => {
    vi.clearAllMocks()
    getUserInfoMock.mockReturnValue({ name: 'Alice', avatar: 'a.png' })
  })

  it('uses MsgEnum.LOCATION as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.LOCATION)
  })

  it('getMsg parses valid location data with defaults', () => {
    const msg = strategy.getMsg(validLocationJson(), null) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.LOCATION)
    expect(msg.latitude).toBe(39.9042)
    expect(msg.longitude).toBe(116.4074)
    expect(msg.address).toBe('Beijing')
    expect(msg.precision).toBe('高精度')
    expect(msg.timestamp).toBeTypeOf('number')
    expect(msg.reply).toBeUndefined()
  })

  it('getMsg preserves provided precision and timestamp', () => {
    const msg = strategy.getMsg(validLocationJson({ precision: '低精度', timestamp: 1234567890 }), null) as Record<
      string,
      unknown
    >
    expect(msg.precision).toBe('低精度')
    expect(msg.timestamp).toBe(1234567890)
  })

  it('getMsg attaches reply ref when replyValue has content', () => {
    const reply = makeReply('evt-1', 'parent', 'alice')
    const msg = strategy.getMsg(validLocationJson(), reply) as Record<string, unknown>
    expect(msg.reply).toEqual({ content: 'parent', key: 'evt-1' })
  })

  it('getMsg throws AppException on invalid JSON', () => {
    expect(() => strategy.getMsg('bad-json', null)).toThrow(AppException)
    expect(() => strategy.getMsg('bad-json', null)).toThrow('位置数据格式错误，必须是有效的JSON')
  })

  it('getMsg throws AppException when latitude is missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ longitude: 1, address: 'X' }), null)).toThrow(
      '无效的位置数据，缺少必要字段'
    )
  })

  it('getMsg throws AppException when longitude is missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ latitude: 1, address: 'X' }), null)).toThrow(
      '无效的位置数据，缺少必要字段'
    )
  })

  it('getMsg throws AppException when address is missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ latitude: 1, longitude: 2 }), null)).toThrow(
      '无效的位置数据，缺少必要字段'
    )
  })

  it('buildMessageBody returns Matrix location structure with high precision', () => {
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.LOCATION,
        latitude: 39.9,
        longitude: 116.4,
        address: 'Beijing',
        precision: '高精度',
        timestamp: 1000,
        reply: { content: 'r', key: 'rk' }
      },
      null
    )
    expect(body.geo_uri).toBe('geo:39.9,116.4;u=10')
    expect(body.msgtype).toBe('m.location')
    expect(body.body).toBe('位置: Beijing')
    expect(body.info).toEqual({ address: 'Beijing', timestamp: 1000 })
    expect(body.replyMsgId).toBe('rk')
    expect(body.reply).toBeUndefined()
  })

  it('buildMessageBody uses u=100 for non-high precision', () => {
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.LOCATION,
        latitude: 0,
        longitude: 0,
        address: 'X',
        precision: '低精度',
        timestamp: 0
      },
      null
    )
    expect(body.geo_uri).toBe('geo:0,0;u=100')
  })

  it('buildMessageBody propagates full reply object', () => {
    const reply = makeReply('evt-3', 'parent', 'carol')
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.LOCATION,
        latitude: 1,
        longitude: 2,
        address: 'A',
        precision: '高精度',
        timestamp: 0
      },
      reply
    )
    expect(body.reply).toEqual({
      body: 'parent',
      id: 'evt-3',
      username: 'carol',
      type: MsgEnum.LOCATION
    })
  })

  it('buildMessageType constructs MessageType with userInfo from groupStore', () => {
    const body = { geo_uri: 'geo:0,0;u=10' }
    const result = strategy.buildMessageType(
      'msg-id-1',
      body,
      { currentSessionRoomId: 'room-1' },
      ref('@alice:matrix.test')
    )

    expect(result.clientKey).toBe('msg-id-1')
    expect(result.fromUser.uid).toBe('@alice:matrix.test')
    expect(result.fromUser.username).toBe('Alice')
    expect(result.fromUser.avatar).toBe('a.png')
    expect(result.message.id).toBe('msg-id-1')
    expect(result.message.roomId).toBe('room-1')
    expect(result.message.status).toBe(MessageStatusEnum.PENDING)
    expect(result.message.type).toBe(MsgEnum.LOCATION)
    expect(result.message.body).toBe(body)
    expect(result.loading).toBe(false)
  })

  it('buildMessageType falls back to empty user info when getUserInfo returns null', () => {
    getUserInfoMock.mockReturnValue(null)
    const result = strategy.buildMessageType(
      'msg-id-2',
      {},
      { currentSessionRoomId: 'room-2' },
      ref('@bob:matrix.test')
    )
    expect(result.fromUser.username).toBe('')
    expect(result.fromUser.avatar).toBe('')
  })

  it('buildMessageType handles empty userUid', () => {
    const result = strategy.buildMessageType('msg-id-3', {}, { currentSessionRoomId: 'room-3' }, ref(''))
    expect(result.fromUser.uid).toBe('')
  })
})
