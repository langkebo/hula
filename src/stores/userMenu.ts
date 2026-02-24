import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'

export interface MenuPosition {
  x: number
  y: number
}

export type MenuTrigger = 'left' | 'right' | 'touch'

export const useUserMenuStore = defineStore(StoresEnum.USER_MENU, () => {
  const isOpen = ref(false)
  const position = ref<MenuPosition | null>(null)
  const trigger = ref<MenuTrigger>('left')

  const isContextMenu = computed(() => trigger.value === 'right')

  function openMenu(pos: MenuPosition, menuTrigger: MenuTrigger = 'left'): void {
    position.value = pos
    trigger.value = menuTrigger
    isOpen.value = true
  }

  function closeMenu(): void {
    isOpen.value = false
    position.value = null
    trigger.value = 'left'
  }

  function toggleMenu(pos: MenuPosition, menuTrigger: MenuTrigger = 'left'): void {
    if (isOpen.value) {
      closeMenu()
    } else {
      openMenu(pos, menuTrigger)
    }
  }

  return {
    isOpen,
    position,
    trigger,
    isContextMenu,
    openMenu,
    closeMenu,
    toggleMenu
  }
})

export type UserMenuStore = ReturnType<typeof useUserMenuStore>
