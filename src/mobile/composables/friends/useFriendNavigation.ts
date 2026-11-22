import { showConfirmDialog, showFailToast, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { useMessage } from '@/composables/chat/useMessage'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import router from '@/router'
import { matrixFriendOperations } from '@/services/matrix'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { createLogger } from '@/utils/Logger'

interface FriendNavigationDeps {
  setSelectedItem: (id: string) => void
}

/**
 * 好友页导航：进入会话 / 好友详情、通知中心跳转、删除好友。
 */
export function useFriendNavigation({ setSelectedItem }: FriendNavigationDeps) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const logger = createLogger('FriendsIndex')
  const contactStore = useContactStore()
  const chatStore = useChatStore()
  const { preloadChatRoom } = useMessage()

  const detailsShow = ref(false)

  const toMessage = async () => {
    try {
      await Promise.all([
        contactStore.getApplyPage('friend', true, true),
        contactStore.getApplyPage('group', true, true)
      ])
      await contactStore.getApplyUnReadCount()
    } catch (error) {
      logger.error('Failed to refresh notifications and mark as read', error)
      showFeedback(t('mobile_contact.refresh_notification_failed'), 'error')
    } finally {
      router.push('/mobile/mobileMy/myMessages')
    }
  }

  const handleClick = async (id: string, type: number) => {
    detailsShow.value = true
    setSelectedItem(id)
    const data = {
      context: {
        type: type,
        uid: id
      },
      detailsShow: detailsShow.value
    }
    useMitt.emit(MittEnum.DETAILS_SHOW, data)

    if (type === 1) {
      // 好友列表给的是**对端 uid**，先查它对应的 DM 房间号；
      // 查不到（尚未建过会话）时退回按 uid 深链，由聊天页反查兜底。
      const dmRoomId = chatStore.sessionList.find((item) => item.detailId === id || item.account === id)?.roomId
      if (!dmRoomId) {
        router.push({ name: 'mobileChatMain', params: { roomId: id } })
        return
      }
      try {
        await preloadChatRoom(dmRoomId)
      } catch (error) {
        // 预加载只是加速手段，失败时仍要进入会话，否则用户点击毫无反馈。
        logger.error('Failed to preload chat room, navigating without preload', error)
        showFeedback(t('mobile_contact.open_chat_failed'), 'warning')
      }
      router.push({ name: 'mobileChatMain', params: { roomId: dmRoomId } })
    } else {
      router.push(`/mobile/mobileFriends/friendInfo/${id}`)
    }
  }

  async function handleDeleteContact(uid: string) {
    try {
      await showConfirmDialog({
        title: t('mobile_contact.delete_friend_title'),
        message: t('mobile_contact.delete_friend_confirm')
      })
      showToast({ type: 'loading', message: t('mobile_contact.deleting'), forbidClick: true })
      await matrixFriendOperations.removeFriend(uid)
      showToast({ type: 'success', message: t('mobile_contact.delete_friend_success') })
      await contactStore.getContactList(true)
    } catch (e) {
      if (String(e) !== 'cancel') {
        logger.error('Delete friend failed:', e)
        showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.delete_friend_failed'))
      }
    }
  }

  return { detailsShow, toMessage, preloadChatRoom, handleClick, handleDeleteContact }
}
