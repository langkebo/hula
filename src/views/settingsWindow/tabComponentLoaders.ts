import type { Component } from 'vue'
import type { SettingsTabType } from '@/stores/domains/settings/settingsTab'

export const SETTINGS_TAB_COMPONENT_LOADERS: Record<SettingsTabType, () => Promise<Component>> = {
  account: () => import('./tabs/AccountSettings.vue'),
  sessions: () => import('./tabs/SessionSettings.vue'),
  appearance: () => import('./tabs/AppearanceSettings.vue'),
  notifications: () => import('./tabs/NotificationSettings.vue'),
  voiceVideo: () => import('./tabs/VoiceVideoSettings.vue'),
  preferences: () => import('./tabs/PreferencesSettings.vue'),
  keyboard: () => import('./tabs/KeyboardSettings.vue'),
  sidebar: () => import('./tabs/SidebarSettings.vue'),
  securityPrivacy: () => import('./tabs/SecuritySettings.vue'),
  encryption: () => import('./tabs/EncryptionSettings.vue'),
  labs: () => import('./tabs/LabsSettings.vue'),
  mjolnir: () => import('./tabs/MjolnirSettings.vue'),
  friends: () => import('./tabs/FriendsSettings.vue'),
  burnAfterRead: () => import('./tabs/BurnAfterReadSettings.vue'),
  aiConnection: () => import('./tabs/AiConnectionSettings.vue'),
  helpAbout: () => import('./tabs/HelpSettings.vue')
}
