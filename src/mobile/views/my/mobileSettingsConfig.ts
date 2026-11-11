import {
  MOBILE_SETTINGS_EMOTICONS_PATH,
  MOBILE_SETTINGS_ENCRYPTION_PATH,
  MOBILE_SETTINGS_LABS_PATH
} from './settingsRoutes'

interface MobileSettingsNavItem {
  titleKey: string
  path: string
  icon: string
  iconColor: string
  iconBackgroundColor: string
}

export const MOBILE_ADVANCED_SETTINGS_ITEMS: MobileSettingsNavItem[] = [
  {
    // 加密与密钥状态页（477 行）此前**有路由但无人 push**，只能手输 URL 到达
    titleKey: 'setting.encryption.title',
    path: MOBILE_SETTINGS_ENCRYPTION_PATH,
    icon: 'mdi:lock-check',
    iconColor: 'var(--tjg-color-success-500)',
    iconBackgroundColor: 'var(--tjg-color-success-100)'
  },
  {
    titleKey: 'mobile_setting.voice_video',
    path: '/mobile/mobileMy/voiceVideo',
    icon: 'mdi:video',
    iconColor: 'var(--tjg-color-success-500)',
    iconBackgroundColor: 'var(--tjg-color-success-100)'
  },
  {
    titleKey: 'mobile_setting.storage',
    path: '/mobile/mobileMy/storage',
    icon: 'mdi:database',
    iconColor: 'var(--tjg-color-info-500)',
    iconBackgroundColor: 'var(--tjg-color-info-100)'
  },
  {
    // 表情包管理实现早已存在（255 行），但既无路由也无入口 ⇒ 等于不存在
    titleKey: 'emoticon.packs.title',
    path: MOBILE_SETTINGS_EMOTICONS_PATH,
    icon: 'mdi:emoticon-happy-outline',
    iconColor: 'var(--tjg-color-beta-500)',
    iconBackgroundColor: 'var(--tjg-color-beta-100)'
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
