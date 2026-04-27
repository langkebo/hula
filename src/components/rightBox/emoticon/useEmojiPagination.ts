import { computed, ref, type ComputedRef } from 'vue'
import { isMobile } from '@/utils/PlatformConstants'

interface UseEmojiPaginationOptions<TSeries> {
  isFavoritesView: ComputedRef<boolean>
  reversedEmojiList: ComputedRef<unknown[]>
  currentSeries: ComputedRef<TSeries | null>
  getSeriesEmojis: (series: TSeries) => unknown[]
}

const SCROLL_LOAD_MORE_THRESHOLD = 32
const SERIES_PAGE_SIZE = 30
const SERIES_EMOJI_SIZE = 60
const SERIES_ROW_VERTICAL_PADDING = 12

export const useEmojiPagination = <TSeries>({
  isFavoritesView,
  reversedEmojiList,
  currentSeries,
  getSeriesEmojis
}: UseEmojiPaginationOptions<TSeries>) => {
  const favoritesPage = ref(1)
  const seriesPage = ref(1)
  const favoritesLoadMoreLock = ref(false)
  const seriesLoadMoreLock = ref(false)

  const packColumns = computed(() => (isMobile() ? 4 : 6))
  const seriesRowHeight = computed(() => SERIES_EMOJI_SIZE + SERIES_ROW_VERTICAL_PADDING)
  const seriesViewportHeight = computed(() => (isMobile() ? '240px' : '260px'))
  const favoritesPageSize = computed(() => (isMobile() ? 20 : 25))

  const isNearBottom = (target: HTMLElement) =>
    target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_LOAD_MORE_THRESHOLD

  const loadMoreFavorites = async () => {
    if (favoritesLoadMoreLock.value) return
    if (favoritesPage.value * favoritesPageSize.value >= reversedEmojiList.value.length) return
    favoritesLoadMoreLock.value = true
    favoritesPage.value += 1
    favoritesLoadMoreLock.value = false
  }

  const loadMoreSeries = async () => {
    if (seriesLoadMoreLock.value) return
    if (!currentSeries.value) return
    const total = getSeriesEmojis(currentSeries.value).length
    if (seriesPage.value * SERIES_PAGE_SIZE >= total) return
    seriesLoadMoreLock.value = true
    seriesPage.value += 1
    seriesLoadMoreLock.value = false
  }

  const onPanelScroll = (target: HTMLElement | null) => {
    if (!target) return
    if (isFavoritesView.value && isNearBottom(target)) {
      void loadMoreFavorites()
    }
  }

  const onSeriesScroll = (target: HTMLElement | null) => {
    if (!target || !currentSeries.value) return
    if (isNearBottom(target)) {
      void loadMoreSeries()
    }
  }

  const resetFavoritesPage = () => {
    favoritesPage.value = 1
  }

  const resetSeriesPage = () => {
    seriesPage.value = 1
  }

  return {
    favoritesPage,
    seriesPage,
    favoritesPageSize,
    packColumns,
    seriesRowHeight,
    seriesViewportHeight,
    SERIES_PAGE_SIZE,
    onPanelScroll,
    onSeriesScroll,
    resetFavoritesPage,
    resetSeriesPage
  }
}
