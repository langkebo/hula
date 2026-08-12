import type { Ref } from 'vue'
import type { ContextMenuItem, MenuContent } from './useContextMenuTypes'

/**
 * 右键菜单二级子菜单逻辑
 *
 * 负责：
 * - 维护子菜单显示状态与激活内容
 * - 鼠标悬停主菜单项时计算子菜单位置（优先右侧，回退下方/上方）
 * - 鼠标离开时延迟判断是否关闭子菜单
 * - 判断菜单项是否需要显示右箭头（存在 children）
 */
export const useContextMenuSubmenu = (options: { content: Ref<MenuContent>; vw: Ref<number>; vh: Ref<number> }) => {
  const { content, vw, vh } = options

  const showSubmenu = ref(false)
  const activeSubmenu = ref<ContextMenuItem[]>([])
  const submenuPosition = ref({
    left: '0px',
    top: '0px'
  })

  /** 重置子菜单状态（主菜单隐藏时调用） */
  const resetSubmenu = () => {
    showSubmenu.value = false
    activeSubmenu.value = []
  }

  /**
   * 鼠标进入主菜单项：检测是否有子菜单，有则计算位置并显示
   */
  const handleMouseEnter = (item: ContextMenuItem, index: number) => {
    const hasChildren = typeof item.children === 'function' ? true : Array.isArray(item.children)
    if (!hasChildren) {
      showSubmenu.value = false
      return
    }

    const children = typeof item.children === 'function' ? item.children(content.value) : item.children
    if (!children || children.length === 0) {
      showSubmenu.value = false
      return
    }

    const menuItem = document.querySelectorAll<HTMLElement>('.menu-item')[index]
    if (!menuItem) {
      showSubmenu.value = false
      return
    }

    const rect = menuItem.getBoundingClientRect()
    const submenuWidth = 120
    const submenuHeight = children.length * 30

    let left = rect.right + 5
    let top = rect.top

    if (rect.right + submenuWidth > vw.value) {
      left = rect.left
      top = rect.bottom + 5
      if (top + submenuHeight > vh.value) {
        top = rect.top - submenuHeight - 5
      }
    } else {
      if (rect.top + submenuHeight > vh.value) {
        top = vh.value - submenuHeight - 10
      }
    }

    submenuPosition.value = {
      left: `${left}px`,
      top: `${top}px`
    }

    activeSubmenu.value = children
    showSubmenu.value = true
  }

  /**
   * 鼠标离开主菜单项：延迟判断是否关闭子菜单
   * 若鼠标移入子菜单则保持显示
   */
  const handleMouseLeave = (e: MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (relatedTarget?.closest('.context-submenu')) {
      return
    }

    setTimeout(() => {
      if (!isMouseInSubmenu(e) && !isMouseInMainMenu(e)) {
        showSubmenu.value = false
      }
    }, 100)
  }

  /** 检查鼠标是否在子菜单内 */
  const isMouseInSubmenu = (e: MouseEvent) => {
    const submenu = document.querySelector('.context-submenu')
    if (!submenu) return false
    const elementsUnderMouse = document.elementsFromPoint(e?.clientX || 0, e?.clientY || 0)
    return elementsUnderMouse.some((el) => el.closest('.context-submenu'))
  }

  /** 检查鼠标是否在主菜单内 */
  const isMouseInMainMenu = (e: MouseEvent) => {
    const mainMenu = document.querySelector('.context-menu')
    if (!mainMenu) return false
    const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY)
    return elementsUnderMouse.some((el) => el.closest('.context-menu'))
  }

  /** 处理子菜单项点击：调用 item.click 并关闭子菜单 */
  const handleSubItemClick = (item: ContextMenuItem) => {
    if (typeof item.click === 'function') {
      item.click(content.value)
    }
    showSubmenu.value = false
  }

  /** 判断菜单项是否需要显示右箭头（存在有效 children） */
  const shouldShowArrow = (item: ContextMenuItem) => {
    const children = typeof item.children === 'function' ? item.children(content.value) : item.children
    return Array.isArray(children) && children.length > 0
  }

  return {
    showSubmenu,
    activeSubmenu,
    submenuPosition,
    handleMouseEnter,
    handleMouseLeave,
    handleSubItemClick,
    shouldShowArrow,
    resetSubmenu
  }
}
