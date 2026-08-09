import { nextTick, type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useTimerManager } from '@/utils/TimerManager'

interface UseMessageJumpOptions {
  isLoadingMore: Ref<boolean>
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void
  currentRoomId: Ref<string | null>
}

/**
 * Handles jumping to a specific message: find in list, load history
 * if needed, scroll to position, and highlight.
 */
export const useMessageJump = ({ isLoadingMore, scrollToIndex, currentRoomId }: UseMessageJumpOptions) => {
  const chatStore = useChatStore()
  const { showFeedback } = useActionFeedback()
  const timerManager = useTimerManager()

  const activeReply = ref<string>('')

  const jumpToReplyMsg = async (key: string): Promise<void> => {
    // Try to find in current list first
    let messageIndex = chatStore.getMsgIndex(String(key))

    if (messageIndex !== -1) {
      scrollToIndex(messageIndex, 'instant')
      activeReply.value = String(key)
      return
    }

    // Set loading flag
    isLoadingMore.value = true
    showFeedback('正在查找消息...', 'info')

    // Load history until target found or max attempts reached
    let foundMessage = false
    let attemptCount = 0
    const MAX_ATTEMPTS = 5

    while (!foundMessage && attemptCount < MAX_ATTEMPTS) {
      attemptCount++
      await chatStore.loadMore()
      messageIndex = chatStore.getMsgIndex(key)

      if (messageIndex !== -1) {
        foundMessage = true
        break
      }

      // Brief delay to avoid rapid-fire requests
      await new Promise<void>((resolve) => {
        timerManager.setTimeout(() => resolve(), 300)
      })
    }

    isLoadingMore.value = false

    if (foundMessage) {
      nextTick(() => {
        scrollToIndex(messageIndex, 'instant')
        activeReply.value = key
      })
    } else {
      showFeedback('无法找到原始消息，可能已被删除或太久远', 'warning')
    }
  }

  const onNavigateToMessage = (payload: { roomId?: string; eventId?: string } | undefined) => {
    if (!payload?.eventId) return
    if (payload.roomId && payload.roomId !== currentRoomId.value) return
    jumpToReplyMsg(payload.eventId)
  }

  /**
   * Clear the active reply highlight with exit animation.
   * Call when the user clicks outside a reply element.
   */
  const clearActiveReply = () => {
    if (!activeReply.value) return
    nextTick(() => {
      const el = document.querySelector('.active-reply') as HTMLElement
      if (el) {
        el.classList.add('reply-exit')
        setTimeout(() => {
          el.classList.remove('reply-exit')
          activeReply.value = ''
        }, 300)
      }
    })
  }

  return {
    activeReply,
    jumpToReplyMsg,
    onNavigateToMessage,
    clearActiveReply
  }
}
