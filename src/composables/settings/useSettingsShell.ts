import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { matchesSettingsSearch } from './settingsSearchIndex'
import { SETTINGS_TABS, type SettingsTab, type SettingsTabType } from '@/stores/domains/settings/settingsSchema'

export interface UseSettingsShellOptions {
  isDesktop?: boolean
  initialQuery?: string
}

export interface UseSettingsShellResult {
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

  const visibleTabs = computed(() => {
    return SETTINGS_TABS.filter((tab) => matchesPlatform(tab, isDesktop))
  })

  const filteredTabs = computed(() => {
    return visibleTabs.value.filter((tab) => matchesSettingsSearch(tab.id, searchQuery.value))
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

export function findFirstMatchingSettingsTab(query?: string, isDesktop = true): SettingsTabType | undefined {
  return SETTINGS_TABS.find((tab) => matchesPlatform(tab, isDesktop) && matchesSettingsSearch(tab.id, query))?.id
}
