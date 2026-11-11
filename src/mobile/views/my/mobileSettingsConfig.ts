import type { TjgCapability } from '@/services/matrix/MatrixCapabilityService'
import {
  MOBILE_SETTINGS_EMOTICONS_PATH,
  MOBILE_SETTINGS_ENCRYPTION_PATH,
  MOBILE_SETTINGS_LABS_PATH
} from './settingsRoutes'

export interface MobileSettingsNavItem {
  titleKey: string
  path: string
  icon: string
  iconColor: string
  iconBackgroundColor: string
  /**
   * 该入口依赖的服务端能力（与桌面 settingsSchema.ts 的 requiredCapability 同语义）：
   * 缺一即隐藏，避免后端未开放能力时点进去空白或报错。
   */
  requiredCapability?: TjgCapability | TjgCapability[]
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
    iconBackgroundColor: 'var(--tjg-color-success-100)',
    requiredCapability: 'voip'
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

/** 归一化条目的能力声明为数组（无声明返回空数组） */
export function getMobileSettingsItemCapabilities(item: MobileSettingsNavItem): TjgCapability[] {
  if (!item.requiredCapability) return []
  return Array.isArray(item.requiredCapability) ? item.requiredCapability : [item.requiredCapability]
}

/**
 * 按服务端能力过滤入口。
 *
 * 与桌面 `useSettingsShell.matchesCapability` 同一策略：能力探测未完成时全部保留
 * （避免登录初期误判），探测完成后才隐藏缺失能力的入口。
 */
export function filterMobileSettingsItems(
  items: MobileSettingsNavItem[],
  isCapabilityLoaded: boolean,
  isCapabilityAvailable: (capability: TjgCapability) => boolean
): MobileSettingsNavItem[] {
  if (!isCapabilityLoaded) return items
  return items.filter((item) => getMobileSettingsItemCapabilities(item).every(isCapabilityAvailable))
}
