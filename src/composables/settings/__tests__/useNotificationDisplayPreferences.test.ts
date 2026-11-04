import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES,
  loadNotificationDisplayPreferences,
  NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY
} from '@/services/matrix/notifications/notificationDisplayPreferences'
import { useNotificationDisplayPreferences } from '../useNotificationDisplayPreferences'

function seed(patch: Record<string, unknown>) {
  localStorage.setItem(
    NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES, ...patch })
  )
}

describe('useNotificationDisplayPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('exposes the stored defaults', () => {
    const preferences = useNotificationDisplayPreferences()

    expect(preferences.contentSummary.value).toBe(true)
    expect(preferences.keywordHighlight.value).toBe(true)
    expect(preferences.keywordNotifications.value).toBe(false)
    expect(preferences.keywords.value).toEqual([])
    expect(preferences.keywordsText.value).toBe('')
    expect(preferences.priority.value).toBe('medium')
  })

  it('writes only the committed field and keeps the other end owned by the other platform', () => {
    seed({ keywordNotifications: true, keywords: ['deploy'] })
    const preferences = useNotificationDisplayPreferences()

    preferences.contentSummary.value = false

    const stored = loadNotificationDisplayPreferences()
    expect(stored.contentSummary).toBe(false)
    expect(stored.keywordNotifications).toBe(true)
    expect(stored.keywords).toEqual(['deploy'])
  })

  it('adds keywords case-insensitively and rejects duplicates or blanks', () => {
    const preferences = useNotificationDisplayPreferences()

    expect(preferences.addKeyword('  ')).toBe(false)
    expect(preferences.addKeyword('Deploy')).toBe(true)
    expect(preferences.addKeyword('deploy')).toBe(false)
    expect(preferences.addKeyword('运维')).toBe(true)

    expect(preferences.keywords.value).toEqual(['Deploy', '运维'])
    expect(loadNotificationDisplayPreferences().keywords).toEqual(['Deploy', '运维'])
  })

  it('removes a keyword and reports whether anything changed', () => {
    seed({ keywords: ['a', 'b'] })
    const preferences = useNotificationDisplayPreferences()

    expect(preferences.removeKeyword('b')).toBe(true)
    expect(preferences.removeKeyword('b')).toBe(false)
    expect(preferences.keywords.value).toEqual(['a'])
  })

  it('normalizes keyword input text before persisting', () => {
    const preferences = useNotificationDisplayPreferences()

    expect(preferences.normalizeKeywords(' deploy ,, DEPLOY ， 运维 ')).toBe('deploy, 运维')
    expect(loadNotificationDisplayPreferences().keywords).toEqual(['deploy', '运维'])
  })

  it('reload picks up values written by the other platform', () => {
    const preferences = useNotificationDisplayPreferences()
    seed({ priority: 'high' })

    preferences.reload()

    expect(preferences.priority.value).toBe('high')
  })
})
