import { type ComputedRef, computed, type Ref, ref } from 'vue'
import { type TjgCapability, useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import {
  getSettingsTabRequiredCapabilities,
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
  isCapabilityLoaded: ComputedRef<boolean>
  isTabAvailable: (tab: SettingsTab) => boolean
  isTabReadOnly: (tab: SettingsTab) => boolean
  setSearchQuery: (value?: string) => void
  clearSearch: () => void
}

function matchesPlatform(tab: SettingsTab, isDesktop: boolean): boolean {
  if (tab.desktopOnly && !isDesktop) return false
  if (tab.mobileOnly && isDesktop) return false
  return true
}

/**
 * 能力探测未完成（isLoaded=false）时保持可见，避免登录初期把页签误判为不可用；
 * 探测完成后再按能力严格过滤。加密页签缺失能力时走只读降级，始终保留。
 */
function matchesCapability(
  tab: SettingsTab,
  isCapabilityLoaded: boolean,
  isCapabilityAvailable: (capability: TjgCapability) => boolean
): boolean {
  if (getSettingsTabRequiredCapabilities(tab).length === 0) return true
  if (tab.capabilityFallback === 'readonly') return true
  if (!isCapabilityLoaded) return true
  return getSettingsTabRequiredCapabilities(tab).every(isCapabilityAvailable)
}

export function useSettingsShell(options: UseSettingsShellOptions = {}): UseSettingsShellResult {
  const isDesktop = options.isDesktop ?? true
  const searchQuery = ref(options.initialQuery?.trim() || '')
  const translate = options.translate
  const resolveSearchKeywords = options.resolveSearchKeywords

  const capability = useServerCapability()
  const isCapabilityLoaded = computed(() => capability.isLoaded.value)
  // 判定口径由 useServerCapability 统一提供，桌面/移动两端共用同一份映射
  const isCapabilityAvailable = (capabilityId: TjgCapability): boolean => capability.isCapabilityAvailable(capabilityId)

  function isTabAvailable(tab: SettingsTab): boolean {
    return matchesCapability(tab, isCapabilityLoaded.value, isCapabilityAvailable)
  }

  function isTabReadOnly(tab: SettingsTab): boolean {
    if (tab.capabilityFallback !== 'readonly' || !isCapabilityLoaded.value) return false
    return !getSettingsTabRequiredCapabilities(tab).every(isCapabilityAvailable)
  }

  const visibleTabs = computed(() => {
    return getSettingsTabs(translate).filter((tab) => matchesPlatform(tab, isDesktop) && isTabAvailable(tab))
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
    isCapabilityLoaded,
    isTabAvailable,
    isTabReadOnly,
    setSearchQuery,
    clearSearch
  }
}

export function findFirstMatchingSettingsTab(
  query?: string,
  isDesktop = true,
  translate?: SettingsTabTranslator,
  resolveSearchKeywords?: SettingsSearchKeywordResolver,
  isTabAvailable?: (tab: SettingsTab) => boolean
): SettingsTabType | undefined {
  return SETTINGS_TABS.find(
    (tab) =>
      matchesPlatform(tab, isDesktop) &&
      (isTabAvailable?.(tab) ?? true) &&
      matchesSettingsSearch(tab.id, query, translate, resolveSearchKeywords)
  )?.id
}
