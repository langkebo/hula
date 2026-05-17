import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'

describe('useSearchFeedbackSummary', () => {
  it('returns searching text while the search is pending', () => {
    const searchValue = ref('ali')
    const appliedSearchValue = ref('')
    const isSearching = ref(true)

    const { showSummary, showClearAction, summaryText } = useSearchFeedbackSummary({
      searchValue,
      appliedSearchValue,
      isSearching,
      searchingText: 'searching',
      getIdleSummaryText: () => 'done'
    })

    expect(showSummary.value).toBe(true)
    expect(showClearAction.value).toBe(true)
    expect(summaryText.value).toBe('searching')
  })

  it('uses idle summary and empty description after search settles', () => {
    const searchValue = ref('alice')
    const appliedSearchValue = ref('alice')

    const { hasSearchKeyword, summaryText, emptyDescription } = useSearchFeedbackSummary({
      searchValue,
      appliedSearchValue,
      getIdleSummaryText: () => '1 match',
      getEmptyDescription: () => 'No matches'
    })

    expect(hasSearchKeyword.value).toBe(true)
    expect(summaryText.value).toBe('1 match')
    expect(emptyDescription.value).toBe('No matches')
  })

  it('supports custom summary and clear visibility conditions', () => {
    const searchValue = ref('')
    const appliedSearchValue = ref('')
    const filterActive = ref(true)

    const { showSummary, showClearAction, summaryText } = useSearchFeedbackSummary({
      searchValue,
      appliedSearchValue,
      showSummaryWhen: computed(() => filterActive.value),
      showClearActionWhen: computed(() => filterActive.value),
      getIdleSummaryText: () => 'filtered results'
    })

    expect(showSummary.value).toBe(true)
    expect(showClearAction.value).toBe(true)
    expect(summaryText.value).toBe('filtered results')
  })

  it('announces searching, results and empty states through live region callback', async () => {
    const searchValue = ref('')
    const appliedSearchValue = ref('')
    const isSearching = ref(false)
    const resultCount = ref<number | null>(null)
    const announce = vi.fn()

    useSearchFeedbackSummary({
      searchValue,
      appliedSearchValue,
      isSearching,
      resultCount,
      searchingText: 'searching',
      announce,
      getIdleSummaryText: () => `results:${resultCount.value ?? 'none'}`,
      getResultAnnouncementText: () => `results:${resultCount.value ?? 'none'}`,
      getEmptyAnnouncementText: () => 'empty'
    })

    searchValue.value = 'alice'
    isSearching.value = true
    await nextTick()

    expect(announce).toHaveBeenCalledWith('searching', 'polite')

    appliedSearchValue.value = 'alice'
    isSearching.value = false
    resultCount.value = 2
    await nextTick()

    expect(announce).toHaveBeenCalledWith('results:2', 'polite')

    resultCount.value = 0
    await nextTick()

    expect(announce).toHaveBeenCalledWith('empty', 'polite')
  })
})
