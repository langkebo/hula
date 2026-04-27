import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { getReplyContent } from '../MessageReply'

const make = (type: MsgEnum, body: Record<string, unknown>): any => ({ type, body })

describe('getReplyContent', () => {
  it('returns text content and replaces &nbsp; with spaces', () => {
    expect(getReplyContent(make(MsgEnum.TEXT, { content: 'a&nbsp;b' }))).toBe('a b')
  })

  it('returns empty string when text content is missing', () => {
    expect(getReplyContent(make(MsgEnum.TEXT, {}))).toBe('')
  })

  it('returns video thumbnail url, falls back to [视频]', () => {
    expect(getReplyContent(make(MsgEnum.VIDEO, { thumbUrl: 'http://x/t.jpg' }))).toBe('http://x/t.jpg')
    expect(getReplyContent(make(MsgEnum.VIDEO, {}))).toBe('[视频]')
  })

  it('formats voice message with seconds', () => {
    expect(getReplyContent(make(MsgEnum.VOICE, { second: 7 }))).toBe('[语音] 7秒')
    expect(getReplyContent(make(MsgEnum.VOICE, {}))).toBe('[语音] 0秒')
  })

  it('formats file message with filename', () => {
    expect(getReplyContent(make(MsgEnum.FILE, { fileName: 'a.pdf' }))).toBe('[文件] a.pdf')
    expect(getReplyContent(make(MsgEnum.FILE, {}))).toBe('[文件] ')
  })

  it('returns image url, falls back to [图片]', () => {
    expect(getReplyContent(make(MsgEnum.IMAGE, { url: 'http://x/i.jpg' }))).toBe('http://x/i.jpg')
    expect(getReplyContent(make(MsgEnum.IMAGE, {}))).toBe('[图片]')
  })

  it('formats notice message', () => {
    expect(getReplyContent(make(MsgEnum.NOTICE, { content: 'hi' }))).toBe('[公告] hi')
  })

  it('renders system messages with placeholder text', () => {
    expect(getReplyContent(make(MsgEnum.SYSTEM, {}))).toBe('[系统消息]')
  })

  it('renders merged messages with placeholder text', () => {
    expect(getReplyContent(make(MsgEnum.MERGE, {}))).toBe('[聊天记录]')
  })

  it('formats AI message and replaces &nbsp;', () => {
    expect(getReplyContent(make(MsgEnum.AI, { content: 'hello&nbsp;world' }))).toBe(
      "'[AI消息]'hello world"
    )
  })

  it('falls back to body.content for unknown types', () => {
    expect(getReplyContent(make(99 as MsgEnum, { content: 'unknown&nbsp;text' }))).toBe('unknown text')
  })

  it('falls back to body.url for unknown types when content missing', () => {
    expect(getReplyContent(make(99 as MsgEnum, { url: 'http://x' }))).toBe('http://x')
  })

  it('falls back to [未知消息] for unknown types with empty body', () => {
    expect(getReplyContent(make(99 as MsgEnum, {}))).toBe('[未知消息]')
  })
})
