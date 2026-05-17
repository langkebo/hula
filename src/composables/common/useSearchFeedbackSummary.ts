import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'
import type { AriaLivePoliteness } from './useAriaLive'

interface UseSearchFeedbackSummaryOptions {
  searchValue: MaybeRefOrGetter<string>
  appliedSearchValue: MaybeRefOrGetter<string>
  isSearching?: MaybeRefOrGetter<boolean>
  resultCount?: MaybeRefOrGetter<number | null | undefined>
  showSummaryWhen?: MaybeRefOrGetter<boolean>
  showClearActionWhen?: MaybeRefOrGetter<boolean>
  searchingText?: MaybeRefOrGetter<string>
  getIdleSummaryText: () => string
  getEmptyDescription?: () => string
  getResultAnnouncementText?: () => string
  getEmptyAnnouncementText?: () => string
  announce?: (text: string, politeness?: AriaLivePoliteness) => void
  announcementWhen?: MaybeRefOrGetter<boolean>
  announcementPoliteness?: MaybeRefOrGetter<AriaLivePoliteness>
}

export const useSearchFeedbackSummary = (options: UseSearchFeedbackSummaryOptions) => {
  const hasSearchKeyword = computed(() => toValue(options.appliedSearchValue).trim().length > 0)
  const hasTypedValue = computed(() => toValue(options.searchValue).trim().length > 0)
  const isSearching = computed(() => Boolean(options.isSearching ? toValue(options.isSearching) : false))
  const resultCount = computed(() => (options.resultCount ? toValue(options.resultCount) : undefined))

  const showSummary = computed(() =>
    options.showSummaryWhen ? Boolean(toValue(options.showSummaryWhen)) : isSearching.value || hasSearchKeyword.value
  )

  const showClearAction = computed(() =>
    options.showClearActionWhen
      ? Boolean(toValue(options.showClearActionWhen))
      : hasTypedValue.value || hasSearchKeyword.value
  )

  const summaryText = computed(() => {
    if (isSearching.value) {
      return options.searchingText ? toValue(options.searchingText) : ''
    }

    return options.getIdleSummaryText()
  })

  const emptyDescription = computed(() => options.getEmptyDescription?.() ?? '')
  const shouldAnnounce = computed(() =>
    options.announcementWhen ? Boolean(toValue(options.announcementWhen)) : isSearching.value || hasSearchKeyword.value
  )
  const announcementText = computed(() => {
    if (!shouldAnnounce.value) {
      return ''
    }

    if (isSearching.value) {
      return options.searchingText ? toValue(options.searchingText) : ''
    }

    if (typeof resultCount.value === 'number') {
      if (resultCount.value <= 0) {
        return options.getEmptyAnnouncementText?.() ?? emptyDescription.value
      }

      return options.getResultAnnouncementText?.() ?? summaryText.value
    }

    return options.getResultAnnouncementText?.() ?? summaryText.value
  })
  const lastAnnouncementText = ref('')

  watch(announcementText, (value) => {
    if (!options.announce || !value || value === lastAnnouncementText.value) {
      return
    }

    lastAnnouncementText.value = value
    options.announce(value, options.announcementPoliteness ? toValue(options.announcementPoliteness) : 'polite')
  })

  watch(shouldAnnounce, (value) => {
    if (!value) {
      lastAnnouncementText.value = ''
    }
  })

  return {
    hasSearchKeyword,
    isSearching,
    showSummary,
    showClearAction,
    summaryText,
    emptyDescription,
    announcementText
  }
}
