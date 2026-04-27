import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { AppException } from '@/common/exception'
import { LinkPreviewMessageStrategyImpl } from '../linkPreview'

describe('LinkPreviewMessageStrategyImpl', () => {
  const strategy = new LinkPreviewMessageStrategyImpl()

  it('uses MsgEnum.LINK_PREVIEW as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.LINK_PREVIEW)
  })

  it('parses valid link data and applies defaults', () => {
    const input = JSON.stringify({ url: 'https://x.com', title: 'Hello' })
    const msg = strategy.getMsg(input, null) as Record<string, unknown>
    expect(msg.url).toBe('https://x.com')
    expect(msg.title).toBe('Hello')
    expect(msg.description).toBe('')
    expect(msg.imageUrl).toBe('')
    expect(msg.siteName).toBe('')
  })

  it('preserves optional metadata when provided', () => {
    const input = JSON.stringify({
      url: 'https://x.com',
      title: 'Hi',
      description: 'desc',
      imageUrl: 'https://x.com/img.png',
      siteName: 'X'
    })
    const msg = strategy.getMsg(input, null) as Record<string, unknown>
    expect(msg.description).toBe('desc')
    expect(msg.imageUrl).toBe('https://x.com/img.png')
    expect(msg.siteName).toBe('X')
  })

  it('throws on invalid JSON', () => {
    expect(() => strategy.getMsg('bad', null)).toThrow(AppException)
    expect(() => strategy.getMsg('bad', null)).toThrow('链接数据格式错误，必须是有效的JSON')
  })

  it('throws when required fields missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ url: 'https://x.com' }), null)).toThrow(
      '无效的链接预览数据，缺少必要字段'
    )
  })

  it('buildMessageBody renders HTML anchor and MSC2788 metadata', () => {
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.LINK_PREVIEW,
        url: 'https://x.com',
        title: 'Hi',
        description: 'd',
        imageUrl: 'i',
        siteName: 's'
      },
      null
    )
    expect(body.msgtype).toBe('m.text')
    expect(body.body).toBe('https://x.com')
    expect(body.formatted_body).toBe('<a href="https://x.com">Hi</a>')
    const ext = body['org.matrix.msc2788.room.message'] as Record<string, unknown>
    expect(ext.url).toBe('https://x.com')
    expect(ext.title).toBe('Hi')
    expect(ext.description).toBe('d')
    expect(ext.image_url).toBe('i')
    expect(ext.site_name).toBe('s')
  })
})
