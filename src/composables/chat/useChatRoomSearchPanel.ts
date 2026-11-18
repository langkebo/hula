import { useEventListener } from '@vueuse/core'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoomSearch } from '@/composables/chat/useRoomSearch'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useGlobalStore } from '@/stores/domains/widget/global'

interface UseChatRoomSearchPanelOptions {
  /** 选中搜索结果后跳转到对应消息 */
  jumpToReplyMsg: (eventId: string) => void | Promise<void>
}

/**
 * 房间内消息搜索面板（F2）。
 *
 * 负责面板状态与结果导航，并绑定 F2 快捷键与 OPEN_ROOM_SEARCH mitt 事件；
 * 选中结果后关闭面板并跳转到目标消息。
 */
export function useChatRoomSearchPanel(options: UseChatRoomSearchPanelOptions) {
  const globalStore = useGlobalStore()
  const searchRoomId = computed(() => globalStore.currentSessionRoomId ?? '')

  const {
    isOpen: searchIsOpen,
    query: searchQuery,
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    activeIndex: searchActiveIndex,
    onQueryInput: handleSearchQueryInput,
    openSearch,
    closeSearch: closeRoomSearch,
    retry: searchRetry,
    navigateNext: searchNavigateNext,
    navigatePrev: searchNavigatePrev,
    selectResult: searchSelectResult
  } = useRoomSearch(searchRoomId)

  function handleSearchQueryUpdate(value: string) {
    searchQuery.value = value
  }

  function handleSearchNavigate(direction: 'next' | 'prev') {
    if (direction === 'next') {
      searchNavigateNext()
    } else {
      searchNavigatePrev()
    }
  }

  function handleSearchSetActive(index: number) {
    searchActiveIndex.value = index
  }

  function handleSearchSelectResult(index: number) {
    const result = searchSelectResult(index)
    if (result) {
      closeRoomSearch()
      void options.jumpToReplyMsg(result.eventId)
    }
  }

  // F2 快捷键打开搜索面板
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'F2' && !searchIsOpen.value) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      event.preventDefault()
      openSearch()
    }
  })

  onMounted(() => {
    useMitt.on(MittEnum.OPEN_ROOM_SEARCH, openSearch)
  })
  onUnmounted(() => {
    useMitt.off(MittEnum.OPEN_ROOM_SEARCH, openSearch)
  })

  return {
    searchIsOpen,
    searchQuery,
    searchResults,
    searchLoading,
    searchError,
    searchActiveIndex,
    handleSearchQueryInput,
    handleSearchQueryUpdate,
    handleSearchNavigate,
    handleSearchSetActive,
    handleSearchSelectResult,
    searchRetry,
    closeRoomSearch
  }
}
