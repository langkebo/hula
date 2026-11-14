import { type Ref, ref } from 'vue'
import { matrixSearchService, type SearchResult } from '@/services/matrix/MatrixSearchService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRoomSearch')

const DEBOUNCE_MS = 300

/**
 * 房间内消息搜索 composable。
 *
 * 配合 ChatRoomSearch.vue 面板使用：
 * - openSearch/closeSearch 控制面板可见性，关闭时重置状态
 * - onQueryInput 由输入框触发，防抖 300ms 后调用 MatrixSearchService.searchRoomMessages
 * - navigateNext/navigatePrev/selectResult 用于键盘上下导航与选中
 * - selectResult 返回选中的 SearchResult，调用方据 eventId 跳转到对应消息位置
 *
 * @param roomId 当前房间 ID 的响应式引用
 */
export function useRoomSearch(roomId: Ref<string>) {
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref(false)
  const activeIndex = ref(-1)
  const isOpen = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let requestSeq = 0

  async function performSearch(): Promise<void> {
    const term = query.value.trim()
    if (!term) {
      results.value = []
      activeIndex.value = -1
      error.value = false
      return
    }

    const seq = ++requestSeq
    loading.value = true
    error.value = false
    try {
      const searchResult = await matrixSearchService.searchRoomMessages(roomId.value, term)
      // 丢弃过期响应，避免快速输入时旧结果覆盖新结果
      if (seq !== requestSeq) return
      results.value = searchResult.results
      activeIndex.value = searchResult.results.length > 0 ? 0 : -1
    } catch (err) {
      if (seq !== requestSeq) return
      logger.error('房间内搜索失败:', err)
      results.value = []
      activeIndex.value = -1
      error.value = true
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  function retry(): void {
    if (loading.value) return
    void performSearch()
  }

  function onQueryInput(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(performSearch, DEBOUNCE_MS)
  }

  function openSearch(): void {
    isOpen.value = true
  }

  function closeSearch(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    requestSeq++
    isOpen.value = false
    query.value = ''
    results.value = []
    error.value = false
    activeIndex.value = -1
  }

  function navigateNext(): void {
    if (activeIndex.value < results.value.length - 1) {
      activeIndex.value++
    }
  }

  function navigatePrev(): void {
    if (activeIndex.value > 0) {
      activeIndex.value--
    }
  }

  function selectResult(index: number): SearchResult | null {
    if (index < 0 || index >= results.value.length) {
      return null
    }
    activeIndex.value = index
    return results.value[index]
  }

  return {
    query,
    results,
    loading,
    error,
    activeIndex,
    isOpen,
    onQueryInput,
    performSearch,
    retry,
    openSearch,
    closeSearch,
    navigateNext,
    navigatePrev,
    selectResult
  }
}
