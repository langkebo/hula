import { useDialog, useMessage } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isDesktop } from '@/composables/usePlatform'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { type SettingsTabType, useSettingsDialogStore } from '@/stores/domains/settings/settingsDialog'
import { type MenuPosition, type MenuTrigger, useUserMenuStore } from '@/stores/domains/user/userMenu'
import { createLogger } from '@/utils/Logger'
import { findMenuItemById, getFilteredSections, setLogoutCallback, setRouterInstance } from './menuConfig'

const logger = createLogger('UserMenu')

export function useUserMenu() {
  const userMenuStore = useUserMenuStore()
  const settingsDialogStore = useSettingsDialogStore()
  const dialog = useDialog()
  const message = useMessage()
  const router = useRouter()
  const { t } = useI18n()

  setRouterInstance(router)

  const isOpen = computed(() => userMenuStore.isOpen)
  const position = computed(() => userMenuStore.position)
  const trigger = computed(() => userMenuStore.trigger)
  const isContextMenu = computed(() => userMenuStore.isContextMenu)

  const menuSections = computed(() => getFilteredSections(isDesktop(), t))

  setLogoutCallback(async () => {
    showLogoutConfirm()
  })

  function showLogoutConfirm() {
    dialog.warning({
      title: t('menu.user_menu.dialogs.logout.title'),
      content: t('menu.user_menu.dialogs.logout.content'),
      positiveText: t('menu.user_menu.dialogs.logout.positive'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        await handleLogout()
      }
    })
  }

  async function handleLogout() {
    const loading = message.loading(t('menu.user_menu.dialogs.logout.loading'), { duration: 0 })
    try {
      await sessionOrchestrator.logoutCurrentSession()
      message.success(t('menu.user_menu.dialogs.logout.success'))
      window.location.reload()
    } catch (error) {
      message.error(t('menu.user_menu.dialogs.logout.failed'))
      logger.error('Failed to log out:', error)
    } finally {
      loading.destroy()
    }
  }

  function openMenu(pos: MenuPosition, menuTrigger: MenuTrigger = 'left'): void {
    userMenuStore.openMenu(pos, menuTrigger)
  }

  function closeMenu(): void {
    userMenuStore.closeMenu()
  }

  function toggleMenu(pos: MenuPosition, menuTrigger: MenuTrigger = 'left'): void {
    userMenuStore.toggleMenu(pos, menuTrigger)
  }

  function handleMenuItemClick(itemId: string): void {
    const item = findMenuItemById(itemId)
    if (!item || item.disabled) return

    if (item.tabId) {
      settingsDialogStore.openDialog(item.tabId)
    } else if (item.action) {
      item.action()
    }

    closeMenu()
  }

  function openSettings(tab?: SettingsTabType): void {
    settingsDialogStore.openDialog(tab)
    closeMenu()
  }

  function handleLeftClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const pos: MenuPosition = {
      x: rect.left,
      y: rect.bottom + 4
    }
    toggleMenu(pos, 'left')
  }

  function handleTouch(event: TouchEvent): void {
    const touch = event.touches[0]
    const pos: MenuPosition = {
      x: touch.clientX,
      y: touch.clientY
    }
    openMenu(pos, 'touch')
  }

  return {
    isOpen,
    position,
    trigger,
    isContextMenu,
    menuSections,
    openMenu,
    closeMenu,
    toggleMenu,
    handleMenuItemClick,
    openSettings,
    handleLeftClick,
    handleTouch,
    showLogoutConfirm,
    handleLogout
  }
}
