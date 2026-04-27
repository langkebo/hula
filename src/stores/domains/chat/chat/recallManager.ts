/**
 * 撤回消息过期管理模块
 *
 * 管理撤回消息的过期计时器，在到期后自动清理撤回记录
 */
import { reactive } from 'vue'
import { getTimerWorker } from './timerWorker'
import { RECALL_EXPIRATION_TIME, type RecalledMessage } from './types'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RecallManager')

export function createRecallManager() {
  const recalledMessages = reactive<Record<string, RecalledMessage>>({})
  const expirationTimers: Record<string, boolean> = {}
  let timerWorkerListenerAttached = false

  const ensureTimerWorkerListener = () => {
    if (timerWorkerListenerAttached) return
    timerWorkerListenerAttached = true
    getTimerWorker().onmessage = (e) => {
      const { type, msgId } = e.data

      if (type === 'timeout') {
        logger.debug(`消息ID: ${msgId} 已过期`)
        delete recalledMessages[msgId]
        delete expirationTimers[msgId]
      } else if (type === 'allTimersCompleted') {
        logger.debug('撤回消息计时器已全部结束')
      }
    }
  }

  const recordRecallMsg = (data: { messageId: string; content: string; originalType: number; isSelf: boolean }) => {
    ensureTimerWorkerListener()
    const recallTime = Date.now()
    recalledMessages[data.messageId] = {
      messageId: data.messageId,
      content: data.content,
      recallTime,
      originalType: data.originalType
    }

    if (data.isSelf) {
      getTimerWorker().postMessage({
        type: 'startTimer',
        msgId: data.messageId,
        duration: RECALL_EXPIRATION_TIME
      })
    }

    expirationTimers[data.messageId] = true
  }

  const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
    return recalledMessages[msgId]
  }

  const clearAllExpirationTimers = () => {
    for (const msgId in expirationTimers) {
      getTimerWorker().postMessage({
        type: 'clearTimer',
        msgId
      })
    }
    for (const msgId in expirationTimers) {
      delete expirationTimers[msgId]
    }
    for (const msgId in recalledMessages) {
      delete recalledMessages[msgId]
    }
  }

  const cleanupExpiredRecalledMessages = () => {
    const now = Date.now()
    for (const msgId in recalledMessages) {
      const msg = recalledMessages[msgId]
      if (now - msg.recallTime > RECALL_EXPIRATION_TIME) {
        delete recalledMessages[msgId]
        if (expirationTimers[msgId]) {
          getTimerWorker().postMessage({ type: 'clearTimer', msgId })
          delete expirationTimers[msgId]
        }
      }
    }
  }

  return {
    recalledMessages,
    recordRecallMsg,
    getRecalledMessage,
    clearAllExpirationTimers,
    cleanupExpiredRecalledMessages,
    ensureTimerWorkerListener
  }
}
