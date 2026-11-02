import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import type { DelayedMessageInfo } from '@/services/matrix/messaging/MatrixDelayedEventsService'
import { useRoomStore } from '@/stores/domains/chat/room'
/** useDelayedMessages 的返回结构（能力、列表与操作）。 */
export interface DelayedMessagesApi {
  supported: Ref<boolean>
  items: Ref<DelayedMessageInfo[]>
  loading: Ref<boolean>
  probeSupport: (force?: boolean) => Promise<boolean>
  refresh: () => Promise<void>
  cancel: (delayId: number) => Promise<boolean>
  sendNow: (delayId: number) => Promise<boolean>
  reschedule: (delayId: number, delayMs: number) => Promise<boolean>
}

/**
 * 定时消息入口与待发列表的 UI 装配。
 *
 * 从 `MsgInput.vue` 抽离，避免输入框组件继续膨胀；只负责弹窗开关、房间名映射与
 * 「会话就绪后探测能力」的时序，协议与错误语义仍在 `useDelayedMessages` 内。
 */
export function useDelayedMessageEntry(options: {
  roomId: Ref<string>
  delayedMessages: DelayedMessagesApi
  scheduleDelayedMessage: (delayMs: number) => Promise<boolean>
}) {
  const {
    supported: delayedSupported,
    items: delayedItems,
    loading: delayedLoading,
    probeSupport,
    refresh: refreshDelayed,
    cancel: cancelDelayed,
    sendNow: sendDelayedNow,
    reschedule: rescheduleDelayed
  } = options.delayedMessages

  const showDelayedModal = ref(false)
  const roomStore = useRoomStore()
  const delayedRoomNames = computed(() =>
    Object.fromEntries(roomStore.roomList.map((room) => [room.roomId, room.name]))
  )

  const openDelayedModal = async () => {
    showDelayedModal.value = true
    await refreshDelayed()
  }

  const handleScheduleDelayed = async (delayMs: number) => {
    await options.scheduleDelayedMessage(delayMs)
  }

  // 能力探测必须等会话就绪：未初始化 client 时探测只会得到 false，入口会被永久隐藏。
  watch(
    options.roomId,
    async (roomId) => {
      if (!roomId) return
      const supported = await probeSupport()
      if (supported) await refreshDelayed()
    },
    { immediate: true }
  )

  return {
    showDelayedModal,
    delayedSupported,
    delayedItems,
    delayedLoading,
    delayedRoomNames,
    openDelayedModal,
    handleScheduleDelayed,
    cancelDelayed,
    sendDelayedNow,
    rescheduleDelayed,
    refreshDelayed
  }
}
