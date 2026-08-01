import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { AppException } from '@/common/exception'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageAction, MessageActionContext } from '../base'
import { AbstractMessageStrategy } from '../base'

const getUserInfoMock = vi.fn()

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: getUserInfoMock
  })
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

// Concrete implementation for testing the abstract class
class TestStrategy extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  buildMessageBody(msg: Record<string, unknown>): Record<string, unknown> {
    return { ...msg }
  }

  getMsg(msgInputValue: string): Record<string, unknown> {
    return { content: msgInputValue }
  }
}

describe('AbstractMessageStrategy', () => {
  let strategy: TestStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    getUserInfoMock.mockReturnValue({ name: 'Alice', avatar: 'a.png' })
    strategy = new TestStrategy()
  })

  describe('constructor', () => {
    it('stores the msgType', () => {
      expect(strategy.msgType).toBe(MsgEnum.TEXT)
    })
  })

  describe('buildMessageType', () => {
    it('constructs a MessageType with userInfo from groupStore', () => {
      const body = { content: 'hi' }
      const result = strategy.buildMessageType(
        'msg-1',
        body,
        { currentSessionRoomId: 'room-1' },
        ref('@alice:matrix.test')
      )

      expect(result.clientKey).toBe('msg-1')
      expect(result.fromUser.uid).toBe('@alice:matrix.test')
      expect(result.fromUser.username).toBe('Alice')
      expect(result.fromUser.avatar).toBe('a.png')
      expect(result.message.id).toBe('msg-1')
      expect(result.message.roomId).toBe('room-1')
      expect(result.message.status).toBe(MessageStatusEnum.PENDING)
      expect(result.message.type).toBe(MsgEnum.TEXT)
      expect(result.message.body).toBe(body)
      expect(result.message.messageMarks).toEqual({})
      expect(result.loading).toBe(false)
    })

    it('falls back to empty username/avatar when getUserInfo returns null', () => {
      getUserInfoMock.mockReturnValue(null)
      const result = strategy.buildMessageType('msg-2', {}, { currentSessionRoomId: 'r' }, ref('@bob:matrix.test'))
      expect(result.fromUser.username).toBe('')
      expect(result.fromUser.avatar).toBe('')
    })

    it('falls back to empty uid when userUid ref is empty', () => {
      const result = strategy.buildMessageType('msg-3', {}, { currentSessionRoomId: 'r' }, ref(''))
      expect(result.fromUser.uid).toBe('')
    })

    it('uses current time for sendTime and message.sendTime', () => {
      const before = Date.now()
      const result = strategy.buildMessageType('msg-4', {}, { currentSessionRoomId: 'r' }, ref('u'))
      const after = Date.now()
      expect(result.message.sendTime).toBeGreaterThanOrEqual(before)
      expect(result.message.sendTime).toBeLessThanOrEqual(after)
      expect(result.sendTime).toBeGreaterThanOrEqual(before)
      expect(result.sendTime).toBeLessThanOrEqual(after)
    })
  })

  describe('uploadFile (base default)', () => {
    it('throws AppException indicating unsupported', () => {
      expect(() => strategy.uploadFile('/path')).toThrow(AppException)
      expect(() => strategy.uploadFile('/path')).toThrow('该消息类型不支持文件上传')
    })
  })

  describe('doUpload (base default)', () => {
    it('throws AppException indicating unsupported', () => {
      expect(() => strategy.doUpload('/path', 'url')).toThrow(AppException)
      expect(() => strategy.doUpload('/path', 'url')).toThrow('该消息类型不支持文件上传')
    })
  })

  describe('getAllowedActions', () => {
    const ctx = (overrides: Partial<MessageActionContext> = {}): MessageActionContext => ({
      isMe: false,
      canModerate: false,
      isPinned: false,
      ...overrides
    })

    it('returns reply/forward/mark for others messages (no copy for non-TEXT)', () => {
      // Use IMAGE type to test non-TEXT branch
      class ImageTestStrategy extends AbstractMessageStrategy {
        constructor() {
          super(MsgEnum.IMAGE)
        }
        buildMessageBody(msg: Record<string, unknown>): Record<string, unknown> {
          return msg
        }
        getMsg(msgInputValue: string): Record<string, unknown> {
          return { content: msgInputValue }
        }
      }
      const s = new ImageTestStrategy()
      const actions = s.getAllowedActions(ctx())
      expect(actions).toContain('reply')
      expect(actions).toContain('forward')
      expect(actions).toContain('mark')
      expect(actions).not.toContain('copy')
      expect(actions).not.toContain('edit')
      expect(actions).not.toContain('recall')
      expect(actions).not.toContain('pin')
      expect(actions).not.toContain('delete')
    })

    it('includes copy for TEXT type', () => {
      const actions = strategy.getAllowedActions(ctx())
      expect(actions).toContain('copy')
    })

    it('excludes edit/recall when isMe is false', () => {
      const actions = strategy.getAllowedActions(ctx({ isMe: false, canModerate: true }))
      expect(actions).not.toContain('edit')
      expect(actions).not.toContain('recall')
      // but pin/delete are available via canModerate
      expect(actions).toContain('pin')
      expect(actions).toContain('delete')
    })

    it('includes edit when isMe is true (no canModerate)', () => {
      const actions = strategy.getAllowedActions(ctx({ isMe: true, canModerate: false }))
      expect(actions).toContain('edit')
      expect(actions).not.toContain('recall')
      expect(actions).not.toContain('pin')
      expect(actions).not.toContain('delete')
    })

    it('includes edit/recall/pin/delete when isMe and canModerate', () => {
      const actions = strategy.getAllowedActions(ctx({ isMe: true, canModerate: true }))
      expect(actions).toContain('edit')
      expect(actions).toContain('recall')
      expect(actions).toContain('pin')
      expect(actions).toContain('delete')
    })

    it('returns consistent base actions order: reply/forward/mark first', () => {
      const actions = strategy.getAllowedActions(ctx())
      expect(actions.slice(0, 3)).toEqual(['reply', 'forward', 'mark'])
    })

    it('always includes reply/forward/mark regardless of context', () => {
      const actions1 = strategy.getAllowedActions(ctx({ isMe: true, canModerate: true }))
      const actions2 = strategy.getAllowedActions(ctx({ isMe: false, canModerate: false }))
      for (const a of ['reply', 'forward', 'mark'] as MessageAction[]) {
        expect(actions1).toContain(a)
        expect(actions2).toContain(a)
      }
    })
  })
})
