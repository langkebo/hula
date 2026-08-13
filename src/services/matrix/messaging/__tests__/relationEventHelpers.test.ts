import { describe, expect, it } from 'vitest'
import type { MatrixEvent } from '../../sdk'
import { getEditedContent, getReplyToEventId, getThreadRootId, isEdited } from '../relationEventHelpers'

/** 创建模拟 MatrixEvent 对象 */
function createMockEvent(content: Record<string, unknown>): MatrixEvent {
  return { getContent: () => content } as unknown as MatrixEvent
}

describe('relationEventHelpers', () => {
  describe('isEdited', () => {
    it('当存在 m.new_content 时返回 true', () => {
      const event = createMockEvent({
        body: '原始内容',
        'm.new_content': { body: '编辑后的内容' }
      })
      expect(isEdited(event)).toBe(true)
    })

    it('当不存在 m.new_content 时返回 false', () => {
      const event = createMockEvent({
        body: '原始内容'
      })
      expect(isEdited(event)).toBe(false)
    })

    it('当 m.new_content 为空对象时返回 true（存在即为已编辑）', () => {
      const event = createMockEvent({
        body: '原始内容',
        'm.new_content': {}
      })
      expect(isEdited(event)).toBe(true)
    })

    it('当内容为空对象时返回 false', () => {
      const event = createMockEvent({})
      expect(isEdited(event)).toBe(false)
    })

    it('当 m.new_content 为 null 时返回 false', () => {
      const event = createMockEvent({
        'm.new_content': null
      })
      expect(isEdited(event)).toBe(false)
    })
  })

  describe('getEditedContent', () => {
    it('当事件已编辑时返回 m.new_content 的内容', () => {
      const newContent = { body: '编辑后的内容', msgtype: 'm.text' }
      const event = createMockEvent({
        body: '原始内容',
        'm.new_content': newContent
      })
      expect(getEditedContent(event)).toEqual(newContent)
    })

    it('当事件未编辑时返回原始内容', () => {
      const originalContent = { body: '原始内容', msgtype: 'm.text' }
      const event = createMockEvent(originalContent)
      expect(getEditedContent(event)).toEqual(originalContent)
    })

    it('当 m.new_content 为空对象时返回空对象', () => {
      const event = createMockEvent({
        body: '原始内容',
        'm.new_content': {}
      })
      expect(getEditedContent(event)).toEqual({})
    })

    it('当内容为空对象时返回空对象', () => {
      const event = createMockEvent({})
      expect(getEditedContent(event)).toEqual({})
    })
  })

  describe('getReplyToEventId', () => {
    it('当存在 m.in_reply_to.event_id 时返回该 event_id', () => {
      const eventId = '$reply_target:server.com'
      const event = createMockEvent({
        body: '回复消息',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: eventId
          }
        }
      })
      expect(getReplyToEventId(event)).toBe(eventId)
    })

    it('当不存在 m.relates_to 时返回 null', () => {
      const event = createMockEvent({
        body: '普通消息'
      })
      expect(getReplyToEventId(event)).toBeNull()
    })

    it('当 m.relates_to 存在但 m.in_reply_to 不存在时返回 null', () => {
      const event = createMockEvent({
        body: '消息',
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: '$thread_root:server.com'
        }
      })
      expect(getReplyToEventId(event)).toBeNull()
    })

    it('当 m.in_reply_to 存在但 event_id 不存在时返回 null', () => {
      const event = createMockEvent({
        body: '消息',
        'm.relates_to': {
          'm.in_reply_to': {}
        }
      })
      expect(getReplyToEventId(event)).toBeNull()
    })

    it('当 event_id 为空字符串时返回 null', () => {
      const event = createMockEvent({
        body: '消息',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: ''
          }
        }
      })
      expect(getReplyToEventId(event)).toBeNull()
    })
  })

  describe('getThreadRootId', () => {
    it('当 rel_type 为 m.thread 时返回 event_id', () => {
      const threadRootId = '$thread_root:server.com'
      const event = createMockEvent({
        body: '线程回复',
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: threadRootId
        }
      })
      expect(getThreadRootId(event)).toBe(threadRootId)
    })

    it('当 rel_type 为 m.replace（编辑）时返回 null', () => {
      const event = createMockEvent({
        body: '编辑后的消息',
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: '$original:server.com'
        }
      })
      expect(getThreadRootId(event)).toBeNull()
    })

    it('当 rel_type 为其他自定义类型时返回 null', () => {
      const event = createMockEvent({
        body: '消息',
        'm.relates_to': {
          rel_type: 'm.custom',
          event_id: '$custom:server.com'
        }
      })
      expect(getThreadRootId(event)).toBeNull()
    })

    it('当不存在 m.relates_to 时返回 null', () => {
      const event = createMockEvent({
        body: '普通消息'
      })
      expect(getThreadRootId(event)).toBeNull()
    })

    it('当 m.relates_to 存在但 rel_type 不存在时返回 null', () => {
      const event = createMockEvent({
        body: '消息',
        'm.relates_to': {
          event_id: '$some:server.com'
        }
      })
      expect(getThreadRootId(event)).toBeNull()
    })

    it('当 rel_type 为 m.thread 但 event_id 不存在时返回 null', () => {
      const event = createMockEvent({
        body: '线程回复',
        'm.relates_to': {
          rel_type: 'm.thread'
        }
      })
      expect(getThreadRootId(event)).toBeNull()
    })

    it('当 rel_type 为 m.thread 但 event_id 为空字符串时返回 null', () => {
      const event = createMockEvent({
        body: '线程回复',
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: ''
        }
      })
      expect(getThreadRootId(event)).toBeNull()
    })

    it('当内容为空对象时返回 null', () => {
      const event = createMockEvent({})
      expect(getThreadRootId(event)).toBeNull()
    })
  })
})
