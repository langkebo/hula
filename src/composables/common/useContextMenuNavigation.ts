import type { Ref } from 'vue'
import type { ContextMenuItem } from './useContextMenuTypes'

/**
 * 右键菜单键盘导航逻辑
 *
 * 负责：
 * - 维护当前聚焦项索引
 * - 处理 ArrowUp/ArrowDown/Enter/Escape 键盘事件
 * - 菜单显示时自动聚焦容器，隐藏时重置状态
 */
export const useContextMenuNavigation = (options: {
  visibleMenu: Ref<ContextMenuItem[]>
  visibleSpecialMenu: Ref<ContextMenuItem[]>
  showMenu: Ref<boolean>
  onSelect: (item: ContextMenuItem) => void
}) => {
  const { visibleMenu, visibleSpecialMenu, showMenu, onSelect } = options

  const focusedIndex = ref(-1)
  const menuRef = ref<HTMLElement | null>(null)

  const allMenuItems = computed(() => {
    const items: ContextMenuItem[] = []
    if (visibleMenu.value) {
      items.push(...visibleMenu.value)
    }
    if (visibleSpecialMenu.value) {
      items.push(...visibleSpecialMenu.value)
    }
    return items
  })

  const handleMenuKeydown = (e: KeyboardEvent) => {
    const totalItems = allMenuItems.value.length
    if (totalItems === 0) return

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        let nextIndex = focusedIndex.value + 1
        while (nextIndex < totalItems && allMenuItems.value[nextIndex]?.disabled) {
          nextIndex++
        }
        if (nextIndex >= totalItems) {
          nextIndex = 0
          while (nextIndex < totalItems && allMenuItems.value[nextIndex]?.disabled) {
            nextIndex++
          }
        }
        focusedIndex.value = nextIndex < totalItems ? nextIndex : -1
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        let prevIndex = focusedIndex.value - 1
        while (prevIndex >= 0 && allMenuItems.value[prevIndex]?.disabled) {
          prevIndex--
        }
        if (prevIndex < 0) {
          prevIndex = totalItems - 1
          while (prevIndex >= 0 && allMenuItems.value[prevIndex]?.disabled) {
            prevIndex--
          }
        }
        focusedIndex.value = prevIndex >= 0 ? prevIndex : -1
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (focusedIndex.value >= 0 && focusedIndex.value < allMenuItems.value.length) {
          const item = allMenuItems.value[focusedIndex.value]
          if (!item.disabled) {
            onSelect(item)
          }
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        showMenu.value = false
        break
      }
    }
  }

  /** 菜单显示时自动聚焦容器 */
  const focusMenu = () => {
    nextTick(() => {
      focusedIndex.value = -1
      menuRef.value?.focus()
    })
  }

  /** 重置导航状态（菜单隐藏时调用） */
  const resetNavigation = () => {
    focusedIndex.value = -1
  }

  return {
    focusedIndex,
    menuRef,
    allMenuItems,
    handleMenuKeydown,
    focusMenu,
    resetNavigation
  }
}
