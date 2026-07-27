import { type ComputedRef, computed, type Ref, ref } from 'vue'
import {
  getSettingsTabs,
  SETTINGS_TABS,
  type SettingsTab,
  type SettingsTabTranslator,
  type SettingsTabType
} from '@/stores/domains/settings/settingsSchema'
import { matchesSettingsSearch, type SettingsSearchKeywordResolver } from './settingsSearchIndex'

interface UseSettingsShellOptions {
  isDesktop?: boolean
  initialQuery?: string
  translate?: SettingsTabTranslator
  resolveSearchKeywords?: SettingsSearchKeywordResolver
}

interface UseSettingsShellResult {
  searchQuery: Ref<string>
  visibleTabs: ComputedRef<SettingsTab[]>
  filteredTabs: ComputedRef<SettingsTab[]>
  hasSearchQuery: ComputedRef<boolean>
  hasSearchResults: ComputedRef<boolean>
  setSearchQuery: (value?: string) => void
  clearSearch: () => void
}

function matchesPlatform(tab: SettingsTab, isDesktop: boolean): boolean {
  if (tab.desktopOnly && !isDesktop) return false
  if (tab.mobileOnly && isDesktop) return false
  return true
}

export function useSettingsShell(options: UseSettingsShellOptions = {}): UseSettingsShellResult {
  const isDesktop = options.isDesktop ?? true
  const searchQuery = ref(options.initialQuery?.trim() || '')
  const translate = options.translate
  const resolveSearchKeywords = options.resolveSearchKeywords

  const visibleTabs = computed(() => {
    return getSettingsTabs(translate).filter((tab) => matchesPlatform(tab, isDesktop))
  })

  const filteredTabs = computed(() => {
    return visibleTabs.value.filter((tab) =>
      matchesSettingsSearch(tab.id, searchQuery.value, translate, resolveSearchKeywords)
    )
  })

  const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)
  const hasSearchResults = computed(() => filteredTabs.value.length > 0)

  function setSearchQuery(value?: string) {
    searchQuery.value = value?.trim() || ''
  }

  function clearSearch() {
    searchQuery.value = ''
  }

  return {
    searchQuery,
    visibleTabs,
    filteredTabs,
    hasSearchQuery,
    hasSearchResults,
    setSearchQuery,
    clearSearch
  }
}

export function findFirstMatchingSettingsTab(
  query?: string,
  isDesktop = true,
  translate?: SettingsTabTranslator,
  resolveSearchKeywords?: SettingsSearchKeywordResolver
): SettingsTabType | undefined {
  return SETTINGS_TABS.find(
    (tab) => matchesPlatform(tab, isDesktop) && matchesSettingsSearch(tab.id, query, translate, resolveSearchKeywords)
  )?.id
}
