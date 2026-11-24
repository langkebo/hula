import type { Pinia } from 'pinia'
import { computed, effectScope, watch } from 'vue'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { sumUnreadCounts } from '@/utils/UnreadCountManager'

/**
 * 移动端系统图标角标同步。
 *
 * 桌面端的角标由 widget 窗口的 global store 与窗口事件驱动；移动端没有 widget 窗口，
 * 会话未读此前只在应用内展示，图标角标从未被驱动（验收项 D1）。这里在平台启动期挂
 * 一个会话未读监听，未读数变化时复用 global store 的 calculateTotal 链路刷新角标，
 * 同时补一次启动刷新以覆盖「登录后直接带未读进入首屏」的场景。
 */
export const startMobileBadgeSync = (piniaInstance: Pinia): (() => void) => {
  const scope = effectScope(true)
  const stopWatch = scope.run(() => {
    const sessionStore = useSessionStore(piniaInstance)
    const globalStore = useGlobalStore(piniaInstance)
    const totalUnread = computed(() => sumUnreadCounts(sessionStore.sessionList))

    globalStore.updateGlobalUnreadCount()
    return watch(totalUnread, () => globalStore.updateGlobalUnreadCount())
  })

  return () => {
    stopWatch?.()
    scope.stop()
  }
}
