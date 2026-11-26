import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { useGroupRoleGuard } from './useGroupRoleGuard'

const logger = createLogger('MsgRecallConfirm')

/**
 * 撤回消息确认弹窗
 *
 * 「撤回」是服务端行为：确认后调用 MatrixMessageService.recallMessage 触发
 * redactEvent，再更新本地撤回态。仅本地/失败消息走本地删除，不经过此弹窗。
 */
export const useMsgRecallConfirm = () => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const chatStore = useChatStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  const { canRecallMessage, isRecallExpired } = useGroupRoleGuard()

  /** 提醒框标题 */
  const tips = ref()
  /** 是否显示撤回确认弹窗 */
  const modalShow = ref(false)
  /** 待撤回的消息快照 */
  const pendingMessage = ref<MessageType | null>(null)

  const closeModal = () => {
    modalShow.value = false
    pendingMessage.value = null
  }

  /** 打开撤回确认弹窗（悬浮操作条 / 需要确认的撤回入口） */
  const openRecallConfirm = (item: MessageType) => {
    if (!canRecallMessage(item)) {
      showFeedback(t('message.recall_failed'), 'error')
      return
    }
    if (isRecallExpired(item)) {
      showFeedback(t('menu.recall_expired'), 'warning')
      return
    }
    pendingMessage.value = item
    tips.value = t('message.recall_confirm_content')
    modalShow.value = true
  }

  /** 确认撤回：服务端 redact + 本地撤回态 */
  const handleConfirm = async () => {
    const item = pendingMessage.value
    if (!item) return
    const roomId = item.message.roomId || globalStore.currentSessionRoomId
    if (!roomId) {
      showFeedback(t('message.recall_failed'), 'error')
      return
    }
    const msg = { ...item }
    const originalType = item.message.type
    const originalContent = item.message.body.content
    try {
      await matrixMessageService.recallMessage(roomId, item.message.id)
      const recallUid = userStore.userInfo?.uid ?? ''
      chatStore.recordRecallMsg({
        recallUid,
        msg,
        originalType,
        ...(originalContent === undefined ? {} : { originalContent })
      })
      await chatStore.updateRecallMsg({ recallUid, roomId, msgId: item.message.id })
      closeModal()
      showFeedback(t('message.recall_success'), 'success')
    } catch (error) {
      logger.error('撤回消息失败:', error)
      showFeedback(t('message.recall_failed'), 'error')
    }
  }

  return {
    tips,
    modalShow,
    openRecallConfirm,
    handleConfirm
  }
}
