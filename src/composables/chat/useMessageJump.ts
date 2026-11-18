import { nextTick, type Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useTimerManager } from '@/utils/TimerManager'

interface UseMessageJumpOptions {
  isLoadingMore: Ref<boolean>
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void
  scrollToMessage?: (messageId: string, options?: { behavior?: ScrollBehavior; index?: number }) => boolean
  currentRoomId: Ref<string | null>
}

/**
 * Handles jumping to a specific message: find in list, load history
 * if needed, scroll to position, and highlight.
 */
export const useMessageJump = ({
  isLoadingMore,
  scrollToIndex,
  scrollToMessage,
  currentRoomId
}: UseMessageJumpOptions) => {
  const chatStore = useChatStore()
  const { showFeedback } = useActionFeedback()
  const { t } = useI18n()
  const timerManager = useTimerManager()

  const activeReply = ref<string>('')

  /**
   * 优先按消息 id 命中已挂载的 DOM，虚拟列表未渲染时退化为按索引滚动，
   * 再由 scrollToMessage 在下一帧校准居中位置。
   */
  const focusMessage = (key: string, index: number): void => {
    const handled = scrollToMessage?.(key, { behavior: 'instant', index }) ?? false
    if (!handled) scrollToIndex(index, 'instant')
    activeReply.value = key
  }

  const jumpToReplyMsg = async (key: string): Promise<void> => {
    // Try to find in current list first
    let messageIndex = chatStore.getMsgIndex(String(key))

    if (messageIndex !== -1) {
      focusMessage(String(key), messageIndex)
      return
    }

    // Set loading flag
    isLoadingMore.value = true
    showFeedback(t('home.chat_main.jump_searching'), 'info')

    // Load history until target found or max attempts reached
    let foundMessage = false
    let attemptCount = 0
    const MAX_ATTEMPTS = 5

    while (!foundMessage && attemptCount < MAX_ATTEMPTS) {
      attemptCount++
      try {
        await chatStore.loadMore()
      } catch {
        // 失败提示已由 store（message.load_messages_failed）+ 历史翻页指示器承担：
        // 这里再弹一次只会造成重复打扰，持久重试入口由 ChatLoadMoreIndicator 提供。
        break
      }
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
        focusMessage(key, messageIndex)
      })
    } else {
      showFeedback(t('home.chat_main.jump_not_found'), 'warning')
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
