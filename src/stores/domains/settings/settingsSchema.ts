export const SETTINGS_TAB_IDS = [
  'account',
  'sessions',
  'appearance',
  'notifications',
  'preferences',
  'keyboard',
  'sidebar',
  'voiceVideo',
  'securityPrivacy',
  'encryption',
  'labs',
  'mjolnir',
  'helpAbout',
  'friends',
  'burnAfterRead',
  'aiConnection'
] as const

export type SettingsTabType = (typeof SETTINGS_TAB_IDS)[number]
export type LegacySettingsTabType = 'security' | 'help' | 'general' | 'privacy' | 'shortcuts' | 'about'
export type SettingsTabInput = SettingsTabType | LegacySettingsTabType

export type SettingsTabGroup = 'general' | 'communication' | 'security' | 'advanced' | 'other'

export interface SettingsTab {
  id: SettingsTabType
  label: string
  icon: string
  group: SettingsTabGroup
  desktopOnly?: boolean
  mobileOnly?: boolean
}

export type SettingsTabTranslator = (key: string) => string

export const SETTINGS_TAB_GROUPS: { id: SettingsTabGroup; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'communication', label: 'Communication' },
  { id: 'security', label: 'Security' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'other', label: 'Other' }
]

export const SETTINGS_TAB_GROUP_TRANSLATION_KEYS: Record<SettingsTabGroup, string> = {
  general: 'setting.dialog.groups.general',
  communication: 'setting.dialog.groups.communication',
  security: 'setting.dialog.groups.security',
  advanced: 'setting.dialog.groups.advanced',
  other: 'setting.dialog.groups.other'
}

export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'account', label: 'Account', icon: 'user', group: 'general' },
  { id: 'sessions', label: 'Sessions', icon: 'devices', group: 'general' },
  { id: 'appearance', label: 'Appearance', icon: 'palette', group: 'general' },
  { id: 'notifications', label: 'Notifications', icon: 'bell', group: 'general' },
  { id: 'preferences', label: 'Preferences', icon: 'settings', group: 'general' },
  { id: 'keyboard', label: 'Keyboard', icon: 'keyboard', group: 'general', desktopOnly: true },
  { id: 'sidebar', label: 'Sidebar', icon: 'sidebar', group: 'general', desktopOnly: true },
  { id: 'voiceVideo', label: 'Voice & Video', icon: 'microphone', group: 'communication' },
  { id: 'securityPrivacy', label: 'Security & Privacy', icon: 'shield', group: 'security' },
  { id: 'encryption', label: 'Encryption', icon: 'key', group: 'security' },
  { id: 'labs', label: 'Labs', icon: 'flask', group: 'advanced' },
  { id: 'mjolnir', label: 'Moderation', icon: 'block-helper', group: 'advanced' },
  { id: 'helpAbout', label: 'Help & About', icon: 'help-circle', group: 'other' },
  { id: 'friends', label: 'Friends', icon: 'account-group', group: 'communication' },
  { id: 'burnAfterRead', label: 'Burn After Read', icon: 'timer-outline', group: 'communication' },
  { id: 'aiConnection', label: 'AI Connection', icon: 'robot', group: 'advanced' }
]

const SETTINGS_TAB_TRANSLATION_KEYS: Record<SettingsTabType, string> = {
  account: 'setting.dialog.tabs.account',
  sessions: 'setting.dialog.tabs.sessions',
  appearance: 'setting.dialog.tabs.appearance',
  notifications: 'setting.dialog.tabs.notifications',
  preferences: 'setting.dialog.tabs.preferences',
  keyboard: 'setting.dialog.tabs.keyboard',
  sidebar: 'setting.dialog.tabs.sidebar',
  voiceVideo: 'setting.dialog.tabs.voice_video',
  securityPrivacy: 'setting.dialog.tabs.security_privacy',
  encryption: 'setting.dialog.tabs.encryption',
  labs: 'setting.dialog.tabs.labs',
  mjolnir: 'setting.dialog.tabs.mjolnir',
  helpAbout: 'setting.dialog.tabs.help_about',
  friends: 'setting.dialog.tabs.friends',
  burnAfterRead: 'setting.dialog.tabs.burn_after_read',
  aiConnection: 'setting.dialog.tabs.ai_connection'
}

export const SETTINGS_LEGACY_TAB_MAP: Record<LegacySettingsTabType, SettingsTabType> = {
  security: 'securityPrivacy',
  help: 'helpAbout',
  general: 'preferences',
  privacy: 'securityPrivacy',
  shortcuts: 'keyboard',
  about: 'helpAbout'
}

export const SETTINGS_CANONICAL_ROUTE_SEGMENTS = {
  notifications: 'notifications',
  labs: 'labs',
  securityPrivacy: 'security-privacy',
  helpAbout: 'help-about'
} as const

export const SETTINGS_LABS_CHILD_ROUTE_SEGMENTS = {
  integrations: 'integrations'
} as const

export function getSettingsTabLabel(tabId: SettingsTabType, t?: SettingsTabTranslator): string {
  const fallbackLabel = SETTINGS_TABS.find((tab) => tab.id === tabId)?.label ?? tabId
  if (!t) return fallbackLabel

  const translationKey = SETTINGS_TAB_TRANSLATION_KEYS[tabId]
  const translatedLabel = t(translationKey)
  return translatedLabel === translationKey ? fallbackLabel : translatedLabel
}

export function getSettingsTabs(t?: SettingsTabTranslator): SettingsTab[] {
  return SETTINGS_TABS.map((tab) => ({
    ...tab,
    label: getSettingsTabLabel(tab.id, t)
  }))
}

export function normalizeSettingsTab(tab?: SettingsTabInput): SettingsTabType | undefined {
  if (!tab) {
    return undefined
  }

  const legacyMapped = SETTINGS_LEGACY_TAB_MAP[tab as LegacySettingsTabType]
  if (legacyMapped) {
    return legacyMapped
  }

  if ((SETTINGS_TAB_IDS as readonly string[]).includes(tab)) {
    return tab as SettingsTabType
  }

  return undefined
}

export function getSettingsTabGroupLabel(groupId: SettingsTabGroup, t?: SettingsTabTranslator): string {
  const fallback = SETTINGS_TAB_GROUPS.find((g) => g.id === groupId)?.label ?? groupId
  if (!t) return fallback
  const key = SETTINGS_TAB_GROUP_TRANSLATION_KEYS[groupId]
  const translated = t(key)
  return translated === key ? fallback : translated
}

export function getGroupedSettingsTabs(
  tabs: SettingsTab[]
): { group: SettingsTabGroup; label: string; tabs: SettingsTab[] }[] {
  return SETTINGS_TAB_GROUPS.map((g) => ({
    group: g.id,
    label: g.label,
    tabs: tabs.filter((tab) => tab.group === g.id)
  })).filter((entry) => entry.tabs.length > 0)
}
