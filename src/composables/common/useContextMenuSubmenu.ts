import type { Ref } from 'vue'
import type { ContextMenuItem, MenuContent } from './useContextMenuTypes'

/** 只读/可写 ref 的最小公共形状，兼容 `useTemplateRef` 的返回值 */
interface RefLike<T> {
  value: T
}

/**
 * 右键菜单二级子菜单逻辑
 *
 * 负责：
 * - 维护子菜单显示状态与激活内容
 * - 鼠标悬停主菜单项时计算子菜单位置（优先右侧，回退下方/上方）
 * - 鼠标离开时延迟判断是否关闭子菜单
 * - 键盘展开/收起子菜单（ArrowRight 展开、ArrowLeft/Escape 收起）
 * - 判断菜单项是否需要显示右箭头（存在 children）
 */
export const useContextMenuSubmenu = (options: {
  content: Ref<MenuContent>
  vw: Ref<number>
  vh: Ref<number>
  /** 主菜单容器：按 index 精确定位菜单项，避免禁用项把索引错位 */
  menuEl?: RefLike<HTMLElement | null> | undefined
}) => {
  const { content, vw, vh } = options

  const showSubmenu = ref(false)
  const activeSubmenu = ref<ContextMenuItem[]>([])
  const submenuPosition = ref({
    left: '0px',
    top: '0px'
  })

  /** 子菜单容器（模板 ref），键盘需要把焦点送进子项 */
  const submenuEl = ref<HTMLElement | null>(null)
  /** 当前键盘聚焦的子项索引 */
  const focusedSubIndex = ref(-1)
  /** 当前展开子菜单的主菜单项索引，用于收起后把焦点还回该项 */
  const activeSubmenuIndex = ref(-1)

  /** 按菜单项 id 在主菜单容器内定位，禁用项（menu-item-disabled）也能被正确命中 */
  const resolveMenuItem = (index: number): HTMLElement | null => {
    if (index < 0) return null
    const scope: ParentNode = options.menuEl?.value ?? document
    return scope.querySelector<HTMLElement>(`#menu-item-${index}`)
  }

  const submenuItems = (): HTMLElement[] =>
    Array.from(submenuEl.value?.querySelectorAll<HTMLElement>('.menu-item') ?? [])

  /** 聚焦子菜单第 index 项（越界时收敛到首/末项） */
  const focusSubItem = (index: number) => {
    nextTick(() => {
      const items = submenuItems()
      if (items.length === 0) return
      const nextIndex = Math.max(0, Math.min(index, items.length - 1))
      focusedSubIndex.value = nextIndex
      items[nextIndex]?.focus()
    })
  }

  /** 重置子菜单状态（主菜单隐藏时调用） */
  const resetSubmenu = () => {
    showSubmenu.value = false
    activeSubmenu.value = []
    activeSubmenuIndex.value = -1
    focusedSubIndex.value = -1
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

    const menuItem = resolveMenuItem(index)
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
    activeSubmenuIndex.value = index
    focusedSubIndex.value = -1
    showSubmenu.value = true
  }

  /**
   * 键盘展开子菜单（ArrowRight）：与鼠标共用同一套定位逻辑，
   * 展开成功则把焦点送进第一个子项。
   */
  const openSubmenuByKeyboard = (item: ContextMenuItem, index: number): boolean => {
    handleMouseEnter(item, index)
    if (!showSubmenu.value) return false
    focusSubItem(0)
    return true
  }

  /** 收起子菜单，并把焦点还给展开它的主菜单项 */
  const closeSubmenu = (returnFocusIndex = activeSubmenuIndex.value) => {
    const target = resolveMenuItem(returnFocusIndex)
    showSubmenu.value = false
    focusedSubIndex.value = -1
    nextTick(() => {
      if (target?.isConnected) target.focus({ preventScroll: true })
    })
  }

  /** 子菜单键盘导航：方向键移动、Enter/Space 选择、ArrowLeft/Escape 收起 */
  const handleSubmenuKeydown = (e: KeyboardEvent) => {
    if (!showSubmenu.value) return
    const items = submenuItems()

    switch (e.key) {
      case 'Escape':
      case 'ArrowLeft': {
        e.preventDefault()
        e.stopPropagation()
        closeSubmenu()
        break
      }
      case 'ArrowDown':
      case 'ArrowUp': {
        if (items.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        const current = items.indexOf(document.activeElement as HTMLElement)
        const delta = e.key === 'ArrowDown' ? 1 : -1
        const start = current < 0 ? (delta > 0 ? -1 : 0) : current
        focusSubItem((start + delta + items.length) % items.length)
        break
      }
      case 'Enter':
      case ' ':
      case 'Spacebar': {
        const current = items.indexOf(document.activeElement as HTMLElement)
        const subItem = activeSubmenu.value[current]
        if (!subItem) return
        e.preventDefault()
        e.stopPropagation()
        handleSubItemClick(subItem)
        closeSubmenu()
        break
      }
    }
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
    submenuEl,
    focusedSubIndex,
    handleMouseEnter,
    handleMouseLeave,
    handleSubItemClick,
    shouldShowArrow,
    resetSubmenu,
    openSubmenuByKeyboard,
    closeSubmenu,
    handleSubmenuKeydown
  }
}
