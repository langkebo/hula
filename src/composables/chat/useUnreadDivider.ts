import { computed, ref, watch } from 'vue'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useSessionUnreadStore } from '@/stores/domains/chat/sessionUnread'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'

/**
 * 未读分隔线插入位置。
 * 进入会话的瞬间快照未读边界：随后 markRead 会把 lastRead 推到最新，
 * 快照保证分隔线不会在打开会话后立即消失。
 */
export function useUnreadDividerIndex() {
  const chatStore = useChatStore()
  const sessionStore = useSessionStore()
  const sessionUnreadStore = useSessionUnreadStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()

  /** -1 表示不显示；0 表示已加载消息全部未读（首次进入、无已读时间戳） */
  const dividerTime = ref(-1)

  watch(
    () => globalStore.currentSessionRoomId,
    (roomId) => {
      dividerTime.value = -1
      if (!roomId) return

      const uid = userStore.userInfo?.uid ?? ''
      if (!uid) return

      const sessionUnread = sessionStore.sessionList.find((item) => item.roomId === roomId)?.unreadCount ?? 0
      const ledgerUnread = sessionUnreadStore.cacheStore[uid]?.[roomId]?.count ?? 0
      if (sessionUnread <= 0 && ledgerUnread <= 0) return

      dividerTime.value = sessionUnreadStore.lastReadActiveTimeStore[uid]?.[roomId] ?? 0
    },
    { immediate: true, flush: 'sync' }
  )

  // 首条 sendTime 大于已读时间戳的消息；全部早于边界则不显示
  return computed(() => {
    if (dividerTime.value < 0) return -1
    return chatStore.chatMessageList.findIndex((item) => (item.message.sendTime ?? 0) > dividerTime.value)
  })
}
