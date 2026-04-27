import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { AppException } from '@/common/exception'
import { TextMessageStrategyImpl } from '../text'

describe('TextMessageStrategyImpl', () => {
  const strategy = new TextMessageStrategyImpl()

  it('uses MsgEnum.TEXT as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.TEXT)
  })

  it('getMsg replaces &nbsp; with spaces', () => {
    const msg = strategy.getMsg('hello&nbsp;world', null) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.TEXT)
    expect(msg.content).toBe('hello world')
    expect(msg.reply).toBeUndefined()
  })

  it('getMsg strips HTML tags via removeTag', () => {
    const msg = strategy.getMsg('<b>bold</b>plain', null) as Record<string, unknown>
    expect(msg.content).toBe('boldplain')
  })

  it('getMsg attaches reply ref when reply has content', () => {
    const reply = {
      message: { id: 'evt-1', body: { content: 'hi' } },
      fromUser: { username: 'a' }
    } as any
    const msg = strategy.getMsg('hello', reply) as Record<string, unknown>
    expect(msg.reply).toEqual({ content: 'hi', key: 'evt-1' })
  })

  it('getMsg sanitizes content via DOMPurify when reply present', () => {
    const reply = {
      message: { id: 'r-1', body: { content: 'r' } },
      fromUser: { username: 'a' }
    } as any
    const msg = strategy.getMsg('hello world', reply) as Record<string, unknown>
    expect(msg.content).toBe('hello world')
    expect(msg.reply).toEqual({ content: 'r', key: 'r-1' })
  })

  it('getMsg throws when content length exceeds 500', () => {
    const long = 'a'.repeat(501)
    expect(() => strategy.getMsg(long, null)).toThrow(AppException)
    expect(() => strategy.getMsg(long, null)).toThrow('消息内容超过限制500，请分段发送')
  })

  it('buildMessageBody mirrors content and reply ref key', () => {
    const body = strategy.buildMessageBody(
      { type: MsgEnum.TEXT, content: 'hi', reply: { content: 'r', key: 'rk' } },
      null
    )
    expect(body.body).toBe('hi')
    expect(body.content).toBe('hi')
    expect(body.msgtype).toBe('m.text')
    expect(body.replyMsgId).toBe('rk')
    expect(body.reply).toBeUndefined()
  })

  it('buildMessageBody propagates full reply object', () => {
    const reply = {
      message: { id: 'evt-2', body: { content: 'parent' } },
      fromUser: { username: 'bob' }
    } as any
    const body = strategy.buildMessageBody({ type: MsgEnum.TEXT, content: 'child' }, reply)
    expect(body.reply).toEqual({
      body: 'parent',
      id: 'evt-2',
      username: 'bob',
      type: MsgEnum.TEXT
    })
  })
})
