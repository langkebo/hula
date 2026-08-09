import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ErrorType } from '@/common/exception'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, TauriCommand } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

const logger = createLogger('MsgDeleteConfirm')

/**
 * 删除消息确认弹窗
 *
 * 从 useChatMain 抽离：tips/modalShow/delIndex/delRoomId 四个状态只服务于
 * 「右键删除 → 弹窗确认 → 执行删除」这一条闭环，与聊天主逻辑无关。
 */
export const useMsgDeleteConfirm = () => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  /** 提醒框标题 */
  const tips = ref()
  /** 是否显示删除信息的弹窗 */
  const modalShow = ref(false)
  /** 需要删除信息的下标 */
  const delIndex = ref('')
  const delRoomId = ref('')

  /** 打开删除确认弹窗（右键菜单「删除」入口） */
  const openDeleteConfirm = (item: MessageType) => {
    tips.value = t('home.chat_main.delete.confirm')
    modalShow.value = true
    delIndex.value = item.message.id
    delRoomId.value = item.message.roomId
  }

  /** 删除信息事件 */
  const handleConfirm = async () => {
    if (!delIndex.value) return
    const targetRoomId = delRoomId.value || globalStore.currentSessionRoomId
    if (!targetRoomId) {
      showFeedback('无法确定消息所属的会话', 'error')
      return
    }
    try {
      await invokeWithErrorHandler(
        TauriCommand.DELETE_MESSAGE,
        {
          messageId: delIndex.value,
          roomId: targetRoomId
        },
        {
          customErrorMessage: '删除消息失败',
          errorType: ErrorType.Client
        }
      )
      chatStore.deleteMsg(delIndex.value)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: targetRoomId })
      delIndex.value = ''
      delRoomId.value = ''
      modalShow.value = false
      showFeedback('消息已删除', 'success')
    } catch (error) {
      logger.error('删除消息失败:', error)
    }
  }

  return {
    tips,
    modalShow,
    delIndex,
    delRoomId,
    openDeleteConfirm,
    handleConfirm
  }
}
