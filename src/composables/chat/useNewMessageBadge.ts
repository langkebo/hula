import { computed, nextTick, type Ref, type ShallowRef, watch } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('NewMessageBadge')

interface UseNewMessageBadgeOptions {
  scrollContainerRef:
    | Ref<HTMLElement | null>
    | ShallowRef<HTMLElement | null>
    | Readonly<ShallowRef<HTMLElement | null>>
  isLoadingMore: Ref<boolean>
  shouldShowFloatButton: Ref<boolean>
  scrollToBottom: () => void
  userUid: Ref<string>
}

/**
 * Manages new-message count badge, float button visibility,
 * and the CHAT_SCROLL_BOTTOM mitt listener.
 */
export const useNewMessageBadge = ({
  scrollContainerRef,
  isLoadingMore,
  shouldShowFloatButton,
  scrollToBottom,
  userUid
}: UseNewMessageBadgeOptions) => {
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  const currentNewMsgCount = computed(() => chatStore.currentNewMsgCount || null)

  const newMsgCountLabel = computed(() => {
    if (!currentNewMsgCount.value?.count || currentNewMsgCount.value.count <= 0) return '0'
    return currentNewMsgCount.value.count > 99 ? '99+' : String(currentNewMsgCount.value.count)
  })

  const handleFloatButtonClick = async () => {
    try {
      if (chatStore.chatMessageList.length > 60) {
        await chatStore.resetAndRefreshCurrentRoomMessages()
      }
      scrollToBottom()
    } catch (error) {
      logger.error('重置消息列表失败:', error)
      scrollToBottom()
    }
  }

  // Watch message list for new messages
  watch(
    () => chatStore.chatMessageList,
    async (value, oldValue) => {
      if (value.length <= oldValue.length) return

      const latestMessage = value[value.length - 1]
      if (isLoadingMore.value) return

      const container = scrollContainerRef.value
      if (!container) return

      const isOtherUserMessage =
        latestMessage?.fromUser?.uid && String(latestMessage.fromUser.uid) !== String(userUid.value)

      if (shouldShowFloatButton.value && isOtherUserMessage) {
        const roomId = globalStore.currentSessionRoomId
        const current = chatStore.newMsgCount[roomId]
        if (!current) {
          chatStore.newMsgCount[roomId] = { count: 1, isStart: true }
        } else {
          current.count++
        }
      } else {
        await nextTick()
        scrollToBottom()
      }
    },
    { deep: false }
  )

  // rAF-throttled scroll-to-bottom on mitt event
  let scrollBottomScheduled = false
  useMitt.on(MittEnum.CHAT_SCROLL_BOTTOM, () => {
    if (scrollBottomScheduled) return
    scrollBottomScheduled = true
    requestAnimationFrame(() => {
      scrollBottomScheduled = false
      if (chatStore.chatMessageList.length > 60) {
        chatStore.clearRedundantMessages(globalStore.currentSessionRoomId)
      }
      scrollToBottom()
    })
  })

  return {
    currentNewMsgCount,
    newMsgCountLabel,
    handleFloatButtonClick
  }
}
