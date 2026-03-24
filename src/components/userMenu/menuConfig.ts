import type { SettingsTabType } from '@/stores/settingsDialog'
import { useRouter } from 'vue-router'
import { useDialog, useMessage } from 'naive-ui'

export interface MenuItem {
  id: string
  label: string
  labelKey?: string
  icon: string
  action?: () => void
  tabId?: SettingsTabType
  dialogId?: string
  danger?: boolean
  divider?: boolean
  desktopOnly?: boolean
  mobileOnly?: boolean
  disabled?: boolean
  requireUserSelection?: boolean
}

export interface MenuSection {
  id: string
  title?: string
  items: MenuItem[]
}

let logoutCallback: (() => Promise<void>) | null = null
let routerInstance: ReturnType<typeof useRouter> | null = null

export function setLogoutCallback(callback: () => Promise<void>): void {
  logoutCallback = callback
}

export function getLogoutCallback(): (() => Promise<void>) | null {
  return logoutCallback
}

export function setRouterInstance(router: ReturnType<typeof useRouter>): void {
  routerInstance = router
}

function navigateToHome(): void {
  if (routerInstance) {
    routerInstance.push('/home')
  } else {
    console.warn('[UserMenu] Router instance not set')
  }
}

function openSendMessageDialog(): void {
  const router = useRouter()
  if (router) {
    router.push('/friend')
  }
}

function openFriendManagementDialog(): void {
  const router = useRouter()
  if (router) {
    router.push('/friend')
  }
}

async function setFriendStatus(_status: 'favorite' | 'accepted' | 'blocked'): Promise<void> {
  const dialog = useDialog()
  const router = useRouter()

  dialog.warning({
    title: '选择好友',
    content: '请从好友列表中选择要操作的好友',
    positiveText: '打开好友列表',
    negativeText: '取消',
    onPositiveClick: () => {
      if (router) {
        router.push('/friend')
      }
    }
  })
}

async function handleSetFavorite(): Promise<void> {
  await setFriendStatus('favorite')
}

async function handleSetNormal(): Promise<void> {
  await setFriendStatus('accepted')
}

async function handleSetBlocked(): Promise<void> {
  await setFriendStatus('blocked')
}

async function handleRemoveFriend(): Promise<void> {
  const message = useMessage()
  const dialog = useDialog()
  const router = useRouter()

  dialog.warning({
    title: '删除好友',
    content: '确定要删除该好友吗？删除后需要重新添加',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        if (router) {
          router.push('/friend')
        }
        message.info('请在好友列表中选择要删除的好友')
      } catch (_error) {
        message.error('操作失败')
      }
    }
  })
}

async function handleStartEncryptedChat(): Promise<void> {
  const dialog = useDialog()

  dialog.warning({
    title: '选择好友',
    content: '请从好友列表中选择要发起加密聊天的好友',
    positiveText: '打开好友列表',
    negativeText: '取消',
    onPositiveClick: () => {
      openFriendManagementDialog()
    }
  })
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'quick-actions',
    title: '快捷操作',
    items: [
      {
        id: 'send-message',
        label: '发送消息',
        icon: 'message',
        action: openSendMessageDialog
      },
      {
        id: 'encrypted-chat',
        label: '加密聊天',
        icon: 'lock',
        action: handleStartEncryptedChat
      },
      {
        id: 'divider-quick',
        divider: true,
        icon: '',
        label: ''
      }
    ]
  },
  {
    id: 'friend-management',
    title: '好友管理',
    items: [
      {
        id: 'set-favorite',
        label: '设为特别关注',
        icon: 'star',
        action: handleSetFavorite
      },
      {
        id: 'set-normal',
        label: '设为普通好友',
        icon: 'user',
        action: handleSetNormal
      },
      {
        id: 'set-blocked',
        label: '设为屏蔽',
        icon: 'block',
        danger: true,
        action: handleSetBlocked
      },
      {
        id: 'divider-friend',
        divider: true,
        icon: '',
        label: ''
      },
      {
        id: 'remove-friend',
        label: '删除好友',
        icon: 'delete',
        danger: true,
        action: handleRemoveFriend
      }
    ]
  },
  {
    id: 'settings',
    title: '设置',
    items: [
      {
        id: 'notifications',
        label: '通知设置',
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
        label: '账号设置',
        icon: 'settings',
        tabId: 'account'
      },
      {
        id: 'link-device',
        label: '设备管理',
        icon: 'device',
        tabId: 'sessions',
        desktopOnly: true
      }
    ]
  },
  {
    id: 'help',
    title: '帮助',
    items: [
      {
        id: 'feedback',
        label: '帮助与反馈',
        icon: 'chat',
        action: () => {
          window.open('https://github.com/nichuanfang/nichuanfang.github.io/issues', '_blank')
        }
      },
      {
        id: 'divider-help',
        divider: true,
        icon: '',
        label: ''
      },
      {
        id: 'home',
        label: '我的主页',
        icon: 'home',
        action: navigateToHome
      }
    ]
  },
  {
    id: 'account',
    title: '账号',
    items: [
      {
        id: 'divider-account',
        divider: true,
        icon: '',
        label: ''
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
  }
]

export function getAllMenuItems(): MenuItem[] {
  const items: MenuItem[] = []
  for (const section of MENU_SECTIONS) {
    items.push(...section.items.filter((item) => !item.divider))
  }
  return items
}

export function getMenuSections(): MenuSection[] {
  return MENU_SECTIONS
}

export function getFilteredSections(isDesktop: boolean): MenuSection[] {
  return MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.desktopOnly && !isDesktop) return false
      if (item.mobileOnly && isDesktop) return false
      return true
    })
  })).filter((section) => section.items.length > 0)
}

export function findMenuItemById(id: string): MenuItem | undefined {
  for (const section of MENU_SECTIONS) {
    const item = section.items.find((item) => item.id === id)
    if (item) return item
  }
  return undefined
}

export function getFilteredMenuItems(isDesktop: boolean): MenuItem[] {
  const sections = getFilteredSections(isDesktop)
  const items: MenuItem[] = []
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.divider) {
        items.push(item)
      }
    }
  }
  return items
}
