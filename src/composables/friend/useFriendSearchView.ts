/**
 * 好友搜索即时展示视图切换 Composable (§5.3)
 *
 * 搜索关键词非空时自动切换到搜索结果视图，
 * 清空时恢复好友列表。使用 300ms 防抖避免频繁请求。
 */

import { computed, ref, watch } from 'vue'
import { type HighlightSegment, highlightSearchMatch } from '@/components/friend/highlightSearchMatch'

const DEBOUNCE_MS = 300

export function useFriendSearchView() {
  const keyword = ref('')
  const debouncedKeyword = ref('')

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    keyword,
    (value) => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        debouncedKeyword.value = value
      }, DEBOUNCE_MS)
    },
    { flush: 'sync' }
  )

  /** 是否处于搜索状态（防抖后关键词非空） */
  const isSearching = computed(() => debouncedKeyword.value.trim().length > 0)

  /**
   * 设置搜索关键词
   */
  function setKeyword(value: string): void {
    keyword.value = value
  }

  /**
   * 立即清空搜索（不等防抖，直接恢复好友列表）
   */
  function clearSearch(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    keyword.value = ''
    debouncedKeyword.value = ''
  }

  /**
   * 高亮匹配文本（复用已有 highlightSearchMatch）
   */
  function highlightMatch(text: string, query: string = debouncedKeyword.value): HighlightSegment[] {
    return highlightSearchMatch(text, query)
  }

  return {
    keyword,
    debouncedKeyword,
    isSearching,
    setKeyword,
    clearSearch,
    highlightMatch
  }
}
