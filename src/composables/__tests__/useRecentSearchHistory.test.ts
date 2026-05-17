import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'

describe('useRecentSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('deduplicates values and keeps the latest term first', () => {
    const { historyValues, rememberTerm } = useRecentSearchHistory('recent-search-test')

    rememberTerm('Alice')
    rememberTerm('Bob')
    rememberTerm('alice')

    expect(historyValues.value).toEqual(['alice', 'Bob'])
  })

  it('drops expired records when reading history', () => {
    const now = new Date('2026-05-16T12:00:00.000Z')
    vi.setSystemTime(now)

    localStorage.setItem(
      'recent-search-expiry',
      JSON.stringify([
        { value: 'recent', updatedAt: now.getTime() },
        { value: 'expired', updatedAt: now.getTime() - 31 * 24 * 60 * 60 * 1000 }
      ])
    )

    const { historyValues } = useRecentSearchHistory('recent-search-expiry')
    expect(historyValues.value).toEqual(['recent'])
  })

  it('clears local storage when clearHistory is called', () => {
    const { rememberTerm, clearHistory, historyValues } = useRecentSearchHistory('recent-search-clear')

    rememberTerm('Alice')
    clearHistory()

    expect(historyValues.value).toEqual([])
    expect(localStorage.getItem('recent-search-clear')).toBeNull()
  })
})
