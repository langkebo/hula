import { onMounted, onUnmounted } from 'vue'
import router from '@/router'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useKeyboardShortcut')

/**
 * 全局键盘快捷键 composable（需求文档 17.3 节）
 *
 * 支持的快捷键：
 * - Ctrl+F / Cmd+F: 聚焦当前中间栏搜索框（派发 `search:focus` 事件）
 * - Esc: 清空当前聚焦的搜索框；若无聚焦输入则 router.back()
 * - ↑/↓: 列表项上下移动（需先注册 listNavigation）
 * - Enter: 选中当前列表项
 * - Alt+←: router.back()
 *
 * 列表导航通过 `registerListNavigation` 注册一个上下文，
 * 同一时刻只有一个列表处于"激活"状态（最后注册的）。
 */

export interface ListNavigationContext {
  /** 列表项总数 */
  itemCount: number
  /** 选中某项时的回调，参数为索引 */
  onSelect: (index: number) => void
  /** 可选：当前激活索引的初始值，默认 0 */
  initialIndex?: number
}

export interface KeyboardShortcutApi {
  /** 注册列表导航上下文，返回取消注册函数 */
  registerListNavigation: (context: ListNavigationContext) => () => void
  /** 当前激活的列表索引（响应式） */
  getActiveIndex: () => number
  /** 手动设置当前激活索引 */
  setActiveIndex: (index: number) => void
}

export function useKeyboardShortcut(): KeyboardShortcutApi {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

  // 当前激活的列表导航上下文
  let activeListContext: ListNavigationContext | null = null
  let activeIndex = 0

  const registerListNavigation = (context: ListNavigationContext) => {
    activeListContext = context
    activeIndex = context.initialIndex ?? 0
    logger.debug(`[KeyboardShortcut] 注册列表导航，itemCount=${context.itemCount}`)

    return () => {
      // 仅在仍是当前上下文时清空，避免被后续注册覆盖后误清
      if (activeListContext === context) {
        activeListContext = null
      }
    }
  }

  const getActiveIndex = () => activeIndex

  const setActiveIndex = (index: number) => {
    if (!activeListContext) return
    const clamped = Math.max(0, Math.min(index, activeListContext.itemCount - 1))
    activeIndex = clamped
  }

  const handleKeydown = (event: KeyboardEvent) => {
    // 1. Ctrl+F / Cmd+F: 聚焦搜索框
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey
    if (ctrlOrCmd && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault()
      logger.info('[KeyboardShortcut] 聚焦搜索框')
      window.dispatchEvent(new CustomEvent('search:focus'))
      return
    }

    // 2. Alt+←: router.back()
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault()
      logger.info('[KeyboardShortcut] Alt+← 触发 router.back()')
      void router.back()
      return
    }

    // 3. Esc: 清空输入框 / router.back()
    if (event.key === 'Escape') {
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement as HTMLElement | null)?.isContentEditable

      if (isInputFocused && activeElement instanceof HTMLInputElement) {
        if (activeElement.value) {
          event.preventDefault()
          activeElement.value = ''
          activeElement.dispatchEvent(new Event('input', { bubbles: true }))
          logger.info('[KeyboardShortcut] Esc 清空搜索框')
          return
        }
        // 输入框已为空，让焦点失焦
        activeElement.blur()
        return
      }

      // 无输入框聚焦：router.back()
      event.preventDefault()
      logger.info('[KeyboardShortcut] Esc 触发 router.back()')
      void router.back()
      return
    }

    // 4. 列表导航：↑/↓/Enter
    if (!activeListContext) return
    const ctx = activeListContext

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = Math.min(activeIndex + 1, ctx.itemCount - 1)
      if (next !== activeIndex) {
        activeIndex = next
        logger.debug(`[KeyboardShortcut] ArrowDown -> index=${activeIndex}`)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = Math.max(activeIndex - 1, 0)
      if (prev !== activeIndex) {
        activeIndex = prev
        logger.debug(`[KeyboardShortcut] ArrowUp -> index=${activeIndex}`)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      logger.info(`[KeyboardShortcut] Enter 选中 index=${activeIndex}`)
      ctx.onSelect(activeIndex)
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    activeListContext = null
  })

  return {
    registerListNavigation,
    getActiveIndex,
    setActiveIndex
  }
}
