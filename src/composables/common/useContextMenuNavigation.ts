import type { Ref } from 'vue'
import type { ContextMenuItem } from './useContextMenuTypes'

/** 只读/可写 ref 的最小公共形状，兼容 `useTemplateRef` 的返回值 */
interface RefLike<T> {
  value: T
}

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
  /**
   * 按当前内容解析禁用态（`disabled` 支持函数式，如「撤回」是否已超时）。
   * 未注入时只把静态 `true` 视为禁用。
   */
  isItemDisabled?: ((item: ContextMenuItem) => boolean) | undefined
  /**
   * 菜单容器引用。由调用方用 `useTemplateRef` 绑定后注入；未注入时内部自建，
   * 便于单测直接驱动 `focusMenu()`。
   */
  menuRef?: RefLike<HTMLElement | null> | undefined
}) => {
  const { visibleMenu, visibleSpecialMenu, showMenu, onSelect, isItemDisabled } = options

  const isDisabled = (item: ContextMenuItem): boolean =>
    isItemDisabled ? isItemDisabled(item) : item.disabled === true

  /** 越界按「禁用」处理，便于方向键循环时统一跳过 */
  const isDisabledAt = (index: number): boolean => {
    const item = allMenuItems.value[index]
    return item ? isDisabled(item) : true
  }

  const focusedIndex = ref(-1)
  const menuRef = options.menuRef ?? ref<HTMLElement | null>(null)

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
    // Escape 不依赖菜单项数量：空菜单/全部项被隐藏时也必须能关闭
    if (e.key === 'Escape') {
      e.preventDefault()
      showMenu.value = false
      return
    }

    const totalItems = allMenuItems.value.length
    if (totalItems === 0) return

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        let nextIndex = focusedIndex.value + 1
        while (nextIndex < totalItems && isDisabledAt(nextIndex)) {
          nextIndex++
        }
        if (nextIndex >= totalItems) {
          nextIndex = 0
          while (nextIndex < totalItems && isDisabledAt(nextIndex)) {
            nextIndex++
          }
        }
        focusedIndex.value = nextIndex < totalItems ? nextIndex : -1
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        let prevIndex = focusedIndex.value - 1
        while (prevIndex >= 0 && isDisabledAt(prevIndex)) {
          prevIndex--
        }
        if (prevIndex < 0) {
          prevIndex = totalItems - 1
          while (prevIndex >= 0 && isDisabledAt(prevIndex)) {
            prevIndex--
          }
        }
        focusedIndex.value = prevIndex >= 0 ? prevIndex : -1
        break
      }
      case 'Enter': {
        e.preventDefault()
        const item = allMenuItems.value[focusedIndex.value]
        if (item && !isDisabled(item)) {
          onSelect(item)
        }
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
