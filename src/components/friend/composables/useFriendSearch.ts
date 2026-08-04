import { type ComputedRef, computed, type MaybeRefOrGetter, type Ref, ref, toValue, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import type { FriendStatus } from '@/types/matrix-services'

const FRIEND_SEARCH_HISTORY_STORAGE_KEY = 'tjg-friend-search-history'

interface UseFriendSearchOptions {
  /** 已应用筛选（不含搜索关键词）的好友列表，来自 useFriendFilters */
  filteredFriends: ComputedRef<MatrixContact[]>
  /** 当前筛选状态，来自 useFriendFilters */
  currentFilter: ComputedRef<FriendStatus | 'all'> | Ref<FriendStatus | 'all'>
  /** 视图级状态面板是否显示（capability/error），来自 FriendListView */
  showStatePanel: MaybeRefOrGetter<boolean>
}

/**
 * 好友搜索 Composable
 *
 * 负责：
 * - 搜索输入与应用（searchValue / appliedSearchValue / isSearchPending）
 * - 搜索历史（useRecentSearchHistory）
 * - 在已筛选列表上叠加搜索过滤，产出 displayedFriends
 * - 搜索反馈摘要（useSearchFeedbackSummary：showSearchSummary / searchSummaryText / showSearchClearAction）
 * - 搜索空状态描述（searchEmptyDescription）
 */
export function useFriendSearch({ filteredFriends, currentFilter, showStatePanel }: UseFriendSearchOptions) {
  const { t } = useI18n()
  const { announce } = useAriaLive()
  const contactStore = useContactStore()

  const {
    historyValues: searchHistory,
    rememberTerm,
    clearHistory: clearSearchHistory
  } = useRecentSearchHistory(FRIEND_SEARCH_HISTORY_STORAGE_KEY)

  const searchValue = ref('')
  const appliedSearchValue = ref('')
  const isSearchPending = ref(false)

  const hasSearchKeyword = computed(() => appliedSearchValue.value.trim().length > 0)

  const isLoading = computed(() => contactStore.isLoading)

  const showSearchHistory = computed(
    () => !isLoading.value && !toValue(showStatePanel) && !searchValue.value.trim() && searchHistory.value.length > 0
  )

  // 在已筛选列表上叠加搜索关键词过滤，产出最终展示列表
  const displayedFriends = computed<MatrixContact[]>(() => {
    if (!appliedSearchValue.value.trim()) {
      return filteredFriends.value
    }

    const query = appliedSearchValue.value.toLowerCase()
    return filteredFriends.value.filter(
      (f) =>
        f.userId.toLowerCase().includes(query) ||
        f.displayName?.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query) ||
        f.remark?.toLowerCase().includes(query)
    )
  })

  const applySearch = (value: string, options?: { remember?: boolean }) => {
    const normalizedValue = value.trim()
    appliedSearchValue.value = normalizedValue
    isSearchPending.value = false

    if (options?.remember !== false) {
      rememberTerm(normalizedValue)
    }
  }

  const handleSearch = (value: string) => {
    applySearch(value)
  }

  const handleSelectSearchHistory = (value: string) => {
    searchValue.value = value
    applySearch(value)
  }

  const handleClearSearchHistory = () => {
    clearSearchHistory()
  }

  const handleClearActiveSearch = () => {
    searchValue.value = ''
    appliedSearchValue.value = ''
    isSearchPending.value = false
  }

  watch(searchValue, (value) => {
    isSearchPending.value = value.trim() !== appliedSearchValue.value.trim()
  })

  const {
    showSummary: showSearchSummary,
    showClearAction: showSearchClearAction,
    summaryText: searchSummaryText,
    emptyDescription: searchEmptyDescription
  } = useSearchFeedbackSummary({
    searchValue,
    appliedSearchValue,
    isSearching: isSearchPending,
    resultCount: () => displayedFriends.value.length,
    showSummaryWhen: () =>
      !toValue(showStatePanel) && (isSearchPending.value || hasSearchKeyword.value || currentFilter.value !== 'all'),
    showClearActionWhen: () => Boolean(searchValue.value || currentFilter.value !== 'all'),
    searchingText: () => t('friend.search.searching'),
    announce,
    getIdleSummaryText: () => {
      if (hasSearchKeyword.value) {
        return t('friend.search.result_count', {
          count: displayedFriends.value.length,
          keyword: appliedSearchValue.value
        })
      }

      if (currentFilter.value !== 'all') {
        return t('friend.search.filter_result_count', {
          count: displayedFriends.value.length,
          filter: t(`friend.filter.${currentFilter.value}`)
        })
      }

      return ''
    },
    getResultAnnouncementText: () =>
      t('friend.search.result_count', {
        count: displayedFriends.value.length,
        keyword: appliedSearchValue.value
      }),
    getEmptyAnnouncementText: () =>
      t('friend.search.empty_description', {
        keyword: appliedSearchValue.value
      }),
    getEmptyDescription: () =>
      t('friend.search.empty_description', {
        keyword: appliedSearchValue.value
      })
  })

  return {
    searchValue,
    appliedSearchValue,
    isSearchPending,
    hasSearchKeyword,
    showSearchHistory,
    searchHistory,
    displayedFriends,
    showSearchSummary,
    searchSummaryText,
    showSearchClearAction,
    searchEmptyDescription,
    applySearch,
    handleSearch,
    handleSelectSearchHistory,
    handleClearSearchHistory,
    handleClearActiveSearch
  }
}
