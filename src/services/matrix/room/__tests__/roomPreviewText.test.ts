import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tMock, useI18nGlobalMock } = vi.hoisted(() => ({
  tMock: vi.fn((key: string) => `${key}#translated`),
  useI18nGlobalMock: vi.fn(() => ({ t: tMock }))
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: useI18nGlobalMock
}))

// 注意：roomPreviewText 使用模块级缓存。每个 it 之间需要重置 mock 调用计数，
// 但缓存命中不会调用 t()。为避免缓存干扰，每个 it 使用唯一的输入。

import { MsgEnum } from '@/enums'
import { getMessagePreviewByType, getRoomTimelinePreview } from '../roomPreviewText'

/**
 * 默认情况下 t() 返回 `key#translated`，与 key 不同，模拟翻译成功。
 * 这样 `translateRoomPreview` 会返回 translated 值。
 */
describe('roomPreviewText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useI18nGlobalMock.mockReturnValue({ t: tMock })
    tMock.mockImplementation((key: string) => `${key}#translated`)
  })

  describe('getRoomTimelinePreview', () => {
    it('m.text 消息返回 body 字段', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.text', body: 'hello-1' })
      expect(result).toBe('hello-1')
    })

    it('m.notice 消息返回 body 字段', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.notice', body: 'notice-2' })
      expect(result).toBe('notice-2')
    })

    it('m.text 消息但 body 不是字符串时返回 null', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.text', body: 123 })
      expect(result).toBeNull()
    })

    it('m.text 消息缺少 body 时返回 null', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.text', body: 'missing-3' })
      // body 为 'missing-3' 字符串，所以会返回该字符串
      expect(result).toBe('missing-3')
    })

    it('m.text 消息完全没有 body 字段时返回 null', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.text', noBody: true })
      expect(result).toBeNull()
    })

    it('m.image 消息返回翻译后的图片预览', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.image', body: 'img-4' })
      expect(result).toBe('room_preview.media.image#translated')
      expect(tMock).toHaveBeenCalledWith('room_preview.media.image')
    })

    it('m.video 消息返回翻译后的视频预览', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.video', body: 'vid-5' })
      expect(result).toBe('room_preview.media.video#translated')
    })

    it('m.audio 消息返回翻译后的音频预览', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.audio', body: 'aud-6' })
      expect(result).toBe('room_preview.media.audio#translated')
    })

    it('m.voice 消息返回翻译后的音频预览', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.voice', body: 'voi-7' })
      expect(result).toBe('room_preview.media.audio#translated')
    })

    it('m.file 消息返回翻译后的文件预览', () => {
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.file', body: 'file-8' })
      expect(result).toBe('room_preview.media.file#translated')
    })

    it('m.room.member join 事件返回加入房间预览', () => {
      const result = getRoomTimelinePreview('m.room.member', { membership: 'join', uniq: 9 })
      expect(result).toBe('room_preview.membership.join#translated')
    })

    it('m.room.member leave 事件返回离开房间预览', () => {
      const result = getRoomTimelinePreview('m.room.member', { membership: 'leave', uniq: 10 })
      expect(result).toBe('room_preview.membership.leave#translated')
    })

    it('未知事件类型但有 body 时返回 body', () => {
      const result = getRoomTimelinePreview('org.custom.event', { body: 'custom-11' })
      expect(result).toBe('custom-11')
    })

    it('未知事件类型且无 body 时返回 null', () => {
      const result = getRoomTimelinePreview('org.custom.event', { uniq: 12 })
      expect(result).toBeNull()
    })

    it('使用 fallback 当 useI18nGlobal 抛出异常', () => {
      useI18nGlobalMock.mockImplementation(() => {
        throw new Error('i18n not ready')
      })
      const result = getRoomTimelinePreview('m.room.message', { msgtype: 'm.image', body: 'throw-13' })
      expect(result).toBe('[图片]')
    })

    it('使用 fallback 当翻译返回值等于 key', () => {
      tMock.mockImplementation((key: string) => key)
      const result = getRoomTimelinePreview('m.room.message', {
        msgtype: 'm.image',
        body: 'fallback-14'
      })
      expect(result).toBe('[图片]')
    })

    it('命中缓存时不再次调用 t()', () => {
      const body = { msgtype: 'm.image', body: 'cached-15' }
      const first = getRoomTimelinePreview('m.room.message', body)
      expect(first).toBe('room_preview.media.image#translated')
      const callCountAfterFirst = tMock.mock.calls.length

      const second = getRoomTimelinePreview('m.room.message', body)
      expect(second).toBe(first)
      expect(tMock.mock.calls.length).toBe(callCountAfterFirst)
    })
  })

  describe('getMessagePreviewByType', () => {
    it('TEXT 类型返回 body.content', () => {
      const result = getMessagePreviewByType(MsgEnum.TEXT, { content: 'hi-16' })
      expect(result).toBe('hi-16')
    })

    it('TEXT 类型回退到 body.body', () => {
      const result = getMessagePreviewByType(MsgEnum.TEXT, { body: 'fallback-17' })
      expect(result).toBe('fallback-17')
    })

    it('TEXT 类型无内容时返回空字符串', () => {
      const result = getMessagePreviewByType(MsgEnum.TEXT, { uniq: 18 })
      expect(result).toBe('')
    })

    it('IMAGE 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.IMAGE, { uniq: 19 })
      expect(result).toBe('room_preview.media.image#translated')
    })

    it('VIDEO 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.VIDEO, { uniq: 20 })
      expect(result).toBe('room_preview.media.video#translated')
    })

    it('VOICE 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.VOICE, { uniq: 21 })
      expect(result).toBe('room_preview.media.voice#translated')
    })

    it('FILE 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.FILE, { uniq: 22 })
      expect(result).toBe('room_preview.media.file#translated')
    })

    it('EMOJI 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.EMOJI, { uniq: 23 })
      expect(result).toBe('room_preview.media.emoji#translated')
    })

    it('NOTICE 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.NOTICE, { uniq: 24 })
      expect(result).toBe('room_preview.media.notice#translated')
    })

    it('MERGE 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.MERGE, { uniq: 25 })
      expect(result).toBe('room_preview.media.merge#translated')
    })

    it('VIDEO_CALL 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.VIDEO_CALL, { uniq: 26 })
      expect(result).toBe('room_preview.media.video_call#translated')
    })

    it('AUDIO_CALL 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.AUDIO_CALL, { uniq: 27 })
      expect(result).toBe('room_preview.media.audio_call#translated')
    })

    it('LOCATION 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.LOCATION, { uniq: 28 })
      expect(result).toBe('room_preview.media.location#translated')
    })

    it('BEACON 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.BEACON, { uniq: 29 })
      expect(result).toBe('room_preview.media.beacon#translated')
    })

    it('LINK_PREVIEW 类型返回翻译预览', () => {
      const result = getMessagePreviewByType(MsgEnum.LINK_PREVIEW, { uniq: 30 })
      expect(result).toBe('room_preview.media.link_preview#translated')
    })

    it('SYSTEM 类型 membership=join 返回加入预览', () => {
      const result = getMessagePreviewByType(MsgEnum.SYSTEM, { membership: 'join', uniq: 31 })
      expect(result).toBe('room_preview.membership.join#translated')
    })

    it('SYSTEM 类型 membership=leave 返回离开预览', () => {
      const result = getMessagePreviewByType(MsgEnum.SYSTEM, { membership: 'leave', uniq: 32 })
      expect(result).toBe('room_preview.membership.leave#translated')
    })

    it('未知类型回退到 media.message 预览', () => {
      const result = getMessagePreviewByType(999 as MsgEnum, { uniq: 33 })
      expect(result).toBe('room_preview.media.message#translated')
    })

    it('使用 fallback 当 useI18nGlobal 抛出异常', () => {
      useI18nGlobalMock.mockImplementation(() => {
        throw new Error('boom')
      })
      const result = getMessagePreviewByType(MsgEnum.IMAGE, { unique: 'throw-34' })
      expect(result).toBe('[图片]')
    })

    it('使用 fallback 当翻译返回值等于 key', () => {
      tMock.mockImplementation((key: string) => key)
      const result = getMessagePreviewByType(MsgEnum.IMAGE, { unique: 'fallback-35' })
      expect(result).toBe('[图片]')
    })

    it('命中缓存时不再次调用 t()', () => {
      const body = { cacheTest: 'unique-value-for-cache-test-36' }
      const first = getMessagePreviewByType(MsgEnum.IMAGE, body)
      expect(first).toBe('room_preview.media.image#translated')
      const callCountAfterFirst = tMock.mock.calls.length

      const second = getMessagePreviewByType(MsgEnum.IMAGE, body)
      expect(second).toBe(first)
      expect(tMock.mock.calls.length).toBe(callCountAfterFirst)
    })
  })
})
