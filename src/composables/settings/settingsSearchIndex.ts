import {
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS,
  SETTINGS_LEGACY_TAB_MAP,
  SETTINGS_TABS,
  type LegacySettingsTabType,
  type SettingsTabType
} from '@/stores/domains/settings/settingsSchema'

export interface SettingsSearchEntry {
  id: SettingsTabType
  terms: string[]
}

const SETTINGS_SEARCH_KEYWORDS: Record<SettingsTabType, string[]> = {
  account: ['账号', '个人资料', 'profile', 'display-name'],
  sessions: ['设备', 'device', 'session', 'login'],
  appearance: ['主题', 'theme', 'wallpaper', 'timestamp'],
  notifications: ['通知', '提醒', 'push', 'push-rules', 'pusher'],
  preferences: ['偏好', 'media', 'language', 'privacy', 'startup', 'storage', 'scan', 'autostart'],
  keyboard: ['快捷键', 'hotkey', 'keymap'],
  sidebar: ['侧边栏', 'left-panel', 'navigation'],
  voiceVideo: ['语音', '视频', 'audio', 'video', 'webrtc'],
  securityPrivacy: ['安全', '隐私', 'security', 'privacy', 'visibility', 'secret-chat', 'lock', 'hidden'],
  encryption: ['加密', 'secret-storage', 'secure-backup', 'cross-signing'],
  labs: ['实验功能', 'beta', 'integrations', '扩展中心'],
  mjolnir: ['屏蔽', '封禁', 'moderation', 'block'],
  helpAbout: ['帮助', '关于', '更新', '诊断', 'help', 'about'],
  friends: ['好友', 'contacts', 'remark'],
  burnAfterRead: ['阅后即焚', 'ephemeral', 'burn', 'timer']
}

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

function buildSettingsSearchIndex(): SettingsSearchEntry[] {
  return SETTINGS_TABS.map((tab) => ({
    id: tab.id,
    terms: uniqueTerms([
      tab.id,
      tab.label,
      ...getLegacyTerms(tab.id),
      ...(SETTINGS_SEARCH_KEYWORDS[tab.id] ?? []),
      ...(ROUTE_TERMS[tab.id] ?? [])
    ])
  }))
}

export const SETTINGS_SEARCH_INDEX = buildSettingsSearchIndex()

export function matchesSettingsSearch(tabId: SettingsTabType, query?: string): boolean {
  const normalizedQuery = normalizeSearchTerm(query || '')
  if (!normalizedQuery) return true

  const entry = SETTINGS_SEARCH_INDEX.find((item) => item.id === tabId)
  if (!entry) return false

  return entry.terms.some((term) => term.includes(normalizedQuery))
}
