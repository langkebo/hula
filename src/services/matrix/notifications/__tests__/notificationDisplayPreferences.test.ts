import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES,
  formatNotificationKeywords,
  isNotificationPriority,
  loadNotificationDisplayPreferences,
  matchesNotificationKeyword,
  materializeNotificationContent,
  NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY,
  type NotificationDisplayPreferences,
  normalizeNotificationDisplayPreferences,
  parseNotificationKeywords,
  saveNotificationDisplayPreferences
} from '../notificationDisplayPreferences'

function prefs(overrides: Partial<NotificationDisplayPreferences> = {}): NotificationDisplayPreferences {
  return { ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES, ...overrides }
}

describe('parseNotificationKeywords', () => {
  it('splits on ascii and full-width commas and newlines', () => {
    expect(parseNotificationKeywords('release, deploy，运维\noncall')).toEqual(['release', 'deploy', '运维', 'oncall'])
  })

  it('trims whitespace and drops empty pieces', () => {
    expect(parseNotificationKeywords('  a ,, b ,   ')).toEqual(['a', 'b'])
  })

  it('dedupes case-insensitively while keeping the first spelling', () => {
    expect(parseNotificationKeywords('Deploy, deploy, DEPLOY')).toEqual(['Deploy'])
  })

  it('returns an empty list for non-string input', () => {
    expect(parseNotificationKeywords(undefined as unknown as string)).toEqual([])
  })
})

describe('formatNotificationKeywords', () => {
  it('round-trips through parseNotificationKeywords', () => {
    const keywords = parseNotificationKeywords(formatNotificationKeywords(['release', '运维']))
    expect(keywords).toEqual(['release', '运维'])
  })

  it('renders an empty string for no keywords', () => {
    expect(formatNotificationKeywords([])).toBe('')
  })
})

describe('matchesNotificationKeyword', () => {
  it('matches case-insensitively', () => {
    expect(matchesNotificationKeyword('Deploy finished', ['deploy'])).toBe(true)
  })

  it('matches CJK substrings without case folding', () => {
    expect(matchesNotificationKeyword('线上故障已恢复', ['故障'])).toBe(true)
  })

  it('does not match when there are no keywords', () => {
    expect(matchesNotificationKeyword('anything', [])).toBe(false)
  })

  it('ignores blank keywords instead of matching everything', () => {
    expect(matchesNotificationKeyword('anything', ['', '   '])).toBe(false)
  })

  it('returns false for empty body', () => {
    expect(matchesNotificationKeyword('', ['deploy'])).toBe(false)
  })
})

describe('isNotificationPriority', () => {
  it('accepts the three priorities', () => {
    expect(isNotificationPriority('low')).toBe(true)
    expect(isNotificationPriority('medium')).toBe(true)
    expect(isNotificationPriority('high')).toBe(true)
  })

  it('rejects unknown and non-string values', () => {
    expect(isNotificationPriority('urgent')).toBe(false)
    expect(isNotificationPriority(1)).toBe(false)
    expect(isNotificationPriority(undefined)).toBe(false)
  })
})

describe('normalizeNotificationDisplayPreferences', () => {
  it('falls back to defaults for non-object input', () => {
    expect(normalizeNotificationDisplayPreferences(null)).toEqual(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES)
    expect(normalizeNotificationDisplayPreferences('nope')).toEqual(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES)
  })

  it('replaces an unknown priority with the default', () => {
    expect(normalizeNotificationDisplayPreferences({ priority: 'urgent' }).priority).toBe('medium')
  })

  it('drops non-string keyword entries', () => {
    expect(normalizeNotificationDisplayPreferences({ keywords: ['ok', 7, null] }).keywords).toEqual(['ok'])
  })

  it('keeps valid partial input', () => {
    const result = normalizeNotificationDisplayPreferences({ contentSummary: false, priority: 'low' })
    expect(result.contentSummary).toBe(false)
    expect(result.priority).toBe('low')
    expect(result.keywordHighlight).toBe(true)
  })
})

describe('load / save round trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is stored', () => {
    expect(loadNotificationDisplayPreferences()).toEqual(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES)
  })

  it('persists and restores preferences', () => {
    const saved = prefs({ contentSummary: false, keywordHighlight: false, keywords: ['deploy'], priority: 'high' })
    saveNotificationDisplayPreferences(saved)
    expect(loadNotificationDisplayPreferences()).toEqual(saved)
  })

  it('writes under the documented storage key', () => {
    saveNotificationDisplayPreferences(prefs({ priority: 'low' }))
    expect(localStorage.getItem(NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY)).toBeTruthy()
  })

  it('recovers from corrupt JSON', () => {
    localStorage.setItem(NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY, '{not json')
    expect(loadNotificationDisplayPreferences()).toEqual(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES)
  })

  it('recovers when the stored value is an array', () => {
    localStorage.setItem(NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY, '[1,2,3]')
    expect(loadNotificationDisplayPreferences()).toEqual(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES)
  })

  it('tolerates a storage that throws on read', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      }
    } as unknown as Pick<Storage, 'getItem'>
    expect(loadNotificationDisplayPreferences(throwing)).toEqual(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES)
  })

  it('tolerates a storage that throws on write', () => {
    const throwing = {
      setItem: () => {
        throw new Error('quota')
      }
    } as unknown as Pick<Storage, 'setItem'>
    expect(() => saveNotificationDisplayPreferences(prefs(), throwing)).not.toThrow()
  })

  it('normalizes before writing', () => {
    saveNotificationDisplayPreferences({ ...prefs(), priority: 'bogus' as never })
    expect(loadNotificationDisplayPreferences().priority).toBe('medium')
  })
})

describe('keywordNotifications', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to false so non-mention messages keep the pre-migration behaviour', () => {
    expect(DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES.keywordNotifications).toBe(false)
    expect(loadNotificationDisplayPreferences().keywordNotifications).toBe(false)
  })

  it('normalizes a non-boolean value back to the default', () => {
    expect(normalizeNotificationDisplayPreferences({ keywordNotifications: 'yes' }).keywordNotifications).toBe(false)
  })

  it('keeps an explicit true', () => {
    expect(normalizeNotificationDisplayPreferences({ keywordNotifications: true }).keywordNotifications).toBe(true)
  })

  it('round-trips through save / load', () => {
    saveNotificationDisplayPreferences(prefs({ keywordNotifications: true, keywords: ['deploy'] }))
    const loaded = loadNotificationDisplayPreferences()
    expect(loaded.keywordNotifications).toBe(true)
    expect(loaded.keywords).toEqual(['deploy'])
  })
})

describe('legacy keyword preference migration', () => {
  const LEGACY_KEYWORD_TOGGLE = 'tjg-keyword-notification'
  const LEGACY_KEYWORDS = 'tjg-keywords'

  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates the legacy toggle and keyword list into the display preferences store', () => {
    localStorage.setItem(LEGACY_KEYWORD_TOGGLE, 'true')
    localStorage.setItem(LEGACY_KEYWORDS, JSON.stringify(['deploy', '运维']))

    const loaded = loadNotificationDisplayPreferences()

    expect(loaded.keywordNotifications).toBe(true)
    expect(loaded.keywords).toEqual(['deploy', '运维'])
    expect(localStorage.getItem(LEGACY_KEYWORD_TOGGLE)).toBeNull()
    expect(localStorage.getItem(LEGACY_KEYWORDS)).toBeNull()
    // 迁移结果落盘后再次读取仍一致（幂等）
    expect(loadNotificationDisplayPreferences()).toEqual(loaded)
  })

  it('keeps the new value when it already exists (new value wins over legacy)', () => {
    saveNotificationDisplayPreferences(prefs({ keywordNotifications: false, keywords: ['new'] }))
    localStorage.setItem(LEGACY_KEYWORD_TOGGLE, 'true')
    localStorage.setItem(LEGACY_KEYWORDS, JSON.stringify(['legacy']))

    const loaded = loadNotificationDisplayPreferences()

    expect(loaded.keywordNotifications).toBe(false)
    expect(loaded.keywords).toEqual(['new'])
  })

  it('does not resurrect a migrated legacy value after a later save', () => {
    localStorage.setItem(LEGACY_KEYWORD_TOGGLE, 'true')
    loadNotificationDisplayPreferences()
    saveNotificationDisplayPreferences(prefs({ keywordNotifications: false }))

    expect(loadNotificationDisplayPreferences().keywordNotifications).toBe(false)
  })

  it('tolerates a corrupt legacy keyword list instead of throwing', () => {
    localStorage.setItem(LEGACY_KEYWORDS, '{not json')
    expect(loadNotificationDisplayPreferences().keywords).toEqual([])
    expect(localStorage.getItem(LEGACY_KEYWORDS)).toBeNull()
  })

  it('drops non-string entries from the legacy keyword list', () => {
    localStorage.setItem(LEGACY_KEYWORDS, JSON.stringify(['ok', 7, null]))
    expect(loadNotificationDisplayPreferences().keywords).toEqual(['ok'])
  })

  it('ignores a legacy toggle that is neither true nor false', () => {
    localStorage.setItem(LEGACY_KEYWORD_TOGGLE, 'maybe')
    expect(loadNotificationDisplayPreferences().keywordNotifications).toBe(false)
  })

  it('does not write to a read-only storage while migrating', () => {
    const readOnly = {
      getItem: (key: string) => (key === LEGACY_KEYWORD_TOGGLE ? 'true' : null)
    } as unknown as Pick<Storage, 'getItem'>

    const loaded = loadNotificationDisplayPreferences(readOnly)

    expect(loaded.keywordNotifications).toBe(true)
  })
})

describe('materializeNotificationContent', () => {
  const input = { title: 'Re: deploy', body: 'the deploy is green' }

  it('shows the body when summary is on and priority is medium', () => {
    const decision = materializeNotificationContent(input, prefs({ contentSummary: true }))
    expect(decision.contentVisible).toBe(true)
    expect(decision.body).toBe(input.body)
    expect(decision.title).toBe(input.title)
  })

  it('hides the body when summary is off and priority is medium', () => {
    const decision = materializeNotificationContent(input, prefs({ contentSummary: false }))
    expect(decision.contentVisible).toBe(false)
  })

  it('lets high priority override a disabled summary', () => {
    const decision = materializeNotificationContent(input, prefs({ contentSummary: false, priority: 'high' }))
    expect(decision.contentVisible).toBe(true)
  })

  it('lets low priority override an enabled summary', () => {
    const decision = materializeNotificationContent(input, prefs({ contentSummary: true, priority: 'low' }))
    expect(decision.contentVisible).toBe(false)
  })

  it('marks keyword hits as highlighted when the toggle is on', () => {
    const decision = materializeNotificationContent(input, prefs({ keywords: ['deploy'], keywordHighlight: true }))
    expect(decision.highlighted).toBe(true)
  })

  it('does not mark hits when the keyword toggle is off', () => {
    const decision = materializeNotificationContent(input, prefs({ keywords: ['deploy'], keywordHighlight: false }))
    expect(decision.highlighted).toBe(false)
  })

  it('does not leak keyword matches while the body is hidden', () => {
    const decision = materializeNotificationContent(
      input,
      prefs({ contentSummary: false, keywords: ['deploy'], keywordHighlight: true })
    )
    expect(decision.contentVisible).toBe(false)
    expect(decision.highlighted).toBe(false)
  })

  it('does not highlight on a miss', () => {
    const decision = materializeNotificationContent(input, prefs({ keywords: ['incident'] }))
    expect(decision.highlighted).toBe(false)
  })

  it('normalizes a malformed preferences object instead of throwing', () => {
    const decision = materializeNotificationContent(input, { priority: 'nope' } as never)
    expect(decision.contentVisible).toBe(true)
  })
})
