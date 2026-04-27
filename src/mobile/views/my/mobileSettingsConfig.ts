import { MOBILE_SETTINGS_LABS_PATH } from './settingsRoutes'

export interface MobileSettingsNavItem {
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
    iconColor: '#20c997',
    iconBackgroundColor: '#e6fffb'
  },
  {
    titleKey: 'mobile_setting.labs',
    path: MOBILE_SETTINGS_LABS_PATH,
    icon: 'mdi:flask',
    iconColor: '#eb2f96',
    iconBackgroundColor: '#fff0f6'
  },
  {
    titleKey: 'mobile_setting.homeserver',
    path: '/mobile/mobileMy/homeserver',
    icon: 'mdi:server',
    iconColor: '#1890ff',
    iconBackgroundColor: '#e6f7ff'
  }
]
