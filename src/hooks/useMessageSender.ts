import { MessageStatusEnum, MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { useChatStore } from '@/stores/domains/chat/chat'

export type SendWithTrackingOptions = {
  tempMsgId: string
  payload: SendMessagePayload
  /** 是否在发送成功后更新会话最近活跃时间，默认 true */
  updateSessionActive?: boolean
  /** 是否在状态变更时滚动至底部，默认 true */
  scrollOnUpdate?: boolean
  onSuccess?: (payload: { oldMsgId: string; message: { id: string; body: unknown }; timeBlock: number }) => void
  onError?: (msgId?: string) => void
}

export const useMessageSender = () => {
  const chatStore = useChatStore()

  const sendWithTracking = async (options: SendWithTrackingOptions) => {
    const { tempMsgId, payload, updateSessionActive = true, scrollOnUpdate = true, onSuccess, onError } = options

    if (!navigator.onLine) {
      offlineQueueService.enqueue('message', payload.roomId, {
        tempMsgId,
        payload,
        updateSessionActive,
        scrollOnUpdate
      })
      chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.SENDING })
      return
    }

    try {
      const response = await matrixMessageService.sendStructuredMessage(payload)
      const result = {
        oldMsgId: tempMsgId,
        message: {
          id: response.event_id,
          body: payload.body
        },
        timeBlock: Date.now()
      }

      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SUCCESS,
        newMsgId: response.event_id,
        body: payload.body as Record<string, unknown>,
        timeBlock: result.timeBlock
      })
      if (scrollOnUpdate) {
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }
      onSuccess?.(result)
    } catch {
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.FAILED
      })
      if (scrollOnUpdate) {
        useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      }
      onError?.(tempMsgId)
    }

    if (updateSessionActive) {
      chatStore.updateSessionLastActiveTime(payload.roomId)
    }
  }

  return {
    sendWithTracking
  }
}
