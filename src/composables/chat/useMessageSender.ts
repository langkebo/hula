import { useMitt } from '@/composables/common/useMitt'
import { MessageStatusEnum, MittEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { ConnectionState } from '@/services/matrix/MatrixConnectionManager'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageSender')

/**
 * 可以立即发送的传输状态。
 *
 * `CATCHUP` 只是历史消息补齐阶段（SDK 已在正常 sync），发送请求完全可用；
 * 把它排除会让「在线但仍在追历史」时发出的消息被静默塞进离线队列。
 */
const SENDABLE_STATES: ReadonlySet<ConnectionState> = new Set<ConnectionState>(['CONNECTED', 'CATCHUP'])

type SendWithTrackingOptions = {
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

    const matrixState = matrixClientService.getConnectionState()
    const canSend = navigator.onLine && SENDABLE_STATES.has(matrixState)

    if (!canSend) {
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
    } catch (err) {
      logger.error('发送消息失败', err)
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
