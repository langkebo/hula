import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHistoryStore } from '../history'

describe('useHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty emoji history and tab index 0', () => {
    const store = useHistoryStore()
    expect(store.emoji).toEqual([])
    expect(store.lastEmojiTabIndex).toBe(0)
  })

  it('setEmoji replaces emoji history', () => {
    const store = useHistoryStore()
    store.setEmoji([':smile:', ':wave:'])
    expect(store.emoji).toEqual([':smile:', ':wave:'])
    store.setEmoji([':rocket:'])
    expect(store.emoji).toEqual([':rocket:'])
  })

  it('setLastEmojiTabIndex updates the tab index', () => {
    const store = useHistoryStore()
    store.setLastEmojiTabIndex(2)
    expect(store.lastEmojiTabIndex).toBe(2)
  })
})
