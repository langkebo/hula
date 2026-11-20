import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/services/matrix/MatrixSearchService', () => ({
  matrixSearchService: {
    searchRoomMessages: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

import { makeSearchResult, makeSearchRoomMessagesResponse } from '@/services/matrix/__tests__/fixtures/search'
import type { SearchResult } from '@/services/matrix/MatrixSearchService'
import { matrixSearchService } from '@/services/matrix/MatrixSearchService'
import { useRoomSearch } from '../useRoomSearch'

const makeHit = (eventId: string, body = 'match'): SearchResult =>
  makeSearchResult({ eventId, content: { body, msgtype: 'm.text' } })

describe('useRoomSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(matrixSearchService.searchRoomMessages).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('open/close', () => {
    it('opens the panel and closes it while resetting state', () => {
      const roomId = ref('!room:example.com')
      const { isOpen, query, results, activeIndex, openSearch, closeSearch } = useRoomSearch(roomId)

      expect(isOpen.value).toBe(false)
      openSearch()
      expect(isOpen.value).toBe(true)

      query.value = 'hello'
      results.value = [makeHit('$1')]
      activeIndex.value = 2

      closeSearch()
      expect(isOpen.value).toBe(false)
      expect(query.value).toBe('')
      expect(results.value).toEqual([])
      expect(activeIndex.value).toBe(-1)
    })
  })

  describe('query input -> debounced search', () => {
    it('does not call the service for a blank query', () => {
      const roomId = ref('!room:example.com')
      const { query, onQueryInput, results } = useRoomSearch(roomId)

      query.value = '   '
      onQueryInput()
      vi.advanceTimersByTime(300)

      expect(matrixSearchService.searchRoomMessages).not.toHaveBeenCalled()
      expect(results.value).toEqual([])
    })

    it('triggers search after debounce and fills results, setting activeIndex to 0', async () => {
      vi.mocked(matrixSearchService.searchRoomMessages).mockResolvedValue({
        results: [makeHit('$1'), makeHit('$2')],
        count: 2,
        highlights: ['match']
      })
      const roomId = ref('!room:example.com')
      const { query, results, loading, activeIndex, onQueryInput } = useRoomSearch(roomId)

      query.value = 'match'
      onQueryInput()

      // Before debounce elapses, no call yet
      expect(matrixSearchService.searchRoomMessages).not.toHaveBeenCalled()

      vi.advanceTimersByTime(300)
      // performSearch is now running; loading turned on before the awaited call
      expect(loading.value).toBe(true)

      await vi.runAllTicks()

      expect(matrixSearchService.searchRoomMessages).toHaveBeenCalledWith('!room:example.com', 'match')
      expect(results.value.length).toBe(2)
      expect(results.value[0]?.eventId).toBe('$1')
      expect(activeIndex.value).toBe(0)
      expect(loading.value).toBe(false)
    })

    it('debounces rapid input to a single trailing search', async () => {
      vi.mocked(matrixSearchService.searchRoomMessages).mockResolvedValue({
        results: [],
        count: 0,
        highlights: []
      })
      const roomId = ref('!room:example.com')
      const { query, onQueryInput } = useRoomSearch(roomId)

      query.value = 'a'
      onQueryInput()
      vi.advanceTimersByTime(150)
      query.value = 'ab'
      onQueryInput()
      vi.advanceTimersByTime(150)
      query.value = 'abc'
      onQueryInput()
      vi.advanceTimersByTime(300)
      await vi.runAllTicks()

      expect(matrixSearchService.searchRoomMessages).toHaveBeenCalledTimes(1)
      expect(matrixSearchService.searchRoomMessages).toHaveBeenCalledWith('!room:example.com', 'abc')
    })

    it('resets results and loading on error', async () => {
      vi.mocked(matrixSearchService.searchRoomMessages).mockRejectedValue(new Error('boom'))
      const roomId = ref('!room:example.com')
      const { query, results, loading, onQueryInput } = useRoomSearch(roomId)

      query.value = 'match'
      onQueryInput()
      vi.advanceTimersByTime(300)
      await vi.runAllTicks()

      expect(results.value).toEqual([])
      expect(loading.value).toBe(false)
    })

    it('marks error state on failure and retry re-runs the search', async () => {
      vi.mocked(matrixSearchService.searchRoomMessages).mockRejectedValueOnce(new Error('boom'))
      const roomId = ref('!room:example.com')
      const { query, error, retry, performSearch } = useRoomSearch(roomId)

      query.value = 'match'
      await performSearch()

      expect(error.value).toBe(true)

      vi.mocked(matrixSearchService.searchRoomMessages).mockResolvedValueOnce(
        makeSearchRoomMessagesResponse([makeHit('$1')])
      )
      retry()
      await vi.runAllTicks()

      expect(error.value).toBe(false)
      expect(matrixSearchService.searchRoomMessages).toHaveBeenCalledTimes(2)
    })

    it('discards stale responses when a newer request has started', async () => {
      let resolveFirst: (value: { results: SearchResult[]; count: number; highlights: string[] }) => void = () => {}
      vi.mocked(matrixSearchService.searchRoomMessages)
        .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce(makeSearchRoomMessagesResponse([makeHit('$new', 'new')]))

      const roomId = ref('!room:example.com')
      const { query, results, performSearch, error } = useRoomSearch(roomId)

      query.value = 'old'
      const first = performSearch()
      query.value = 'new'
      await performSearch()

      resolveFirst({ results: [makeHit('$old', 'old')], count: 1, highlights: [] })
      await first

      expect(results.value.map((item) => item.eventId)).toEqual(['$new'])
      expect(error.value).toBe(false)
    })
  })

  describe('navigation', () => {
    it('navigateNext/navigatePrev move activeIndex within bounds', () => {
      const roomId = ref('!room:example.com')
      const { results, activeIndex, navigateNext, navigatePrev } = useRoomSearch(roomId)

      results.value = [makeHit('$1'), makeHit('$2'), makeHit('$3')]
      activeIndex.value = 0

      navigateNext()
      expect(activeIndex.value).toBe(1)
      navigateNext()
      expect(activeIndex.value).toBe(2)
      navigateNext() // clamp at last
      expect(activeIndex.value).toBe(2)

      navigatePrev()
      expect(activeIndex.value).toBe(1)
      navigatePrev()
      expect(activeIndex.value).toBe(0)
      navigatePrev() // clamp at 0
      expect(activeIndex.value).toBe(0)
    })

    it('selectResult sets activeIndex and returns the chosen result', () => {
      const roomId = ref('!room:example.com')
      const { results, activeIndex, selectResult } = useRoomSearch(roomId)

      results.value = [makeHit('$1'), makeHit('$2')]
      const picked = selectResult(1)

      expect(activeIndex.value).toBe(1)
      expect(picked?.eventId).toBe('$2')
    })
  })
})
