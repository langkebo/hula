import { createLogger } from '@/utils/Logger'

const logger = createLogger('SessionListScrollMemory')

/** 会话列表的滚动容器（`SmartVirtualList` 根节点类名，与 setStyle 的锁定逻辑共用同一选择器） */
export const SESSION_LIST_SCROLL_SELECTOR = '.mobile-session-list'

/**
 * 记住会话列表的滚动位置。
 *
 * 为什么需要：`/mobile/message` 在 tab 布局里、`/mobile/chatRoom/*` 在聊天布局里，
 * 进入会话时 tab 布局整体卸载（keep-alive 只覆盖同一 router-view 内的同级页面），
 * 返回时列表被重建、滚动位置归零。微信式的体感是「返回还在原来的位置」。
 *
 * 存模块级变量而不是 sessionStorage：这是纯 UI 瞬时状态，跨刷新/换账号没有意义，
 * 也不该污染持久化存储（换账号后沿用上一个账号的位置反而更怪）。
 */
let rememberedTop = 0

export function useSessionListScrollMemory() {
  /** 记录当前位置（离开列表前调用） */
  const remember = (top: number): void => {
    rememberedTop = Math.max(0, Math.floor(top || 0))
  }

  /**
   * 恢复位置（回到列表且数据已渲染后调用）。
   *
   * @param container 滚动容器；不传时按 {@link SESSION_LIST_SCROLL_SELECTOR} 查一次
   * @returns 是否真的恢复了（容器不存在 / 没有记录时返回 false）
   */
  const restore = (container?: HTMLElement | null): boolean => {
    if (rememberedTop <= 0) return false
    const target = container ?? (document.querySelector(SESSION_LIST_SCROLL_SELECTOR) as HTMLElement | null)
    if (!target) {
      logger.debug('恢复滚动位置跳过：滚动容器尚未渲染')
      return false
    }
    // 虚拟列表刚挂载时高度还没建立，此时写 scrollTop 会被 clamp 成 0（随后列表渲染完仍是 0）。
    // 交给调用方稍后重试，而不是写一个无效值。
    if (target.scrollHeight - target.clientHeight < rememberedTop) return false
    target.scrollTop = rememberedTop
    return target.scrollTop > 0
  }

  const reset = (): void => {
    rememberedTop = 0
  }

  const getRemembered = (): number => rememberedTop

  return { remember, restore, reset, getRemembered }
}
