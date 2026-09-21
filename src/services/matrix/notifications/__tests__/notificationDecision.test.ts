import { describe, expect, it } from 'vitest'
import { classifyNotificationMessage, shouldNotify } from '../notificationDecision'

interface DecisionPreferences {
  events: Record<string, boolean> | undefined
  keywordNotifications: boolean
  keywords: readonly string[]
}

function prefs(overrides: Partial<DecisionPreferences> = {}): DecisionPreferences {
  return {
    events: undefined,
    keywordNotifications: false,
    keywords: [],
    ...overrides
  }
}

describe('classifyNotificationMessage', () => {
  it('classifies a plain mention as mention', () => {
    expect(classifyNotificationMessage({ isMention: true, isThread: false })).toBe('mention')
  })

  it('classifies a mention inside a thread as thread_mention', () => {
    expect(classifyNotificationMessage({ isMention: true, isThread: true })).toBe('thread_mention')
  })

  it('classifies everything else as keyword', () => {
    expect(classifyNotificationMessage({ isMention: false, isThread: false })).toBe('keyword')
    expect(classifyNotificationMessage({ isMention: false, isThread: true })).toBe('keyword')
  })
})

describe('shouldNotify', () => {
  it('notifies for a plain mention regardless of the other switches', () => {
    expect(shouldNotify({ isMention: true, isThread: false, body: 'hi' }, prefs())).toBe(true)
    expect(
      shouldNotify(
        { isMention: true, isThread: false, body: 'hi' },
        prefs({ events: { thread_mention: false }, keywordNotifications: false, keywords: [] })
      )
    ).toBe(true)
  })

  it('notifies for a thread mention when the switch is absent (field default is enabled)', () => {
    expect(shouldNotify({ isMention: true, isThread: true, body: 'hi' }, prefs())).toBe(true)
    expect(shouldNotify({ isMention: true, isThread: true, body: 'hi' }, prefs({ events: {} }))).toBe(true)
  })

  it('notifies for a thread mention when the switch is explicitly on', () => {
    expect(
      shouldNotify({ isMention: true, isThread: true, body: 'hi' }, prefs({ events: { thread_mention: true } }))
    ).toBe(true)
  })

  it('stays silent for a thread mention when the switch is off', () => {
    expect(
      shouldNotify({ isMention: true, isThread: true, body: 'hi' }, prefs({ events: { thread_mention: false } }))
    ).toBe(false)
  })

  it('stays silent for a non-mention threaded reply under the default preferences', () => {
    // 回归：默认配置下，线程回复只要没提及当前用户，就必须走关键词门，不得被 thread_mention 开关放行
    expect(shouldNotify({ isMention: false, isThread: true, body: 'threaded reply' }, prefs())).toBe(false)
    expect(shouldNotify({ isMention: false, isThread: true, body: 'threaded reply' }, prefs({ events: {} }))).toBe(
      false
    )
  })

  it('cannot be unlocked by the thread switch alone when there is no mention', () => {
    expect(
      shouldNotify(
        { isMention: false, isThread: true, body: 'threaded reply' },
        prefs({ events: { thread_mention: true }, keywordNotifications: false, keywords: ['deploy'] })
      )
    ).toBe(false)
  })

  it('applies the keyword gate to non-mention threaded replies too', () => {
    expect(
      shouldNotify(
        { isMention: false, isThread: true, body: 'the deploy is green' },
        prefs({ keywordNotifications: true, keywords: ['deploy'] })
      )
    ).toBe(true)
    expect(
      shouldNotify(
        { isMention: false, isThread: true, body: 'the deploy is green' },
        prefs({ keywordNotifications: true, keywords: ['incident'] })
      )
    ).toBe(false)
  })

  it('stays silent for a keyword hit while keyword notifications are off (default)', () => {
    expect(
      shouldNotify(
        { isMention: false, isThread: false, body: 'the deploy is green' },
        prefs({ keywordNotifications: false, keywords: ['deploy'] })
      )
    ).toBe(false)
  })

  it('notifies for a keyword hit once keyword notifications are on', () => {
    expect(
      shouldNotify(
        { isMention: false, isThread: false, body: 'the deploy is green' },
        prefs({ keywordNotifications: true, keywords: ['deploy'] })
      )
    ).toBe(true)
  })

  it('stays silent when the keyword list is empty even with the switch on', () => {
    expect(
      shouldNotify(
        { isMention: false, isThread: false, body: 'the deploy is green' },
        prefs({ keywordNotifications: true, keywords: [] })
      )
    ).toBe(false)
  })

  it('stays silent when the body misses every keyword', () => {
    expect(
      shouldNotify(
        { isMention: false, isThread: false, body: 'the deploy is green' },
        prefs({ keywordNotifications: true, keywords: ['incident'] })
      )
    ).toBe(false)
  })
})
