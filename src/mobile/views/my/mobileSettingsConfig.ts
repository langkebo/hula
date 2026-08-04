import { MOBILE_SETTINGS_LABS_PATH } from './settingsRoutes'

interface MobileSettingsNavItem {
  titleKey: string
  path: string
  icon: string
  iconColor: string
  iconBackgroundColor: string
}

export const MOBILE_ADVANCED_SETTINGS_ITEMS: MobileSettingsNavItem[] = [
  {
    titleKey: 'mobile_setting.voice_video',
    path: '/mobile/mobileMy/voiceVideo',
    icon: 'mdi:video',
    iconColor: 'var(--tjg-color-success-500)',
    iconBackgroundColor: 'var(--tjg-color-success-100)'
  },
  {
    titleKey: 'mobile_setting.labs',
    path: MOBILE_SETTINGS_LABS_PATH,
    icon: 'mdi:flask',
    iconColor: 'var(--tjg-color-beta-500)',
    iconBackgroundColor: 'var(--tjg-color-beta-100)'
  },
  {
    titleKey: 'mobile_setting.homeserver',
    path: '/mobile/mobileMy/homeserver',
    icon: 'mdi:server',
    iconColor: 'var(--tjg-color-info-500)',
    iconBackgroundColor: 'var(--tjg-color-info-100)'
  }
]
