import { ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import {
  DelayedEventError,
  type DelayedEventErrorReason,
  type DelayedMessageInfo,
  matrixDelayedEventsService
} from '@/services/matrix/messaging/MatrixDelayedEventsService'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DelayedMessages')

function resolveReason(error: unknown): DelayedEventErrorReason {
  return error instanceof DelayedEventError ? error.reason : 'unknown'
}

/**
 * 定时消息的 UI 状态与操作编排。
 *
 * 所有失败路径都保留现有列表（不做乐观删除），并用可判别错误给出明确提示，
 * 满足“取消失败要保留原任务、失败有明确错误”的验收要求。
 */
export function useDelayedMessages() {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  const supported = ref(false)
  const probed = ref(false)
  const items = ref<DelayedMessageInfo[]>([])
  const loading = ref(false)

  const reasonText = (reason: DelayedEventErrorReason): string => t(`delayed_events.errors.${reason}`)

  const probeSupport = async (force = false): Promise<boolean> => {
    supported.value = await matrixDelayedEventsService.isSupported(force)
    probed.value = true
    return supported.value
  }

  const refresh = async (): Promise<void> => {
    if (!supported.value) return
    loading.value = true
    try {
      items.value = await matrixDelayedEventsService.listPending()
    } catch (error) {
      logger.error('Failed to load delayed messages:', error)
      showFeedback(t('delayed_events.feedback.list_failed', { reason: reasonText(resolveReason(error)) }), 'error')
    } finally {
      loading.value = false
    }
  }

  const schedule = async (payload: SendMessagePayload, delayMs: number): Promise<boolean> => {
    try {
      await matrixDelayedEventsService.scheduleMessagePayload(payload, delayMs)
      showFeedback(t('delayed_events.feedback.scheduled'), 'success')
      await refresh()
      return true
    } catch (error) {
      logger.error('Failed to schedule delayed message:', error)
      showFeedback(t('delayed_events.feedback.schedule_failed', { reason: reasonText(resolveReason(error)) }), 'error')
      return false
    }
  }

  const cancel = async (delayId: number): Promise<boolean> => {
    try {
      await matrixDelayedEventsService.cancel(delayId)
      showFeedback(t('delayed_events.feedback.cancelled'), 'success')
      await refresh()
      return true
    } catch (error) {
      logger.error(`Failed to cancel delayed message ${delayId}:`, error)
      // 失败不修改 items：原任务仍在服务端待发，列表必须保留。
      showFeedback(t('delayed_events.feedback.cancel_failed', { reason: reasonText(resolveReason(error)) }), 'error')
      return false
    }
  }

  const sendNow = async (delayId: number): Promise<boolean> => {
    try {
      await matrixDelayedEventsService.sendNow(delayId)
      showFeedback(t('delayed_events.feedback.sent_now'), 'success')
      await refresh()
      return true
    } catch (error) {
      logger.error(`Failed to send delayed message ${delayId} immediately:`, error)
      showFeedback(t('delayed_events.feedback.send_now_failed', { reason: reasonText(resolveReason(error)) }), 'error')
      return false
    }
  }

  const reschedule = async (delayId: number, delayMs: number): Promise<boolean> => {
    try {
      await matrixDelayedEventsService.reschedule(delayId, delayMs)
      showFeedback(t('delayed_events.feedback.rescheduled'), 'success')
      await refresh()
      return true
    } catch (error) {
      logger.error(`Failed to reschedule delayed message ${delayId}:`, error)
      showFeedback(
        t('delayed_events.feedback.reschedule_failed', { reason: reasonText(resolveReason(error)) }),
        'error'
      )
      await refresh()
      return false
    }
  }

  return {
    supported,
    probed,
    items,
    loading,
    probeSupport,
    refresh,
    schedule,
    cancel,
    sendNow,
    reschedule
  }
}
