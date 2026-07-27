/**
 * 设置页快速搜索 Composable (§5.2)
 *
 * 在设置页顶部提供搜索框，过滤左侧导航 Tab。
 * 支持中英文关键词搜索，回车跳转到第一个匹配项。
 * 复用 settingsSearchIndex 的 matchesSettingsSearch 逻辑。
 */

import { computed, ref } from 'vue'
import { type HighlightSegment, highlightSearchMatch } from '@/components/friend/highlightSearchMatch'
import { matchesSettingsSearch, type SettingsSearchKeywordResolver } from '@/composables/settings/settingsSearchIndex'
import { SETTINGS_TABS, type SettingsTab, type SettingsTabTranslator } from '@/stores/domains/settings/settingsSchema'

interface UseSettingsSearchOptions {
  /** i18n 翻译函数，用于构建搜索索引 */
  translator?: SettingsTabTranslator
  /** 关键词解析器，支持自定义关键词 */
  keywordResolver?: SettingsSearchKeywordResolver
}

export function useSettingsSearch(options?: UseSettingsSearchOptions) {
  const searchQuery = ref('')

  /** 是否处于搜索状态 */
  const isSearching = computed(() => searchQuery.value.trim().length > 0)

  /** 过滤后的 Tab 列表 */
  const filteredTabs = computed<SettingsTab[]>(() => {
    const query = searchQuery.value.trim()
    if (!query) return [...SETTINGS_TABS]

    return SETTINGS_TABS.filter((tab) =>
      matchesSettingsSearch(tab.id, query, options?.translator, options?.keywordResolver)
    )
  })

  /** 第一个匹配的 Tab（用于回车跳转） */
  const firstMatch = computed<SettingsTab | null>(() => {
    if (!isSearching.value) return null
    return filteredTabs.value[0] ?? null
  })

  /**
   * 清空搜索
   */
  function clearSearch(): void {
    searchQuery.value = ''
  }

  /**
   * 高亮匹配文本
   */
  function highlightMatch(text: string): HighlightSegment[] {
    return highlightSearchMatch(text, searchQuery.value.trim())
  }

  return {
    searchQuery,
    isSearching,
    filteredTabs,
    firstMatch,
    clearSearch,
    highlightMatch
  }
}
