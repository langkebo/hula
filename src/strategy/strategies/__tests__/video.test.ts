import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { VideoMessageStrategyImpl } from '../video'

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 'AppData', AppCache: 'AppCache' },
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('@/composables/common/useUpload', () => ({
  useUpload: () => ({
    getUploadAndDownloadUrl: vi.fn(),
    doUpload: vi.fn(),
    progress: { value: 0 },
    onChange: vi.fn()
  }),
  UploadProviderEnum: { DEFAULT: 'default' }
}))

vi.mock('@/composables/common/useCommon', () => ({
  parseInnerText: vi.fn()
}))

vi.mock('@/utils/FileType', () => ({
  isVideoUrl: vi.fn((url: string) => /\.(mp4|mov|avi|wmv|webm)$/i.test(url))
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => false
}))

vi.mock('@/utils/TempFileManager', () => ({
  removeTempFile: vi.fn()
}))

vi.mock('@/utils/VideoThumbnail', () => ({
  generateVideoThumbnail: vi.fn()
}))

describe('VideoMessageStrategyImpl', () => {
  const strategy = new VideoMessageStrategyImpl()

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  it('uses MsgEnum.VIDEO as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.VIDEO)
  })

  describe('buildMessageBody', () => {
    it('builds body with thumbnail File and creates thumbUrl via URL.createObjectURL', () => {
      const blob = new Blob(['thumb'], { type: 'image/jpeg' })
      const thumbFile = new File([blob], 'thumb.jpg', { type: 'image/jpeg' })
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://example.com/thumb')

      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.VIDEO,
          url: 'https://cdn.example.com/v.mp4',
          path: '/tmp/v.mp4',
          thumbnail: thumbFile,
          size: 1024,
          duration: 30,
          reply: { content: 'r', key: 'rk' }
        },
        null
      )

      expect(body.url).toBe('https://cdn.example.com/v.mp4')
      expect(body.path).toBe('/tmp/v.mp4')
      expect(body.thumbnail).toBe(thumbFile)
      expect(body.thumbUrl).toBe('blob:https://example.com/thumb')
      expect(body.thumbSize).toBe(thumbFile.size)
      expect(body.thumbWidth).toBe(300)
      expect(body.thumbHeight).toBe(150)
      expect(body.size).toBe(1024)
      expect(body.duration).toBe(30)
      expect(body.replyMsgId).toBe('rk')
      expect(body.reply).toBeUndefined()

      createObjectURLSpy.mockRestore()
    })

    it('returns 0 thumbSize when thumbnail is not a File', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.VIDEO,
          url: 'u',
          path: 'p',
          thumbnail: 'https://example.com/thumb.jpg',
          size: 100,
          duration: 5
        },
        null
      )
      expect(body.thumbSize).toBe(0)
      expect(body.thumbUrl).toBe('')
    })

    it('returns 0 thumbSize when thumbnail is undefined', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.VIDEO,
          url: 'u',
          path: 'p',
          size: 100,
          duration: 5
        },
        null
      )
      expect(body.thumbSize).toBe(0)
    })

    it('uses undefined replyMsgId when no reply', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.VIDEO,
          url: 'u',
          path: 'p',
          size: 0,
          duration: 0
        },
        null
      )
      expect(body.replyMsgId).toBeUndefined()
    })

    it('propagates full reply object', () => {
      const reply = makeReply('evt-3', 'parent', 'carol')
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.VIDEO,
          url: 'u',
          path: 'p',
          size: 0,
          duration: 0
        },
        reply
      )
      expect(body.reply).toEqual({
        body: 'parent',
        id: 'evt-3',
        username: 'carol',
        type: MsgEnum.VIDEO
      })
    })
  })

  it('getAllowedActions inherits base strategy (no copy for VIDEO)', () => {
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).toContain('reply')
    expect(actions).toContain('forward')
    expect(actions).toContain('mark')
    expect(actions).not.toContain('copy')
  })
})
