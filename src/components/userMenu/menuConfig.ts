import { useDialog } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import type { SettingsTabType } from '@/stores/domains/settings/settingsDialog'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MenuConfig')

type MenuTranslator = (key: string, named?: Record<string, unknown>) => string

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
  titleKey?: string
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
    logger.warn('Router instance not set')
  }
}

function translateMenu(key: string, named?: Record<string, unknown>) {
  const composer = useI18nGlobal()
  return named ? composer.t(key, named) : composer.t(key)
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
    title: translateMenu('menu.user_menu.dialogs.select_friend.title'),
    content: translateMenu('menu.user_menu.dialogs.select_friend.content'),
    positiveText: translateMenu('menu.user_menu.dialogs.select_friend.positive'),
    negativeText: translateMenu('common.cancel'),
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
  const { showFeedback } = useActionFeedback()
  const dialog = useDialog()
  const router = useRouter()

  dialog.warning({
    title: translateMenu('menu.user_menu.dialogs.remove_friend.title'),
    content: translateMenu('menu.user_menu.dialogs.remove_friend.content'),
    positiveText: translateMenu('menu.user_menu.dialogs.remove_friend.positive'),
    negativeText: translateMenu('common.cancel'),
    onPositiveClick: async () => {
      try {
        if (router) {
          router.push('/friend')
        }
        showFeedback(translateMenu('menu.user_menu.dialogs.remove_friend.redirect_hint'), 'info')
      } catch {
        showFeedback(translateMenu('menu.user_menu.dialogs.remove_friend.failed'), 'error')
      }
    }
  })
}

async function handleStartEncryptedChat(): Promise<void> {
  const dialog = useDialog()

  dialog.warning({
    title: translateMenu('menu.user_menu.dialogs.encrypted_chat.title'),
    content: translateMenu('menu.user_menu.dialogs.encrypted_chat.content'),
    positiveText: translateMenu('menu.user_menu.dialogs.encrypted_chat.positive'),
    negativeText: translateMenu('common.cancel'),
    onPositiveClick: () => {
      openFriendManagementDialog()
    }
  })
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    titleKey: 'menu.user_menu.sections.quick_actions',
    items: [
      {
        id: 'send-message',
        label: 'Send Message',
        labelKey: 'menu.user_menu.items.send_message',
        icon: 'message',
        action: openSendMessageDialog
      },
      {
        id: 'encrypted-chat',
        label: 'Encrypted Chat',
        labelKey: 'menu.user_menu.items.encrypted_chat',
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
    title: 'Friend Management',
    titleKey: 'menu.user_menu.sections.friend_management',
    items: [
      {
        id: 'set-favorite',
        label: 'Set Favorite',
        labelKey: 'menu.user_menu.items.set_favorite',
        icon: 'star',
        action: handleSetFavorite
      },
      {
        id: 'set-normal',
        label: 'Set Normal Friend',
        labelKey: 'menu.user_menu.items.set_normal',
        icon: 'user',
        action: handleSetNormal
      },
      {
        id: 'set-blocked',
        label: 'Set Blocked',
        labelKey: 'menu.user_menu.items.set_blocked',
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
        label: 'Remove Friend',
        labelKey: 'menu.user_menu.items.remove_friend',
        icon: 'delete',
        danger: true,
        action: handleRemoveFriend
      }
    ]
  },
  {
    id: 'settings',
    title: 'Settings',
    titleKey: 'menu.user_menu.sections.settings',
    items: [
      {
        id: 'notifications',
        label: 'Notifications',
        labelKey: 'menu.user_menu.items.notifications',
        icon: 'bell',
        tabId: 'notifications'
      },
      {
        id: 'security',
        label: 'Security & Privacy',
        labelKey: 'menu.user_menu.items.security_privacy',
        icon: 'shield',
        tabId: 'securityPrivacy'
      },
      {
        id: 'settings',
        label: 'Account Settings',
        labelKey: 'menu.user_menu.items.account_settings',
        icon: 'settings',
        tabId: 'account'
      },
      {
        id: 'link-device',
        label: 'Device Management',
        labelKey: 'menu.user_menu.items.device_management',
        icon: 'device',
        tabId: 'sessions',
        desktopOnly: true
      }
    ]
  },
  {
    id: 'help',
    title: 'Help',
    titleKey: 'menu.user_menu.sections.help',
    items: [
      {
        id: 'feedback',
        label: 'Help & About',
        labelKey: 'menu.user_menu.items.help_about',
        icon: 'chat',
        tabId: 'helpAbout'
      },
      {
        id: 'divider-help',
        divider: true,
        icon: '',
        label: ''
      },
      {
        id: 'home',
        label: 'My Home',
        labelKey: 'menu.user_menu.items.my_home',
        icon: 'home',
        action: navigateToHome
      }
    ]
  },
  {
    id: 'account',
    title: 'Account',
    titleKey: 'menu.user_menu.sections.account',
    items: [
      {
        id: 'divider-account',
        divider: true,
        icon: '',
        label: ''
      },
      {
        id: 'logout',
        label: 'Sign Out',
        labelKey: 'menu.sign_out',
        icon: 'logout',
        danger: true,
        action: () => {
          if (logoutCallback) {
            logoutCallback()
          } else {
            logger.debug('Logout callback not set')
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

function translateMenuItem(item: MenuItem, t: MenuTranslator): MenuItem {
  if (item.divider || !item.labelKey) {
    return item
  }

  return {
    ...item,
    label: t(item.labelKey)
  }
}

function translateMenuSection(section: MenuSection, t: MenuTranslator): MenuSection {
  return {
    ...section,
    title: section.titleKey ? t(section.titleKey) : section.title,
    items: section.items.map((item) => translateMenuItem(item, t))
  }
}

export function getFilteredSections(isDesktop: boolean, t: MenuTranslator = translateMenu): MenuSection[] {
  return MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.desktopOnly && !isDesktop) return false
      if (item.mobileOnly && isDesktop) return false
      return true
    })
  }))
    .map((section) => translateMenuSection(section, t))
    .filter((section) => section.items.length > 0)
}

export function findMenuItemById(id: string): MenuItem | undefined {
  for (const section of MENU_SECTIONS) {
    const item = section.items.find((item) => item.id === id)
    if (item) return item
  }
  return undefined
}

export function getFilteredMenuItems(isDesktop: boolean, t: MenuTranslator = translateMenu): MenuItem[] {
  const sections = getFilteredSections(isDesktop, t)
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
