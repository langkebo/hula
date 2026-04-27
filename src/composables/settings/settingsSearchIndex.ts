import {
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS,
  SETTINGS_LEGACY_TAB_MAP,
  SETTINGS_TABS,
  getSettingsTabLabel,
  type LegacySettingsTabType,
  type SettingsTab,
  type SettingsTabTranslator,
  type SettingsTabType
} from '@/stores/domains/settings/settingsSchema'

export interface SettingsSearchEntry {
  id: SettingsTabType
  terms: string[]
}

export type SettingsSearchKeywordResolver = (tabId: SettingsTabType) => string[]

const ROUTE_TERMS: Partial<Record<SettingsTabType, string[]>> = {
  notifications: [SETTINGS_CANONICAL_ROUTE_SEGMENTS.notifications],
  labs: [
    SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs,
    `${SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs}/${SETTINGS_LABS_CHILD_ROUTE_SEGMENTS.integrations}`
  ],
  securityPrivacy: [SETTINGS_CANONICAL_ROUTE_SEGMENTS.securityPrivacy],
  helpAbout: [SETTINGS_CANONICAL_ROUTE_SEGMENTS.helpAbout]
}

function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '')
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalizedValue = normalizeSearchTerm(value)
    if (!normalizedValue || seen.has(normalizedValue)) continue
    seen.add(normalizedValue)
    result.push(normalizedValue)
  }

  return result
}

function getLegacyTerms(tabId: SettingsTabType): string[] {
  return (Object.entries(SETTINGS_LEGACY_TAB_MAP) as Array<[LegacySettingsTabType, SettingsTabType]>)
    .filter(([, mappedTabId]) => mappedTabId === tabId)
    .map(([legacyTabId]) => legacyTabId)
}

function getKeywordTerms(tabId: SettingsTabType, keywordResolver?: SettingsSearchKeywordResolver): string[] {
  return keywordResolver?.(tabId) ?? []
}

function buildSettingsSearchIndex(
  tabs: SettingsTab[],
  t?: SettingsTabTranslator,
  keywordResolver?: SettingsSearchKeywordResolver
): SettingsSearchEntry[] {
  return tabs.map((tab) => ({
    id: tab.id,
    terms: uniqueTerms([
      tab.id,
      getSettingsTabLabel(tab.id, t),
      ...getLegacyTerms(tab.id),
      ...getKeywordTerms(tab.id, keywordResolver),
      ...(ROUTE_TERMS[tab.id] ?? [])
    ])
  }))
}

export const SETTINGS_SEARCH_INDEX = buildSettingsSearchIndex(SETTINGS_TABS)

export function matchesSettingsSearch(
  tabId: SettingsTabType,
  query?: string,
  t?: SettingsTabTranslator,
  keywordResolver?: SettingsSearchKeywordResolver
): boolean {
  const normalizedQuery = normalizeSearchTerm(query || '')
  if (!normalizedQuery) return true

  const searchIndex =
    t || keywordResolver ? buildSettingsSearchIndex(SETTINGS_TABS, t, keywordResolver) : SETTINGS_SEARCH_INDEX
  const entry = searchIndex.find((item) => item.id === tabId)
  if (!entry) return false

  return entry.terms.some((term) => term.includes(normalizedQuery))
}
