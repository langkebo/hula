import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { type SearchResultItem, useSpotlightStore } from '../spotlight'

describe('useSpotlightStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', () => {
    const store = useSpotlightStore()
    expect(store.query).toBe('')
    expect(store.isSearching).toBe(false)
    expect(store.results).toEqual([])
    expect(store.recentSearches).toEqual([])
    expect(store.filters).toEqual({})
    expect(store.activeResult).toBeNull()
  })

  it('sets and retrieves query', () => {
    const store = useSpotlightStore()
    store.setQuery('test query')
    expect(store.query).toBe('test query')
  })

  it('sets searching state', () => {
    const store = useSpotlightStore()
    store.setSearching(true)
    expect(store.isSearching).toBe(true)
  })

  it('sets results and computes hasResults', () => {
    const store = useSpotlightStore()
    const results: SearchResultItem[] = [{ type: 'room', roomId: '!abc:example.com', name: 'Test Room' }]
    store.setResults(results)
    expect(store.results).toEqual(results)
    expect(store.hasResults).toBe(true)
  })

  it('filters results by type', () => {
    const store = useSpotlightStore()
    const results: SearchResultItem[] = [
      { type: 'room', roomId: '!abc:example.com' },
      { type: 'message', eventId: '$msg1' },
      { type: 'user', userId: '@alice:example.com' },
      { type: 'message', eventId: '$msg2' }
    ]
    store.setResults(results)
    expect(store.roomResults).toHaveLength(1)
    expect(store.messageResults).toHaveLength(2)
    expect(store.userResults).toHaveLength(1)
  })

  it('adds recent search to the beginning', () => {
    const store = useSpotlightStore()
    store.addRecentSearch('first')
    store.addRecentSearch('second')
    expect(store.recentSearches).toEqual(['second', 'first'])
  })

  it('ignores duplicate recent searches', () => {
    const store = useSpotlightStore()
    store.addRecentSearch('test')
    store.addRecentSearch('test')
    expect(store.recentSearches).toEqual(['test'])
  })

  it('ignores empty recent searches', () => {
    const store = useSpotlightStore()
    store.addRecentSearch('  ')
    expect(store.recentSearches).toEqual([])
  })

  it('limits recent searches to 10 items', () => {
    const store = useSpotlightStore()
    for (let i = 0; i < 12; i++) {
      store.addRecentSearch(`search${i}`)
    }
    expect(store.recentSearches).toHaveLength(10)
    expect(store.recentSearches[0]).toBe('search11')
    expect(store.recentSearches[9]).toBe('search2')
  })

  it('clears recent searches', () => {
    const store = useSpotlightStore()
    store.addRecentSearch('test')
    store.clearRecentSearches()
    expect(store.recentSearches).toEqual([])
  })

  it('sets and clears filters', () => {
    const store = useSpotlightStore()
    store.setFilter('roomIds', ['!abc:example.com'])
    store.setFilter('hasMedia', true)
    expect(store.filters).toEqual({ roomIds: ['!abc:example.com'], hasMedia: true })
    store.clearFilters()
    expect(store.filters).toEqual({})
  })

  it('sets and clears active result', () => {
    const store = useSpotlightStore()
    const result: SearchResultItem = { type: 'room', roomId: '!abc:example.com' }
    store.setActiveResult(result)
    expect(store.activeResult).toEqual(result)
    store.clearActiveResult()
    expect(store.activeResult).toBeNull()
  })

  it('clears all state', () => {
    const store = useSpotlightStore()
    store.setQuery('test')
    store.setSearching(true)
    store.setResults([{ type: 'room', roomId: '!abc:example.com' }])
    store.setActiveResult({ type: 'room', roomId: '!abc:example.com' })
    store.clear()
    expect(store.query).toBe('')
    expect(store.isSearching).toBe(false)
    expect(store.results).toEqual([])
    expect(store.activeResult).toBeNull()
  })
})
