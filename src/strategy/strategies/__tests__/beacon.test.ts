import { describe, expect, it } from 'vitest'
import { AppException } from '@/common/exception'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { BeaconMessageStrategyImpl } from '../beacon'

describe('BeaconMessageStrategyImpl', () => {
  const strategy = new BeaconMessageStrategyImpl()

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  const validBeaconJson = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      description: 'Office',
      timeout: 3600000,
      isLive: true,
      ...overrides
    })

  it('uses MsgEnum.BEACON as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.BEACON)
  })

  it('getMsg parses valid beacon data', () => {
    const msg = strategy.getMsg(validBeaconJson(), null) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.BEACON)
    expect(msg.description).toBe('Office')
    expect(msg.timeout).toBe(3600000)
    expect(msg.isLive).toBe(true)
    expect(msg.reply).toBeUndefined()
  })

  it('getMsg attaches reply ref when replyValue has content', () => {
    const reply = makeReply('evt-1', 'parent', 'alice')
    const msg = strategy.getMsg(validBeaconJson(), reply) as Record<string, unknown>
    expect(msg.reply).toEqual({ content: 'parent', key: 'evt-1' })
  })

  it('getMsg throws AppException on invalid JSON', () => {
    expect(() => strategy.getMsg('not-json', null)).toThrow(AppException)
    expect(() => strategy.getMsg('not-json', null)).toThrow('信标数据格式错误，必须是有效的JSON')
  })

  it('getMsg throws AppException when description is missing', () => {
    expect(() => strategy.getMsg(validBeaconJson({ description: '' }), null)).toThrow('无效的信标数据，缺少必要字段')
  })

  it('getMsg throws AppException when timeout is missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ description: 'X', isLive: true }), null)).toThrow(
      '无效的信标数据，缺少必要字段'
    )
  })

  it('getMsg throws AppException when isLive is missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ description: 'X', timeout: 1000 }), null)).toThrow(
      '无效的信标数据，缺少必要字段'
    )
  })

  it('getMsg rethrows non-SyntaxError errors as-is', () => {
    // AppException is thrown by validation - it should pass through, not be wrapped
    expect(() => strategy.getMsg(validBeaconJson({ description: '' }), null)).toThrow(AppException)
  })

  it('buildMessageBody returns Matrix beacon structure', () => {
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.BEACON,
        description: 'Meeting Room',
        timeout: 60000,
        isLive: true,
        reply: { content: 'r', key: 'rk' }
      },
      null
    )
    expect(body.description).toBe('Meeting Room')
    expect(body.timeout).toBe(60000)
    expect(body.live).toBe(true)
    expect(body.msgtype).toBe('m.beacon_info')
    expect(body.body).toBe('开启了位置共享: Meeting Room')
    expect(body.replyMsgId).toBe('rk')
    expect(body['org.matrix.msc3488.asset']).toEqual({ type: 'm.self' })
    expect(body['org.matrix.msc3488.ts']).toBeTypeOf('number')
    expect(body.reply).toBeUndefined()
  })

  it('buildMessageBody uses undefined replyMsgId when no reply', () => {
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.BEACON,
        description: 'X',
        timeout: 0,
        isLive: false
      },
      null
    )
    expect(body.replyMsgId).toBeUndefined()
  })

  it('buildMessageBody propagates full reply object', () => {
    const reply = makeReply('evt-9', 'parent', 'bob')
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.BEACON,
        description: 'X',
        timeout: 0,
        isLive: false
      },
      reply
    )
    expect(body.reply).toEqual({
      body: 'parent',
      id: 'evt-9',
      username: 'bob',
      type: MsgEnum.BEACON
    })
  })
})
