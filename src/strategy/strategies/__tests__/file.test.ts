import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { FileMessageStrategyImpl } from '../file'

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

vi.mock('@/utils/Formatting', () => ({
  getMimeTypeFromExtension: vi.fn((name: string) => {
    if (name.endsWith('.pdf')) return 'application/pdf'
    if (name.endsWith('.txt')) return 'text/plain'
    return 'application/octet-stream'
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => false
}))

describe('FileMessageStrategyImpl', () => {
  const strategy = new FileMessageStrategyImpl()

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  it('uses MsgEnum.FILE as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.FILE)
  })

  describe('buildMessageBody', () => {
    it('mirrors file fields with empty url placeholder', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.FILE,
          path: '/tmp/doc.pdf',
          fileName: 'doc.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          reply: { content: 'r', key: 'rk' }
        },
        null
      )
      expect(body.url).toBe('')
      expect(body.path).toBe('/tmp/doc.pdf')
      expect(body.fileName).toBe('doc.pdf')
      expect(body.size).toBe(1024)
      expect(body.mimeType).toBe('application/pdf')
      expect(body.replyMsgId).toBe('rk')
      expect(body.reply).toBeUndefined()
    })

    it('uses undefined replyMsgId when no reply', () => {
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.FILE,
          path: 'p',
          fileName: 'n',
          size: 0,
          mimeType: 'm'
        },
        null
      )
      expect(body.replyMsgId).toBeUndefined()
    })

    it('propagates full reply object', () => {
      const reply = makeReply('evt-1', 'parent', 'alice')
      const body = strategy.buildMessageBody(
        {
          type: MsgEnum.FILE,
          path: 'p',
          fileName: 'n',
          size: 0,
          mimeType: 'm'
        },
        reply
      )
      expect(body.reply).toEqual({
        body: 'parent',
        id: 'evt-1',
        username: 'alice',
        type: MsgEnum.FILE
      })
    })
  })

  it('getAllowedActions inherits base strategy (no copy for FILE)', () => {
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).toContain('reply')
    expect(actions).toContain('forward')
    expect(actions).toContain('mark')
    expect(actions).not.toContain('copy')
  })
})
