import { computed, nextTick, type Ref, ref, watch } from 'vue'
import { useContextMenu } from '@/composables/common/useContextMenu'
import { useContextMenuItem } from '@/composables/common/useContextMenuItem'
import { useContextMenuNavigation } from '@/composables/common/useContextMenuNavigation'
import { useContextMenuPosition } from '@/composables/common/useContextMenuPosition'
import { useContextMenuSubmenu } from '@/composables/common/useContextMenuSubmenu'
import type { ContextMenuItem, MenuContent, ReactionEmoji } from '@/composables/common/useContextMenuTypes'
import { useViewport } from '@/composables/common/useViewport'
import { useIsMobile } from '@/composables/usePlatform'

export type ContextMenuControllerProps = {
  content?: MenuContent
  menu?: ContextMenuItem[] | undefined
  emoji: ReactionEmoji[]
  specialMenu?: ContextMenuItem[] | undefined
}

type ContextMenuControllerOptions = {
  props: ContextMenuControllerProps
  contextMenuRef: Ref
  menuRef: Readonly<Ref<HTMLElement | null>>
  onSelect: (item: ContextMenuItem) => void
  onReplyEmoji: (item: ReactionEmoji) => void
  onMenuShow: (show: boolean) => void
}

/**
 * ContextMenu 的行为编排：可见项过滤、定位、子菜单、键盘导航与过渡动画。
 * 组件只保留模板、props/emits 声明与 ref 绑定，逻辑全部在此收敛。
 */
export function useContextMenuController(options: ContextMenuControllerOptions) {
  const { props, contextMenuRef, menuRef, onSelect, onReplyEmoji, onMenuShow } = options

  const isMobileRef = useIsMobile()
  const showAllEmojis = ref(false)

  const visibleMenu = computed(() => {
    return (props.menu ?? []).filter((item) => {
      if (typeof item.visible === 'function') {
        return item.visible(props.content)
      }
      return true
    })
  })

  const visibleSpecialMenu = computed(() => {
    return (props.specialMenu ?? []).filter((item) => {
      if (typeof item.visible === 'function') {
        return item.visible(props.content)
      }
      return true
    })
  })

  /** 移动端只渲染显式标记 mobile 的扩展项，保持桌面端菜单行为不变 */
  const mobileSpecialMenu = computed(() => {
    return visibleSpecialMenu.value.filter((item) => {
      if (item.mobile !== true) return false
      if (typeof item.mobileVisible === 'function') {
        return item.mobileVisible(props.content)
      }
      return true
    })
  })

  const isNull = computed(() => props.menu === void 0)
  const { x, y, showMenu, handleContextMenu, restoreOpenerFocus } = useContextMenu(contextMenuRef, isNull)

  watch(
    () => showMenu.value,
    (newVal) => {
      onMenuShow(newVal)
    },
    { immediate: true }
  )

  const { vw, vh } = useViewport()
  const contentRef = computed(() => props.content)

  function handleClick(item: ContextMenuItem) {
    if (isMenuItemDisabled(item)) return
    nextTick(() => {
      showMenu.value = false
      onSelect(item)
    })
  }

  function handleReplyEmoji(item: ReactionEmoji) {
    if (!item) return
    nextTick(() => {
      showMenu.value = false
      onReplyEmoji(item)
    })
  }

  const { getMenuItemProp, isDangerousItem, isMenuItemDisabled } = useContextMenuItem(contentRef)

  const emojiCount = computed(() => props.emoji.length)
  const { pos, emojiMenuPosition, handleSize } = useContextMenuPosition({
    x,
    y,
    vw,
    vh,
    showAllEmojis,
    emojiCount
  })

  // 菜单容器必须通过模板引用交给键盘导航：不注入时 focusMenu() 的 menuRef 恒为
  // null ⇒ 右键菜单打开后焦点停在触发元素上，ArrowDown / Escape 都不会进到
  // @keydown 处理器（键盘不可用）。
  const menuElRef = computed(() => menuRef.value)

  const {
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
    handleSubmenuKeydown
  } = useContextMenuSubmenu({ content: contentRef, vw, vh, menuEl: menuElRef })

  /** 子菜单模板 ref 的 setter：字符串 ref 无法被类型检查识别为「使用」 */
  const setSubmenuEl = (el: unknown) => {
    submenuEl.value = el instanceof HTMLElement ? el : null
  }

  const {
    focusedIndex,
    allMenuItems,
    handleMenuKeydown: navigateMenuKeydown,
    focusMenu,
    resetNavigation
  } = useContextMenuNavigation({
    visibleMenu,
    visibleSpecialMenu,
    showMenu,
    onSelect: handleClick,
    // disabled 支持函数式（如「撤回」是否超时），键盘跳过必须与渲染态同源
    isItemDisabled: isMenuItemDisabled,
    menuRef,
    // 键盘关闭后焦点回到右键触发元素（WCAG 2.4.3）
    onKeyboardDismiss: restoreOpenerFocus
  })

  /** 主菜单键盘入口：ArrowRight 展开当前项的子菜单，其余交给通用导航 */
  const handleMenuKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' && !showSubmenu.value) {
      const index = focusedIndex.value
      const item = allMenuItems.value[index]
      if (item && !isMenuItemDisabled(item) && shouldShowArrow(item)) {
        e.preventDefault()
        openSubmenuByKeyboard(item, index)
        return
      }
    }
    navigateMenuKeydown(e)
  }

  watch(
    () => showMenu.value,
    (newVal) => {
      if (!newVal) {
        resetSubmenu()
        showAllEmojis.value = false
        resetNavigation()
      } else {
        focusMenu()
      }
    }
  )

  const handleBeforeEnter = (el: Element) => {
    const element = el as HTMLElement
    element.style.height = '0'
  }

  const handleEnter = (el: Element) => {
    const element = el as HTMLElement
    element.style.height = 'auto'
    const h = element.clientHeight
    element.style.height = '0'
    requestAnimationFrame(() => {
      element.style.height = `${h}px`
    })
  }

  return {
    isMobileRef,
    showAllEmojis,
    visibleMenu,
    visibleSpecialMenu,
    mobileSpecialMenu,
    showMenu,
    handleContextMenu,
    pos,
    emojiMenuPosition,
    handleSize,
    handleClick,
    handleReplyEmoji,
    getMenuItemProp,
    isDangerousItem,
    isMenuItemDisabled,
    showSubmenu,
    activeSubmenu,
    submenuPosition,
    setSubmenuEl,
    focusedSubIndex,
    handleMouseEnter,
    handleMouseLeave,
    handleSubItemClick,
    shouldShowArrow,
    handleSubmenuKeydown,
    focusedIndex,
    handleMenuKeydown,
    handleBeforeEnter,
    handleEnter
  }
}
