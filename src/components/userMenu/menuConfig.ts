import type { SettingsTabType } from '@/stores/settingsDialog'

export interface MenuItem {
  id: string
  label: string
  labelKey?: string
  icon: string
  action?: () => void
  tabId?: SettingsTabType
  danger?: boolean
  divider?: boolean
  desktopOnly?: boolean
  mobileOnly?: boolean
  disabled?: boolean
}

export interface MenuConfig {
  items: MenuItem[]
}

let logoutCallback: (() => Promise<void>) | null = null

export function setLogoutCallback(callback: () => Promise<void>): void {
  logoutCallback = callback
}

export function getLogoutCallback(): (() => Promise<void>) | null {
  return logoutCallback
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'home',
    label: '我的主页',
    icon: 'home',
    action: () => {
      console.log('Navigate to home')
    }
  },
  {
    id: 'link-device',
    label: '链接新设备',
    icon: 'qrcode',
    tabId: 'sessions',
    desktopOnly: true
  },
  {
    id: 'divider-1',
    divider: true,
    icon: '',
    label: ''
  },
  {
    id: 'notifications',
    label: '通知',
    icon: 'bell',
    tabId: 'notifications'
  },
  {
    id: 'security',
    label: '安全隐私',
    icon: 'shield',
    tabId: 'security'
  },
  {
    id: 'settings',
    label: '设置',
    icon: 'settings',
    tabId: 'account'
  },
  {
    id: 'divider-2',
    divider: true,
    icon: '',
    label: ''
  },
  {
    id: 'feedback',
    label: '反馈',
    icon: 'chat',
    action: () => {
      window.open('https://github.com/nichuanfang/nichuanfang.github.io/issues', '_blank')
    }
  },
  {
    id: 'logout',
    label: '退出登录',
    icon: 'logout',
    danger: true,
    action: () => {
      if (logoutCallback) {
        logoutCallback()
      } else {
        console.log('Logout callback not set')
      }
    }
  }
]

export function getFilteredMenuItems(isDesktop: boolean): MenuItem[] {
  return MENU_ITEMS.filter(item => {
    if (item.desktopOnly && !isDesktop) return false
    if (item.mobileOnly && isDesktop) return false
    return true
  })
}

export function findMenuItemById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(item => item.id === id)
}
