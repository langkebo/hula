import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useClipboard } from '@/composables/common/useClipboard'
import { useMitt } from '@/composables/common/useMitt'
import { MarkEnum, MittEnum } from '@/enums'
import { matrixEventService } from '@/services/matrix/MatrixEventService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixReactionService } from '@/services/matrix/messaging/MatrixReactionService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'
import { getBodyContent } from '@/utils/messageBody'

const logger = createLogger('MessageActionHandlers')

/**
 * 消息右键菜单动作处理器。
 *
 * 设计原则：
 * - 所有 SDK 调用都通过 service 层，不直接 fetch
 * - 状态变更通过 messageStore（chatStore）调用
 * - 撤回/删除使用 window.$dialog.warning 二次确认
 * - 错误反馈使用 useActionFeedback.showFeedback
 */
export function useMessageActionHandlers() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { write: writeClipboard } = useClipboard()
  const chatStore = useChatStore()

  /** 回复：触发回复事件 */
  const handleReply = (message: MessageType) => {
    useMitt.emit(MittEnum.REPLY_MEG, message)
  }

  /** 复制：将文本写入剪贴板（兼容 content/body/text 字段） */
  const handleCopy = async (message: MessageType) => {
    const text = getBodyContent(message?.message?.body)
    if (!text) {
      showFeedback(t('message.copy_empty'), 'warning')
      return
    }
    try {
      await writeClipboard(text)
      showFeedback(t('message.copy_success'), 'success')
    } catch (err) {
      logger.error('复制失败:', err)
      showFeedback(t('message.copy_failed'), 'error')
    }
  }

  /** 标记：点赞/取消点赞（toggleReaction） */
  const handleMark = async (message: MessageType) => {
    if (!message?.message) return
    try {
      // 默认切换 LIKE 标记
      await matrixReactionService.toggleReaction(message.message.roomId, message.message.id, String(MarkEnum.LIKE))
    } catch (err) {
      logger.error('标记消息失败:', err)
      showFeedback(t('message.mark_failed'), 'error')
    }
  }

  /** 置顶/取消置顶 */
  const handlePin = async (message: MessageType, isPinned: boolean) => {
    if (!message?.message) return
    try {
      if (isPinned) {
        await matrixRoomActionFacade.unpinEvent(message.message.roomId, message.message.id)
        showFeedback(t('message.unpin_success'), 'success')
      } else {
        await matrixRoomActionFacade.pinEvent(message.message.roomId, message.message.id)
        showFeedback(t('message.pin_success'), 'success')
      }
    } catch (err) {
      logger.error('置顶消息失败:', err)
      showFeedback(t('message.pin_failed'), 'error')
    }
  }

  /**
   * 撤回：弹出 warning 确认 → 调用 recallMessage
   * 本地状态由 sync 流自动更新
   */
  const handleRecall = (message: MessageType) => {
    if (!message?.message) return
    const { roomId, id } = message.message

    window.$dialog?.warning({
      title: t('message.recall_confirm_title'),
      content: t('message.recall_confirm_content'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          await matrixMessageService.recallMessage(roomId, id)
          showFeedback(t('message.recall_success'), 'success')
        } catch (err) {
          logger.error('撤回消息失败:', err)
          showFeedback(t('message.recall_failed'), 'error')
        }
      }
    })
  }

  /**
   * 删除：弹出 warning 确认 → 调用 redactEvent → 从本地缓存移除
   */
  const handleDelete = (message: MessageType) => {
    if (!message?.message) return
    const { roomId, id } = message.message

    window.$dialog?.warning({
      title: t('message.delete_confirm_title'),
      content: t('message.delete_confirm_content'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        try {
          await matrixEventService.redactEvent(roomId, id)
          chatStore.deleteMsg(id)
          showFeedback(t('message.delete_success'), 'success')
        } catch (err) {
          logger.error('删除消息失败:', err)
          showFeedback(t('message.delete_failed'), 'error')
        }
      }
    })
  }

  /** 编辑：内联编辑由 MessageEditInline 组件处理，这里只触发 UI */
  const handleEdit = (message: MessageType, openInlineEditor: (message: MessageType) => void) => {
    openInlineEditor(message)
  }

  /** 转发：打开 MessageForwardDialog */
  const handleForward = (
    message: MessageType,
    openForwardDialog: (payload: { sourceRoomId: string; eventIds: string[] }) => void
  ) => {
    if (!message?.message) return
    openForwardDialog({
      sourceRoomId: message.message.roomId,
      eventIds: [message.message.id]
    })
  }

  return {
    handleReply,
    handleCopy,
    handleMark,
    handlePin,
    handleRecall,
    handleDelete,
    handleEdit,
    handleForward
  }
}
