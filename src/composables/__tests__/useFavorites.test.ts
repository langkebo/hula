import { nextTick } from 'vue'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FAVORITES_ENDPOINT,
  createDefaultFavoritesState,
  fetchFavoritesState,
  formatFavoriteTime,
  hydrateFavoritesState,
  isFavoriteImageItem,
  isFavoriteLinkItem,
  isFavoritesState,
  removeFavoriteById,
  resetFavoritesState,
  useFavorites
} from '../useFavorites'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFavoritesState()
  })

  it('hydrates favorites from shared persisted state', () => {
    localStorage.setItem(
      'hula-favorites-state',
      JSON.stringify({
        messages: [{ id: 'm1', conversationName: '项目群', senderName: 'Alice', timestamp: 1, content: 'hello' }],
        images: [
          { id: 'i1', imageUrl: 'https://example.com/a.png', fileName: 'a.png', senderName: 'Alice', timestamp: 2 }
        ],
        links: [{ id: 'l1', title: 'Example', url: 'https://example.com', summary: 'summary' }]
      })
    )

    hydrateFavoritesState()
    const state = useFavorites()

    expect(state.favoriteMessages.value.map((item) => item.id)).toEqual(['m1'])
    expect(state.favoriteImages.value.map((item) => item.id)).toEqual(['i1'])
    expect(state.favoriteLinks.value.map((item) => item.id)).toEqual(['l1'])
  })

  it('rejects legacy persisted favorites payloads and resets to default state', () => {
    localStorage.setItem(
      'hula-favorites-state',
      JSON.stringify({
        messages: [{ id: 'm1', username: 'Alice', time: 1, content: 'hello' }],
        images: [{ id: 'i1', url: 'https://example.com/a.png' }],
        links: [{ id: 'l1', title: 'Example', url: 'https://example.com' }]
      })
    )

    hydrateFavoritesState()
    const state = useFavorites()

    expect(state.favoriteMessages.value).toEqual(createDefaultFavoritesState().messages)
    expect(state.favoriteImages.value).toEqual(createDefaultFavoritesState().images)
    expect(state.favoriteLinks.value).toEqual(createDefaultFavoritesState().links)
    expect(localStorage.getItem('hula-favorites-state')).toBeNull()
  })

  it('removes favorites and persists the latest state', async () => {
    const state = useFavorites()

    state.removeMessageFavorite('1')
    state.removeImageFavorite('2')
    state.removeLinkFavorite('1')
    await nextTick()

    const persisted = JSON.parse(localStorage.getItem('hula-favorites-state') || '{}')
    const defaults = createDefaultFavoritesState()
    expect(state.favoriteMessages.value).toHaveLength(0)
    expect(state.favoriteImages.value.map((item) => item.id)).toEqual(['1'])
    expect(state.favoriteLinks.value).toHaveLength(0)
    expect(persisted.messages).toEqual([])
    expect(persisted.images).toEqual([
      {
        ...defaults.images[0]
      }
    ])
    expect(persisted.links).toEqual([])
  })

  it('falls back to default state for invalid storage payloads', () => {
    localStorage.setItem('hula-favorites-state', '{invalid json}')

    hydrateFavoritesState()
    const state = useFavorites()

    expect(state.favoriteMessages.value).toEqual(createDefaultFavoritesState().messages)
    expect(state.favoriteImages.value).toEqual(createDefaultFavoritesState().images)
    expect(state.favoriteLinks.value).toEqual(createDefaultFavoritesState().links)
  })

  it('removes items by id through the shared helper', () => {
    expect(removeFavoriteById([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }])
  })

  it('shares list mutations across multiple consumers', async () => {
    const first = useFavorites()
    const second = useFavorites('links')

    first.removeMessageFavorite('1')
    await nextTick()

    expect(second.favoriteMessages.value).toHaveLength(0)
    expect(first.activeTab.value).toBe('messages')
    expect(second.activeTab.value).toBe('links')
  })

  it('computes totals, empty state, and generic tab-based removals', async () => {
    const state = useFavorites()

    expect(state.totalCount.value).toBe(4)
    expect(state.hasFavorites.value).toBe(true)

    state.removeFavorite('messages', '1')
    state.removeFavorite('images', '1')
    state.removeFavorite('links', '1')
    await nextTick()

    expect(state.favoriteMessages.value).toEqual([])
    expect(state.favoriteImages.value.map((item) => item.id)).toEqual(['2'])
    expect(state.favoriteLinks.value).toEqual([])
    expect(state.totalCount.value).toBe(1)
    expect(state.hasFavorites.value).toBe(true)

    state.removeFavorite('images', '2')
    await nextTick()

    expect(state.totalCount.value).toBe(0)
    expect(state.hasFavorites.value).toBe(false)
  })

  it('formats favorite timestamps as local date and HH:mm time', () => {
    const formatted = formatFavoriteTime(1714550400000)

    expect(formatted).toMatch(/\d/)
    expect(formatted).toContain(':')
  })

  it('hydrates automatically on the first consumer access', async () => {
    vi.resetModules()
    localStorage.setItem(
      'hula-favorites-state',
      JSON.stringify({
        messages: [{ id: 'boot-m1', conversationName: '启动群', senderName: 'Boot', timestamp: 9, content: 'boot' }],
        images: [],
        links: []
      })
    )

    const freshModule = await import('../useFavorites')
    const state = freshModule.useFavorites()

    expect(state.favoriteMessages.value.map((item) => item.id)).toEqual(['boot-m1'])
    expect(state.totalCount.value).toBe(1)
  })

  it('returns false for invalid strict favorite shapes', () => {
    expect(isFavoriteImageItem({ id: 'i1', imageUrl: 'https://example.com/a.png' })).toBe(false)
    expect(
      isFavoriteLinkItem({ id: 'l1', title: 'Example', url: 'https://example.com', summary: 'ok', extra: true })
    ).toBe(false)
    expect(isFavoritesState({ messages: [], images: [], links: [], extra: true })).toBe(false)
  })

  it('falls back to defaults when storage is empty on a cold start', async () => {
    vi.resetModules()
    localStorage.clear()

    const freshModule = await import('../useFavorites')
    const state = freshModule.useFavorites()

    expect(state.favoriteMessages.value).toEqual(freshModule.createDefaultFavoritesState().messages)
    expect(state.favoriteImages.value).toEqual(freshModule.createDefaultFavoritesState().images)
    expect(state.favoriteLinks.value).toEqual(freshModule.createDefaultFavoritesState().links)
  })

  it('no-ops persistence when browser storage is unavailable', async () => {
    vi.resetModules()
    const originalLocalStorage = globalThis.localStorage
    vi.stubGlobal('localStorage', undefined)

    try {
      const freshModule = await import('../useFavorites')
      const nextState = freshModule.createDefaultFavoritesState()

      expect(freshModule.hydrateFavoritesState()).toEqual(nextState)
      expect(freshModule.replaceFavoritesState(nextState)).toEqual(nextState)
    } finally {
      vi.stubGlobal('localStorage', originalLocalStorage)
    }
  })

  it('validates `/favorites` payloads with exact field names, types, and lengths', async () => {
    const expected = createDefaultFavoritesState()

    server.use(
      http.get(`http://localhost${FAVORITES_ENDPOINT}`, () => {
        return HttpResponse.json(expected)
      })
    )

    const payload = await fetchFavoritesState(`http://localhost${FAVORITES_ENDPOINT}`)

    expect(isFavoritesState(payload)).toBe(true)
    expect(payload).toEqual(expected)
    expect(Object.keys(payload)).toEqual(Object.keys(expected))

    for (const key of ['messages', 'images', 'links'] as const) {
      expect(payload[key]).toHaveLength(expected[key].length)
      payload[key].forEach((item, index) => {
        expect(Object.keys(item)).toEqual(Object.keys(expected[key][index]))
      })
    }
  })

  it('rejects `/favorites` payloads containing legacy or extra fields', async () => {
    const expected = createDefaultFavoritesState()

    server.use(
      http.get(`http://localhost${FAVORITES_ENDPOINT}`, () => {
        return HttpResponse.json({
          ...expected,
          messages: [
            {
              ...expected.messages[0],
              username: 'legacy-alice'
            }
          ]
        })
      })
    )

    await expect(fetchFavoritesState(`http://localhost${FAVORITES_ENDPOINT}`)).rejects.toThrow(
      'Invalid favorites payload'
    )
  })
})
