import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { roomOperations } from '@/services/matrix/room/RoomOperations'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePinnedMessage')

/** 置顶消息摘要(纯文本展示用) */
export interface PinnedMessageInfo {
  eventId: string
  sender: string
  body: string
  timestamp: number
  msgtype: string
}

export interface UsePinnedMessageOptions {
  /** 房间 ID,支持 ref / getter / 字符串 */
  roomId: MaybeRefOrGetter<string | null | undefined>
}

/**
 * 跨端置顶消息 composable
 *
 * - 拉取房间内所有置顶 eventId,解析出最近一条消息内容
 * - 用户可临时收起横幅(dismissed),本次会话内有效
 * - 当拉取到新的置顶 eventId 时自动重置 dismissed
 */
export function usePinnedMessage(options: UsePinnedMessageOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const pinnedEventIds = ref<string[]>([])
  const pinnedMessages = ref<PinnedMessageInfo[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const dismissed = ref(false)

  /** 已知置顶 ID 集合,用于检测新拉取到的置顶 */
  const knownPinnedIds = ref<Set<string>>(new Set())

  /** 取时间戳最大的一条作为展示用的最近置顶消息 */
  const latestPinnedMessage = computed<PinnedMessageInfo | null>(() => {
    if (pinnedMessages.value.length === 0) return null
    return [...pinnedMessages.value].sort((a, b) => b.timestamp - a.timestamp)[0]
  })

  const resolveRoomId = (): string | null => {
    const id = toValue(options.roomId)
    return id ? String(id) : null
  }

  /** 从消息体中提取纯文本摘要 */
  const extractBody = (raw: unknown): string => {
    if (typeof raw === 'string') return raw
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (typeof obj.content === 'string') return obj.content
      if (typeof obj.body === 'string') return obj.body
      if (typeof obj.text === 'string') return obj.text
    }
    return ''
  }

  /**
   * 解析单条置顶消息:
   * 1. 优先从 chat store 读取(已加载的消息)
   * 2. 回退到 MatrixMessageService.getRoomMessage
   */
  const resolveMessageInfo = async (roomId: string, eventId: string): Promise<PinnedMessageInfo | null> => {
    // 优先从 chat store 读取
    try {
      const chatStore = useChatStore()
      const cached = chatStore.getMessage(eventId)
      if (cached) {
        return {
          eventId: cached.message.id,
          sender: cached.fromUser.username || cached.fromUser.uid,
          body: extractBody(cached.message.body),
          timestamp: cached.message.sendTime,
          msgtype: cached.message.body.msgtype ?? String(cached.message.type)
        }
      }
    } catch (err) {
      logger.warn('从 chat store 获取消息失败', err)
    }

    // 回退到 MatrixMessageService
    try {
      const event = await matrixMessageService.getRoomMessage(roomId, eventId)
      if (!event) return null
      const content = event.getContent() as Record<string, unknown>
      const senderId = event.getSender() ?? ''
      let senderName = senderId
      try {
        const name = await roomOperations.getMemberDisplayName(roomId, senderId)
        if (name) senderName = name
      } catch {
        /* 使用 senderId 作为兜底 */
      }
      return {
        eventId: event.getId() ?? eventId,
        sender: senderName,
        body: typeof content.body === 'string' ? content.body : '',
        timestamp: event.getTs(),
        msgtype: typeof content.msgtype === 'string' ? content.msgtype : ''
      }
    } catch (err) {
      logger.error(`解析置顶消息 ${eventId} 失败`, err)
      return null
    }
  }

  /** 拉取置顶 eventId 列表并解析最近一条消息 */
  const load = async (): Promise<void> => {
    const roomId = resolveRoomId()
    if (!roomId) {
      pinnedEventIds.value = []
      pinnedMessages.value = []
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      const eventIds = await roomOperations.getPinnedEvents(roomId)

      // 检测新拉取到的置顶 eventId,自动重置 dismissed
      const previousIds = knownPinnedIds.value
      const hasNewPin = eventIds.some((id) => !previousIds.has(id))
      if (hasNewPin) {
        dismissed.value = false
      }
      knownPinnedIds.value = new Set(eventIds)
      pinnedEventIds.value = eventIds

      if (eventIds.length === 0) {
        pinnedMessages.value = []
        return
      }

      // 并发解析所有置顶消息
      const results = await Promise.all(eventIds.map((id) => resolveMessageInfo(roomId, id)))
      pinnedMessages.value = results.filter((r): r is PinnedMessageInfo => r !== null)
    } catch (err) {
      logger.error('加载置顶消息失败', err)
      errorMessage.value = t('pinned_message.load_failed')
    } finally {
      loading.value = false
    }
  }

  /** 重新加载(清空已知 ID 集合) */
  const refresh = async (): Promise<void> => {
    knownPinnedIds.value = new Set()
    await load()
  }

  /** 置顶新消息 */
  const pin = async (eventId: string): Promise<boolean> => {
    const roomId = resolveRoomId()
    if (!roomId || !eventId) {
      showFeedback(t('pinned_message.pin_failed'), 'error')
      return false
    }

    try {
      await roomOperations.pinEvent(roomId, eventId)
      showFeedback(t('pinned_message.pin_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('置顶消息失败', err)
      showFeedback(t('pinned_message.pin_failed'), 'error')
      return false
    }
  }

  /** 取消置顶 */
  const unpin = async (eventId: string): Promise<boolean> => {
    const roomId = resolveRoomId()
    if (!roomId || !eventId) {
      showFeedback(t('pinned_message.unpin_failed'), 'error')
      return false
    }

    try {
      await roomOperations.unpinEvent(roomId, eventId)
      showFeedback(t('pinned_message.unpin_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('取消置顶失败', err)
      showFeedback(t('pinned_message.unpin_failed'), 'error')
      return false
    }
  }

  /** 用户临时收起横幅(本次会话内有效) */
  const dismiss = (): void => {
    dismissed.value = true
  }

  /** 重置临时收起状态 */
  const resetDismiss = (): void => {
    dismissed.value = false
  }

  return {
    pinnedEventIds,
    latestPinnedMessage,
    loading,
    errorMessage,
    dismissed,
    load,
    refresh,
    pin,
    unpin,
    dismiss,
    resetDismiss
  }
}
