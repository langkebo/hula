import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserMenuStore, type MenuPosition, type MenuTrigger } from '@/stores/userMenu'
import { useSettingsDialogStore, type SettingsTabType } from '@/stores/settingsDialog'
import { useMatrixStore } from '@/stores/matrix'
import { useUserStore } from '@/stores/user'
import { isDesktop } from '@/composables/usePlatform'
import { getFilteredSections, findMenuItemById, setLogoutCallback, setRouterInstance } from './menuConfig'
import { useDialog, useMessage } from 'naive-ui'

export function useUserMenu() {
  const userMenuStore = useUserMenuStore()
  const settingsDialogStore = useSettingsDialogStore()
  const matrixStore = useMatrixStore()
  const userStore = useUserStore()
  const dialog = useDialog()
  const message = useMessage()
  const router = useRouter()

  setRouterInstance(router)

  const isOpen = computed(() => userMenuStore.isOpen)
  const position = computed(() => userMenuStore.position)
  const trigger = computed(() => userMenuStore.trigger)
  const isContextMenu = computed(() => userMenuStore.isContextMenu)

  const menuSections = computed(() => getFilteredSections(isDesktop()))

  setLogoutCallback(async () => {
    showLogoutConfirm()
  })

  function showLogoutConfirm() {
    dialog.warning({
      title: '退出登录',
      content: '确定要退出登录吗？退出后需要重新登录才能使用。',
      positiveText: '确定退出',
      negativeText: '取消',
      onPositiveClick: async () => {
        await handleLogout()
      }
    })
  }

  async function handleLogout() {
    const loading = message.loading('正在退出登录...', { duration: 0 })
    try {
      await matrixStore.logout()
      userStore.clearUser()
      message.success('已退出登录')
      window.location.reload()
    } catch (error) {
      message.error('退出登录失败')
      console.error('[UserMenu] 退出登录失败:', error)
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

  function handleRightClick(event: MouseEvent): void {
    event.preventDefault()
    const pos: MenuPosition = {
      x: event.clientX,
      y: event.clientY
    }
    openMenu(pos, 'right')
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
    handleRightClick,
    handleTouch,
    showLogoutConfirm,
    handleLogout
  }
}
