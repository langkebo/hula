import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { ImageMessageStrategyImpl } from '../image'

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

vi.mock('@/utils/FileType', () => ({
  fixFileMimeType: vi.fn((f: File) => f),
  isVideoUrl: vi.fn()
}))

vi.mock('@/utils/Formatting', () => ({
  getMimeTypeFromExtension: vi.fn((name: string) => {
    if (name.endsWith('.png')) return 'image/png'
    if (name.endsWith('.jpg')) return 'image/jpeg'
    return 'application/octet-stream'
  })
}))

vi.mock('@/utils/ImageUtils', () => ({
  getImageDimensions: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => false
}))

describe('ImageMessageStrategyImpl', () => {
  const strategy = new ImageMessageStrategyImpl()

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  it('uses MsgEnum.IMAGE as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.IMAGE)
  })

  describe('buildMessageBody', () => {
    it('mirrors image fields from imageInfo nested object', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.IMAGE,
          url: 'https://cdn.example.com/img.png',
          path: '/tmp/img.png',
          imageInfo: { width: 800, height: 600, size: 12345 },
          reply: { content: 'r', key: 'rk' }
        },
        null
      )
      expect(body.url).toBe('https://cdn.example.com/img.png')
      expect(body.path).toBe('/tmp/img.png')
      expect(body.width).toBe(800)
      expect(body.height).toBe(600)
      expect(body.size).toBe(12345)
      expect(body.replyMsgId).toBe('rk')
      expect(body.reply).toBeUndefined()
    })

    it('uses undefined replyMsgId when no reply', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.IMAGE,
          url: 'u',
          path: 'p',
          imageInfo: { width: 1, height: 1, size: 1 }
        },
        null
      )
      expect(body.replyMsgId).toBeUndefined()
    })

    it('propagates full reply object', () => {
      const reply = makeReply('evt-2', 'parent', 'bob')
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.IMAGE,
          url: 'u',
          path: 'p',
          imageInfo: { width: 1, height: 1, size: 1 }
        },
        reply
      )
      expect(body.reply).toEqual({
        body: 'parent',
        id: 'evt-2',
        username: 'bob',
        type: MsgEnum.IMAGE
      })
    })
  })

  it('getAllowedActions inherits base strategy (no copy for IMAGE)', () => {
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).toContain('reply')
    expect(actions).toContain('forward')
    expect(actions).toContain('mark')
    expect(actions).not.toContain('copy')
  })
})
