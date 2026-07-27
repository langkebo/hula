import { describe, expect, it } from 'vitest'
import { EXTENSION_NOTIFY_EVENT_TYPES, shouldNotifyForEventType } from '@/services/matrix/notifications/pushRules'

describe('pushRules — 推送规则扩展 (§9.2.5)', () => {
  describe('核心 Matrix 事件类型', () => {
    it('m.room.message 触发推送', () => {
      expect(shouldNotifyForEventType('m.room.message')).toBe(true)
    })

    it('m.room.encrypted 触发推送', () => {
      expect(shouldNotifyForEventType('m.room.encrypted')).toBe(true)
    })

    it('m.room.member invite 触发推送', () => {
      expect(shouldNotifyForEventType('m.room.member')).toBe(true)
    })

    it('m.reaction 不触发推送（轻量反应）', () => {
      expect(shouldNotifyForEventType('m.reaction')).toBe(false)
    })

    it('m.typing 不触发推送（临时状态）', () => {
      expect(shouldNotifyForEventType('m.typing')).toBe(false)
    })

    it('m.presence 不触发推送', () => {
      expect(shouldNotifyForEventType('m.presence')).toBe(false)
    })

    it('m.receipt 不触发推送', () => {
      expect(shouldNotifyForEventType('m.receipt')).toBe(false)
    })
  })

  describe('扩展事件类型（§9.2.5 新增）', () => {
    it('im.hula.friend_request 触发推送（好友请求）', () => {
      expect(shouldNotifyForEventType('im.hula.friend_request')).toBe(true)
    })

    it('im.hula.widget_event 触发推送（Widget 事件）', () => {
      expect(shouldNotifyForEventType('im.hula.widget_event')).toBe(true)
    })

    it('im.hula.ai_tool_result 触发推送（AI 工具调用结果）', () => {
      expect(shouldNotifyForEventType('im.hula.ai_tool_result')).toBe(true)
    })

    it('EXTENSION_NOTIFY_EVENT_TYPES 包含 3 个扩展类型', () => {
      expect(EXTENSION_NOTIFY_EVENT_TYPES).toContain('im.hula.friend_request')
      expect(EXTENSION_NOTIFY_EVENT_TYPES).toContain('im.hula.widget_event')
      expect(EXTENSION_NOTIFY_EVENT_TYPES).toContain('im.hula.ai_tool_result')
      expect(EXTENSION_NOTIFY_EVENT_TYPES.size).toBe(3)
    })
  })

  describe('未知事件类型', () => {
    it('未知自定义类型不触发推送', () => {
      expect(shouldNotifyForEventType('im.unknown.custom')).toBe(false)
    })

    it('空字符串不触发推送', () => {
      expect(shouldNotifyForEventType('')).toBe(false)
    })

    it('org.matrix.custom 不触发推送（非白名单）', () => {
      expect(shouldNotifyForEventType('org.matrix.custom')).toBe(false)
    })
  })

  describe('大小写不敏感', () => {
    it('M.ROOM.MESSAGE 仍触发推送', () => {
      expect(shouldNotifyForEventType('M.ROOM.MESSAGE')).toBe(true)
    })

    it('IM.HULA.FRIEND_REQUEST 仍触发推送', () => {
      expect(shouldNotifyForEventType('IM.HULA.FRIEND_REQUEST')).toBe(true)
    })
  })
})
