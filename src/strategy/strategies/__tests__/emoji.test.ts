import { describe, expect, it } from 'vitest'
import { AppException } from '@/common/exception'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { EmojiMessageStrategyImpl } from '../emoji'

describe('EmojiMessageStrategyImpl', () => {
  const strategy = new EmojiMessageStrategyImpl()
  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  it('uses MsgEnum.EMOJI as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.EMOJI)
  })

  it('getMsg accepts a valid URL and returns url+path', () => {
    const url = 'https://example.com/emoji.gif'
    const msg = strategy.getMsg(url, null) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.EMOJI)
    expect(msg.url).toBe(url)
    expect(msg.path).toBe(url)
    expect(msg.reply).toBeUndefined()
  })

  it('getMsg throws on invalid URL', () => {
    expect(() => strategy.getMsg('not-a-url', null)).toThrow(AppException)
    expect(() => strategy.getMsg('not-a-url', null)).toThrow('无效的表情包URL')
  })

  it('getMsg attaches reply ref when reply has content', () => {
    const reply = makeReply('evt-1', 'hi', 'alice')
    const msg = strategy.getMsg('https://example.com/x.gif', reply) as Record<string, unknown>
    expect(msg.reply).toEqual({ content: 'hi', key: 'evt-1' })
  })

  it('buildMessageBody mirrors url and reply ref', () => {
    const body = strategy.buildMessageBody(
      { type: MsgEnum.EMOJI, url: 'https://x', reply: { content: 'r', key: 'k' } },
      null
    )
    expect(body.url).toBe('https://x')
    expect(body.replyMsgId).toBe('k')
    expect(body.reply).toBeUndefined()
  })

  it('buildMessageBody propagates reply with full reply object', () => {
    const reply = makeReply('evt-2', 'hi', 'bob')
    const body = strategy.buildMessageBody({ type: MsgEnum.EMOJI, url: 'https://x' }, reply)
    expect(body.reply).toEqual({ body: 'hi', id: 'evt-2', username: 'bob', type: MsgEnum.EMOJI })
  })

  it('uploadFile returns the source url as downloadUrl', async () => {
    const result = await strategy.uploadFile('https://x.com/e.gif')
    expect(result.uploadUrl).toBe('')
    expect(result.downloadUrl).toBe('https://x.com/e.gif')
  })

  it('doUpload resolves without value', async () => {
    await expect(strategy.doUpload()).resolves.toBeUndefined()
  })
})
