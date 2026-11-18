import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useStickyEvents } from '@/composables/room/useStickyEvents'
import { MittEnum } from '@/enums'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChatStickyBanner')

interface UseChatStickyBannerOptions {
  /** 点击横幅时跳到对应消息 */
  jumpToReplyMsg: (eventId: string) => void | Promise<void>
}

/**
 * 粘性事件横幅（MSC4354）与会话切换联动：
 * 房间切换或收到 STICKY_EVENTS_CHANGED 时刷新，设置/取消走 useStickyEvents。
 */
export function useChatStickyBanner(options: UseChatStickyBannerOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const globalStore = useGlobalStore()

  const currentRoomId = computed(() => globalStore.currentSessionRoomId ?? null)
  const stickyFlow = useStickyEvents({ roomId: () => globalStore.currentSessionRoomId ?? null })
  const stickyEvents = stickyFlow.events
  const canSetSticky = stickyFlow.canSetSticky

  /** 消息选择器可见性（横幅「设为粘性事件」按钮触发） */
  const pinSelectorVisible = ref(false)

  const reload = (message: string) => {
    stickyFlow.load().catch((e) => logger.error(message, e))
  }

  // 房间切换时重新加载粘性事件
  watch(
    currentRoomId,
    (newId) => {
      if (newId) reload('Failed to load sticky events:')
    },
    { immediate: true }
  )

  // 监听粘性事件变更事件（设置/清除后刷新横幅）
  const onStickyEventsChanged = (payload: { roomId?: string } | undefined) => {
    if (payload?.roomId && payload.roomId === currentRoomId.value) {
      reload('Failed to refresh sticky events:')
    }
  }
  useMitt.on(MittEnum.STICKY_EVENTS_CHANGED, onStickyEventsChanged)
  onUnmounted(() => {
    useMitt.off(MittEnum.STICKY_EVENTS_CHANGED, onStickyEventsChanged)
  })

  function handleSetSticky() {
    pinSelectorVisible.value = true
  }

  async function handlePinSelect(eventId: string) {
    const ok = await stickyFlow.setStickyEvent(eventId)
    showFeedback(ok ? t('pinned_message.pin_success') : t('pinned_message.pin_failed'), ok ? 'success' : 'error')
    pinSelectorVisible.value = false
  }

  async function handleCancelSticky(eventId: string) {
    // 服务端按 (user, event_type) 存储，取消需回查该条记录的 event_type
    const eventType = stickyEvents.value.find((item) => item.eventId === eventId)?.eventType
    if (!eventType) return
    const ok = await stickyFlow.clearStickyEvent(eventType)
    showFeedback(ok ? t('pinned_message.unpin_success') : t('pinned_message.unpin_failed'), ok ? 'success' : 'error')
  }

  function handleViewStickyEvent(eventId: string) {
    logger.info('View sticky event:', eventId)
    void options.jumpToReplyMsg(eventId)
  }

  return {
    stickyEvents,
    canSetSticky,
    pinSelectorVisible,
    handleSetSticky,
    handlePinSelect,
    handleCancelSticky,
    handleViewStickyEvent
  }
}
