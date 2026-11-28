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

  /**
   * @param forceRefresh 反应变更（自己切换 / 收到他人反应或撤回）后必须走服务端，
   * 本地关系容器可能仍保留已撤回的旧副本，直接读本地会让 chip 复活。
   */
  const getReactions = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<void> => {
    const roomId = options.roomId()
    const eventId = options.eventId()
    if (!roomId || !eventId) return
    try {
      if (!forceRefresh) {
        const local = matrixReactionService.getReactionsForEvent(roomId, eventId)
        if (local.length > 0) {
          reactions.value = local
          return
        }
      }
      // 本地关系容器/时间线都没有：早期回应可能不在 sync 窗口内，向服务端补一次
      reactions.value = (await matrixReactionService.refreshReactions(roomId, eventId)) ?? []
    } catch (err) {
      logger.warn('getReactions failed', err)
    }
  }

  const toggleReaction = async (emoji: string): Promise<void> => {
    const roomId = options.roomId()
    const eventId = options.eventId()
    if (!roomId || !eventId || !emoji) return
    // 同一 emoji 提交中时忽略重复点击，避免并发发出两条相同反应。
    if (pendingEmoji.value === emoji) return

    pendingEmoji.value = emoji
    loading.value = true
    error.value = null
    try {
      await matrixReactionService.toggleReaction(roomId, eventId, emoji)
      // 乐观更新:本地翻转,后续由事件订阅校正；切换后必须回源服务端，避免已撤回副本复活。
      await getReactions({ forceRefresh: true })
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
    // 同一 emoji 提交中时忽略重复点击。
    if (pendingEmoji.value === emoji) return false

    pendingEmoji.value = emoji
    loading.value = true
    try {
      await matrixReactionService.addReaction(roomId, eventId, emoji)
      await getReactions({ forceRefresh: true })
      showFeedback(t('message_container.reaction.add_success'), 'success')
      return true
    } catch (err) {
      logger.error('addReaction failed', err)
      showFeedback(t('message_container.reaction.add_failed'), 'error')
      return false
    } finally {
      loading.value = false
      pendingEmoji.value = null
    }
  }

  const removeReaction = async (reactionEventId: string): Promise<boolean> => {
    const roomId = options.roomId()
    if (!roomId || !reactionEventId) return false

    loading.value = true
    try {
      await matrixReactionService.removeReaction(roomId, reactionEventId)
      await getReactions({ forceRefresh: true })
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
