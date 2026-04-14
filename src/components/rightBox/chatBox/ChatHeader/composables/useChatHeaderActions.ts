import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useContactStore } from '@/stores/contacts'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { matrixRoomService } from '@/services/matrix/MatrixRoomService'
import { matrixGroupService } from '@/services/matrix/MatrixGroupService'
import { matrixUserService } from '@/services/matrix/MatrixUserService'
import { matrixSyncService } from '@/services/matrix/MatrixSyncService'
import { matrixFriendService } from '@/services/matrix/MatrixFriendService'
import { RoomActEnum, NotificationTypeEnum, RoleEnum, IsAllUserEnum } from '@/enums'
import { showConfirmDialog } from '@/utils/DialogUtils'
import { createLogger } from '@/utils/Logger'
import type { Ref } from 'vue'

const logger = createLogger('ChatHeaderActions')

export function useChatHeaderActions(
  activeItem: Ref<any>,
  currentSessionRoomId: Ref<string>,
  sidebarShow: Ref<boolean>,
  modalShow: Ref<boolean>,
  showQRCodeModal: Ref<boolean>,
  showManageGroupMemberModal: Ref<boolean>,
  tips: Ref<string>,
  optionsType: Ref<RoomActEnum | undefined>,
  localMyName: Ref<string>,
  localRemark: Ref<string>,
  editingGroupName: Ref<string>,
  isEditingGroupName: Ref<boolean>
) {
  const { t } = useI18n()
  const router = useRouter()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const contactStore = useContactStore()
  const chatStore = useChatStore()
  const userStore = useUserStore()

  const isGroupOwner = computed(() => {
    const session = activeItem.value
    if (!session || currentSessionRoomId.value === '1' || session.hotFlag === IsAllUserEnum.YES) {
      return false
    }
    const currentUser = groupStore.userList.find((user) => user.uid === userStore.userInfo!.uid)
    return currentUser?.roleId === RoleEnum.LORD
  })

  const handleSidebarShow = () => {
    sidebarShow.value = !sidebarShow.value
  }

  const handleHideSidebar = () => {
    sidebarShow.value = false
  }

  const handleModalShow = (type: RoomActEnum, tip: string) => {
    optionsType.value = type
    tips.value = tip
    modalShow.value = true
  }

  const handleModalConfirm = async () => {
    if (!optionsType.value) return

    try {
      switch (optionsType.value) {
        case RoomActEnum.DELETE:
          await handleDeleteRoom()
          break
        case RoomActEnum.EXIT:
          await handleExitGroup()
          break
        case RoomActEnum.DISSOLVE:
          await handleDissolveGroup()
          break
        case RoomActEnum.DELETE_FRIEND:
          await handleDeleteFriend()
          break
      }
      modalShow.value = false
      sidebarShow.value = false
    } catch (error) {
      logger.error('操作失败:', error)
    }
  }

  const handleDeleteRoom = async () => {
    if (!currentSessionRoomId.value) return

    try {
      await matrixRoomService.deleteRoomFromStore(currentSessionRoomId.value)
      chatStore.removeSession(currentSessionRoomId.value)
      globalStore.updateCurrentSessionRoomId('')
      router.push('/')
    } catch (error) {
      logger.error('删除会话失败:', error)
    }
  }

  const handleExitGroup = async () => {
    if (!currentSessionRoomId.value) return

    try {
      await matrixGroupService.leaveGroup(currentSessionRoomId.value)
      await handleDeleteRoom()
    } catch (error) {
      logger.error('退出群组失败:', error)
    }
  }

  const handleDissolveGroup = async () => {
    if (!currentSessionRoomId.value) return

    try {
      await matrixGroupService.dissolveGroup(currentSessionRoomId.value)
      await handleDeleteRoom()
    } catch (error) {
      logger.error('解散群组失败:', error)
    }
  }

  const handleDeleteFriend = async () => {
    const targetUid = activeItem.value?.detailId
    if (!targetUid) return

    try {
      await matrixFriendService.removeFriend(targetUid)
      contactStore.deleteContact(targetUid)
      await handleDeleteRoom()
    } catch (error) {
      logger.error('删除好友失败:', error)
    }
  }

  const handlePinRoom = async () => {
    if (!currentSessionRoomId.value) return

    try {
      const isPinned = activeItem.value?.isPinned
      await matrixRoomService.setRoomPinStatus(currentSessionRoomId.value, !isPinned)
    } catch (error) {
      logger.error('置顶操作失败:', error)
    }
  }

  const handleMuteNotification = async (type: string) => {
    if (!currentSessionRoomId.value) return

    try {
      if (type === 'shield') {
        await matrixRoomService.setRoomNotificationStatus(
          currentSessionRoomId.value,
          NotificationTypeEnum.NOT_DISTURB,
          true
        )
      } else {
        await matrixRoomService.setRoomNotificationStatus(
          currentSessionRoomId.value,
          NotificationTypeEnum.NOT_DISTURB,
          false
        )
      }
    } catch (error) {
      logger.error('消息设置失败:', error)
    }
  }

  const handleUpdateGroupName = async () => {
    if (!currentSessionRoomId.value || !editingGroupName.value.trim()) return

    try {
      await matrixGroupService.updateGroupName(currentSessionRoomId.value, editingGroupName.value.trim())
      isEditingGroupName.value = false
    } catch (error) {
      logger.error('更新群名失败:', error)
    }
  }

  const handleUpdateMyName = async () => {
    if (!currentSessionRoomId.value) return

    try {
      await matrixGroupService.updateMyGroupName(currentSessionRoomId.value, localMyName.value.trim())
    } catch (error) {
      logger.error('更新我在群里的昵称失败:', error)
    }
  }

  const handleUpdateRemark = async () => {
    const targetUid = activeItem.value?.detailId
    if (!targetUid) return

    try {
      await matrixUserService.setUserRemark(targetUid, localRemark.value.trim())
    } catch (error) {
      logger.error('更新备注失败:', error)
    }
  }

  const handleClearMessages = async () => {
    if (!currentSessionRoomId.value) return

    const confirmed = await showConfirmDialog({
      title: t('home.chat_header.clear_messages_confirm_title'),
      content: t('home.chat_header.clear_messages_confirm_message')
    })

    if (confirmed) {
      try {
        chatStore.clearRoomMessages(currentSessionRoomId.value)
      } catch (error) {
        logger.error('清空消息失败:', error)
      }
    }
  }

  const handleShowQRCode = () => {
    showQRCodeModal.value = true
  }

  const handleShowManageMembers = () => {
    showManageGroupMemberModal.value = true
  }

  const handleStartVideoCall = async () => {
    if (!currentSessionRoomId.value) return

    try {
      await matrixSyncService.startVideoCall(currentSessionRoomId.value)
    } catch (error) {
      logger.error('发起视频通话失败:', error)
    }
  }

  const handleStartVoiceCall = async () => {
    if (!currentSessionRoomId.value) return

    try {
      await matrixSyncService.startVoiceCall(currentSessionRoomId.value)
    } catch (error) {
      logger.error('发起语音通话失败:', error)
    }
  }

  return {
    isGroupOwner,
    handleSidebarShow,
    handleHideSidebar,
    handleModalShow,
    handleModalConfirm,
    handleDeleteRoom,
    handleExitGroup,
    handleDissolveGroup,
    handleDeleteFriend,
    handlePinRoom,
    handleMuteNotification,
    handleUpdateGroupName,
    handleUpdateMyName,
    handleUpdateRemark,
    handleClearMessages,
    handleShowQRCode,
    handleShowManageMembers,
    handleStartVideoCall,
    handleStartVoiceCall,
    t
  }
}
