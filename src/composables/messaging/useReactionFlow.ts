import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { ReactionInfo } from '@/services/matrix/messaging/MatrixReactionService'
import { matrixReactionService } from '@/services/matrix/messaging/MatrixReactionService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useReactionFlow')

export interface QuickEmoji {
  key: string
  emoji: string
  label: string
}

export const QUICK_EMOJIS: QuickEmoji[] = [
  { key: 'like', emoji: '👍', label: 'like' },
  { key: 'love', emoji: '❤️', label: 'love' },
  { key: 'laugh', emoji: '😂', label: 'laugh' },
  { key: 'wow', emoji: '😮', label: 'wow' },
  { key: 'sad', emoji: '😢', label: 'sad' },
  { key: 'angry', emoji: '😡', label: 'angry' }
]

interface UseReactionFlowOptions {
  roomId: () => string
  eventId: () => string
}

/**
 * 跨端消息反应 composable
 * PC 端 ReactionPicker.vue 与移动端长按菜单共用此逻辑
 */
export function useReactionFlow(options: UseReactionFlowOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const reactions = ref<ReactionInfo[]>([])
  const loading = ref(false)
  const pendingEmoji = ref<string | null>(null)
  const error = ref<string | null>(null)

  const totalReactions = computed(() => reactions.value.reduce((sum, r) => sum + (r.count ?? 0), 0))

  const getReactions = async (): Promise<void> => {
    const roomId = options.roomId()
    const eventId = options.eventId()
    if (!roomId || !eventId) return
    try {
      const list = await matrixReactionService.getReactionsForEvent(roomId, eventId)
      reactions.value = list ?? []
    } catch (err) {
      logger.warn('getReactions failed', err)
    }
  }

  const toggleReaction = async (emoji: string): Promise<void> => {
    const roomId = options.roomId()
    const eventId = options.eventId()
    if (!roomId || !eventId || !emoji) return

    pendingEmoji.value = emoji
    loading.value = true
    error.value = null
    try {
      await matrixReactionService.toggleReaction(roomId, eventId, emoji)
      // 乐观更新:本地翻转,后续由事件订阅校正
      await getReactions()
    } catch (err) {
      logger.error('toggleReaction failed', err)
      error.value = t('message_container.reaction.add_failed')
      showFeedback(error.value, 'error')
    } finally {
      loading.value = false
      pendingEmoji.value = null
    }
  }

  const addReaction = async (emoji: string): Promise<boolean> => {
    const roomId = options.roomId()
    const eventId = options.eventId()
    if (!roomId || !eventId || !emoji) return false

    loading.value = true
    try {
      await matrixReactionService.addReaction(roomId, eventId, emoji)
      await getReactions()
      showFeedback(t('message_container.reaction.add_success'), 'success')
      return true
    } catch (err) {
      logger.error('addReaction failed', err)
      showFeedback(t('message_container.reaction.add_failed'), 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const removeReaction = async (reactionEventId: string): Promise<boolean> => {
    const roomId = options.roomId()
    if (!roomId || !reactionEventId) return false

    loading.value = true
    try {
      await matrixReactionService.removeReaction(roomId, reactionEventId)
      await getReactions()
      showFeedback(t('message_container.reaction.remove_success'), 'success')
      return true
    } catch (err) {
      logger.error('removeReaction failed', err)
      showFeedback(t('message_container.reaction.remove_failed'), 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const findUserReaction = (userId: string, emoji?: string): unknown => {
    const roomId = options.roomId()
    const eventId = options.eventId()
    if (!roomId || !eventId) return null
    // SDK 返回 MatrixEvent | null,这里以 unknown 暴露给 UI 层做进一步处理
    return matrixReactionService.findUserReaction(roomId, eventId, emoji ?? '', userId)
  }

  const reset = (): void => {
    reactions.value = []
    error.value = null
    pendingEmoji.value = null
  }

  onUnmounted(() => {
    reset()
  })

  return {
    // state
    reactions,
    loading,
    pendingEmoji,
    error,
    // getters
    totalReactions,
    // actions
    getReactions,
    toggleReaction,
    addReaction,
    removeReaction,
    findUserReaction,
    reset
  }
}
