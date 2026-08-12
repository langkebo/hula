import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from '@/composables/chat/useMessage'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileMessageActions')

/**
 * 移动端会话操作 composable
 * 负责:删除/置顶/已读未读/下拉刷新 + matrix 同步事件订阅
 *
 * 注:maskHandler.close 由调用方在每次操作结束时触发,以便联动长按菜单状态
 */
export function useMobileMessageActions(opts: {
  maskHandler: { close: () => void }
  currentLongPressItem: { value: SessionItem | null }
}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { handleMsgDelete } = useMessage()
  const chatStore = useChatStore()
  const contactStore = useContactStore()
  const globalStore = useGlobalStore()

  const loading = ref(false)
  const refreshCount = ref(0)

  const handleDelete = async (item: SessionItem | null) => {
    if (!item) return
    try {
      await handleMsgDelete(item.roomId)
    } catch (error) {
      logger.error('删除会话失败:', error)
    } finally {
      opts.maskHandler.close()
    }
  }

  const handleToggleTop = async (item: SessionItem | null) => {
    if (!item) return
    try {
      const newTopState = !item.top
      await matrixSessionService.setSessionTop(item.roomId, newTopState)
      chatStore.updateSession(item.roomId, { top: newTopState })
    } catch (error) {
      logger.error('置顶操作失败:', error)
    } finally {
      opts.maskHandler.close()
    }
  }

  const handleToggleReadStatus = async (markAsRead: boolean, sessionItem?: SessionItem | null) => {
    const targetItem = sessionItem || opts.currentLongPressItem.value
    if (!targetItem) return

    const item = targetItem
    const previousUnreadCount = item.unreadCount

    try {
      const unreadCount = markAsRead ? 0 : 1
      const successMsg = markAsRead ? t('mobile_home.marked_as_read') : t('mobile_home.marked_as_unread')

      chatStore.updateSession(item.roomId, { unreadCount })
      globalStore.updateGlobalUnreadCount()

      if (markAsRead) {
        await matrixReceiptService.markRoomAsRead(item.roomId)
      }

      showFeedback(successMsg, 'success')
    } catch (error) {
      chatStore.updateSession(item.roomId, { unreadCount: previousUnreadCount })
      globalStore.updateGlobalUnreadCount()

      const errorMsg = markAsRead ? t('mobile_home.mark_as_read_failed') : t('mobile_home.mark_as_unread_failed')
      showFeedback(errorMsg, 'error')
      logger.error(errorMsg, error)
    } finally {
      opts.maskHandler.close()
    }
  }

  const onRefresh = () => {
    loading.value = true
    refreshCount.value++

    const apiPromise = chatStore.getSessionList(true)
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 500))

    Promise.all([apiPromise, delayPromise])
      .then(([res]) => {
        loading.value = false
        logger.debug('刷新完成', res)
      })
      .catch((error) => {
        loading.value = false
        logger.error('刷新会话列表失败:', error)
      })
  }

  const handleSyncEvent = (payload: { state?: string }) => {
    if (payload?.state === 'PREPARED') {
      contactStore.getContactList(true)
    }
  }

  const handleTimelineEvent = () => {
    contactStore.getContactList(false)
  }

  onMounted(async () => {
    try {
      await chatStore.getSessionList(true)
    } catch (err) {
      logger.error('初始加载会话列表失败:', err)
    }
    try {
      await contactStore.getContactList(true)
    } catch (err) {
      logger.error('初始加载联系人失败:', err)
    }
    matrixClientService.on('sync', handleSyncEvent as (...args: unknown[]) => void)
    matrixClientService.on('timeline', handleTimelineEvent as (...args: unknown[]) => void)
  })

  onUnmounted(() => {
    matrixClientService.off('sync', handleSyncEvent as (...args: unknown[]) => void)
    matrixClientService.off('timeline', handleTimelineEvent as (...args: unknown[]) => void)
  })

  return {
    loading,
    refreshCount,
    handleDelete,
    handleToggleTop,
    handleToggleReadStatus,
    onRefresh
  }
}

export type MobileMessageActionsReturn = ReturnType<typeof useMobileMessageActions>
