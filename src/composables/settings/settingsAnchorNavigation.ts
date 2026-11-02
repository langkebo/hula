import { nextTick } from 'vue'

export const SETTINGS_ANCHOR_HIGHLIGHT_CLASS = 'settings-anchor-highlight'
/** 锚点高亮保留时长（见 UI 优化方案 §5.4） */
export const SETTINGS_ANCHOR_HIGHLIGHT_MS = 2000

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function queryAnchor(anchorId: string): HTMLElement | null {
  // anchorId 来自静态注册表，不含引号等需要转义的字符
  return document.querySelector<HTMLElement>(`[data-settings-anchor="${anchorId}"]`)
}

/**
 * 滚动到设置页二级锚点并短暂高亮。
 *
 * @returns 锚点是否存在；不存在时调用方应降级为仅切换页签
 */
export function scrollToSettingsAnchor(anchorId: string): boolean {
  const target = queryAnchor(anchorId)
  if (!target) return false

  target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  target.classList.add(SETTINGS_ANCHOR_HIGHLIGHT_CLASS)
  window.setTimeout(() => {
    target.classList.remove(SETTINGS_ANCHOR_HIGHLIGHT_CLASS)
  }, SETTINGS_ANCHOR_HIGHLIGHT_MS)
  return true
}

/**
 * 等待页签异步组件挂载后再定位锚点，最多尝试两次。
 */
export async function locateSettingsAnchor(anchorId: string): Promise<boolean> {
  if (scrollToSettingsAnchor(anchorId)) return true
  await nextTick()
  return scrollToSettingsAnchor(anchorId)
}
