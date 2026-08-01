import { describe, expect, it } from 'vitest'
import { usePushRulesExtended } from '@/composables/notifications/usePushRulesExtended'

describe('usePushRulesExtended', () => {
  it('returns the expected functions', () => {
    const composable = usePushRulesExtended()

    expect(typeof composable.shouldNotify).toBe('function')
    expect(typeof composable.getExtensionEventTypes).toBe('function')
    expect(typeof composable.isExtensionEvent).toBe('function')
  })

  describe('shouldNotify', () => {
    it('notifies on im.hula.friend_request', () => {
      const { shouldNotify } = usePushRulesExtended()
      expect(shouldNotify('im.hula.friend_request')).toBe(true)
    })

    it('notifies on im.hula.widget_event', () => {
      const { shouldNotify } = usePushRulesExtended()
      expect(shouldNotify('im.hula.widget_event')).toBe(true)
    })

    it('notifies on im.hula.ai_tool_result', () => {
      const { shouldNotify } = usePushRulesExtended()
      expect(shouldNotify('im.hula.ai_tool_result')).toBe(true)
    })

    it('does not notify on m.reaction (silent)', () => {
      const { shouldNotify } = usePushRulesExtended()
      expect(shouldNotify('m.reaction')).toBe(false)
    })

    it('does not notify on unknown type', () => {
      const { shouldNotify } = usePushRulesExtended()
      expect(shouldNotify('im.unknown.type')).toBe(false)
    })

    it('does not notify on empty string', () => {
      const { shouldNotify } = usePushRulesExtended()
      expect(shouldNotify('')).toBe(false)
    })
  })

  describe('isExtensionEvent', () => {
    it('returns true for im.hula.friend_request', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('im.hula.friend_request')).toBe(true)
    })

    it('returns true for im.hula.widget_event', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('im.hula.widget_event')).toBe(true)
    })

    it('returns true for im.hula.ai_tool_result', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('im.hula.ai_tool_result')).toBe(true)
    })

    it('returns false for m.room.message (core event)', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('m.room.message')).toBe(false)
    })

    it('returns false for unknown type', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('im.unknown.type')).toBe(false)
    })

    it('returns false for empty string', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('')).toBe(false)
    })

    it('is case-insensitive', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      expect(isExtensionEvent('IM.HULA.FRIEND_REQUEST')).toBe(true)
    })
  })

  describe('getExtensionEventTypes', () => {
    it('returns the 3 extension event types', () => {
      const { getExtensionEventTypes } = usePushRulesExtended()
      const types = getExtensionEventTypes()

      expect(types).toHaveLength(3)
      expect(types).toContain('im.hula.friend_request')
      expect(types).toContain('im.hula.widget_event')
      expect(types).toContain('im.hula.ai_tool_result')
    })
  })

  describe('usage in components for filter/sort', () => {
    it('can filter events by shouldNotify', () => {
      const { shouldNotify } = usePushRulesExtended()
      const events = [
        { type: 'm.reaction' },
        { type: 'im.hula.friend_request' },
        { type: 'im.unknown.type' },
        { type: 'im.hula.widget_event' },
        { type: 'm.room.message' }
      ]

      const notifiable = events.filter((e) => shouldNotify(e.type))

      expect(notifiable.map((e) => e.type)).toEqual([
        'im.hula.friend_request',
        'im.hula.widget_event',
        'm.room.message'
      ])
    })

    it('can sort events to prioritize extension events', () => {
      const { isExtensionEvent } = usePushRulesExtended()
      const events = [{ type: 'm.room.message' }, { type: 'im.hula.friend_request' }, { type: 'm.reaction' }]

      // HuLa 扩展事件优先排前
      const sorted = [...events].sort((a, b) => {
        const aExt = isExtensionEvent(a.type) ? 0 : 1
        const bExt = isExtensionEvent(b.type) ? 0 : 1
        return aExt - bExt
      })

      expect(sorted[0].type).toBe('im.hula.friend_request')
    })
  })
})
