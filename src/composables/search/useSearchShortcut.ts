import { onMounted, onUnmounted } from 'vue'
import router from '@/router'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSearchShortcut')

/**
 * 阶段 3：全局搜索快捷键 composable
 *
 * 快捷键规范（参考需求文档 3.3.6）：
 * - Ctrl+F / Cmd+F: 聚焦当前中间栏搜索框（不触发全局搜索，仅聚焦）
 * - Ctrl+Shift+F / Cmd+Shift+F: 触发全局搜索（跳转 /search）
 * - Esc: 清空当前聚焦的搜索框（由各搜索框自身处理）
 *
 * 注意：
 * - Ctrl+F 聚焦行为通过派发自定义事件 `search:focus` 实现，各中间栏搜索框监听该事件并聚焦
 * - 全局搜索跳转后，用户可在右侧栏 SearchPane 中输入关键词
 * - 在 input/textarea 中按 Ctrl+F 仍会触发聚焦中间栏搜索框（符合 IM 应用直觉）
 */
export function useSearchShortcut() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  const handleGlobalSearch = () => {
    logger.info('[SearchShortcut] 触发全局搜索')
    void router.push('/search')
  }

  const handleFocusMiddleSearch = () => {
    logger.info('[SearchShortcut] 聚焦中间栏搜索框')
    // 派发自定义事件，由当前激活的中间栏搜索框监听并聚焦
    window.dispatchEvent(new CustomEvent('search:focus'))
  }

  const handleKeydown = (event: KeyboardEvent) => {
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey
    if (!ctrlOrCmd) return

    // Ctrl+Shift+F / Cmd+Shift+F: 全局搜索
    if (event.shiftKey && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault()
      handleGlobalSearch()
      return
    }

    // Ctrl+F / Cmd+F: 聚焦中间栏搜索框
    if (!event.shiftKey && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault()
      handleFocusMiddleSearch()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}

/**
 * 触发全局搜索并携带初始关键词
 */
export function triggerGlobalSearch(query?: string) {
  const trimmed = query?.trim()
  const target = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search'
  void router.push(target)
}
