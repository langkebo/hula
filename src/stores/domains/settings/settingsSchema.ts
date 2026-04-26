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
  'burnAfterRead'
] as const

export type SettingsTabType = (typeof SETTINGS_TAB_IDS)[number]
export type LegacySettingsTabType = 'push' | 'integrations' | 'security' | 'help'
export type SettingsTabInput = SettingsTabType | LegacySettingsTabType

export interface SettingsTab {
  id: SettingsTabType
  label: string
  icon: string
  desktopOnly?: boolean
  mobileOnly?: boolean
}

export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'account', label: '账户', icon: 'user' },
  { id: 'sessions', label: '会话管理', icon: 'devices' },
  { id: 'appearance', label: '外观设置', icon: 'palette' },
  { id: 'notifications', label: '通知设置', icon: 'bell' },
  { id: 'preferences', label: '偏好设置', icon: 'settings' },
  { id: 'keyboard', label: '快捷键', icon: 'keyboard', desktopOnly: true },
  { id: 'sidebar', label: '侧边栏', icon: 'sidebar', desktopOnly: true },
  { id: 'voiceVideo', label: '语音视频', icon: 'microphone' },
  { id: 'securityPrivacy', label: '安全与隐私', icon: 'shield' },
  { id: 'encryption', label: '加密', icon: 'key' },
  { id: 'labs', label: 'Labs', icon: 'flask' },
  { id: 'mjolnir', label: '屏蔽管理', icon: 'block-helper' },
  { id: 'helpAbout', label: '帮助与关于', icon: 'help-circle' },
  { id: 'friends', label: '好友管理', icon: 'account-group' },
  { id: 'burnAfterRead', label: '阅后即焚', icon: 'timer-outline' }
]

export const SETTINGS_LEGACY_TAB_MAP: Record<LegacySettingsTabType, SettingsTabType> = {
  push: 'notifications',
  integrations: 'labs',
  security: 'securityPrivacy',
  help: 'helpAbout'
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

export function normalizeSettingsTab(tab?: SettingsTabInput): SettingsTabType | undefined {
  if (!tab) {
    return undefined
  }

  return SETTINGS_LEGACY_TAB_MAP[tab as LegacySettingsTabType] ?? tab
}
