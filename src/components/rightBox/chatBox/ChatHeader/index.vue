<template>
  <div class="chat-header">
    <ChatHeaderInfo
      :name="roomName"
      :avatar="currentUserAvatar"
      :type="roomTypeValue"
      :member-count="memberCount"
      :is-online="isOnline"
      :status-icon="statusIcon"
      :status-title="statusTitle"
      :is-bot-user="isBotUser"
      :hot-flag="hotFlag"
      @click="handleInfoClick" />

    <ChatHeaderToolbar
      :room-type="roomType"
      @video-call="handleStartVideoCall"
      @voice-call="handleStartVoiceCall"
      @screen-share="handleScreenShare"
      @show-qr-code="handleShowQRCode"
      @toggle-sidebar="handleSidebarShow" />

    <ChatHeaderSidebar
      v-model:visible="sidebarShow"
      v-model:local-my-name="localMyName"
      v-model:local-remark="localRemark"
      :is-group="isGroup"
      :is-group-owner="isGroupOwner"
      :group-name="roomName"
      :member-list="userList"
      :is-pinned="isPinned"
      :show-delete-friend="shouldShowDeleteFriend"
      :message-options="messageSettingOptions"
      @update-name="handleUpdateGroupName"
      @update-my-name="handleUpdateMyName"
      @update-remark="handleUpdateRemark"
      @pin-room="handlePinRoom"
      @mute-change="handleMuteNotification"
      @clear-messages="handleClearMessages"
      @manage-members="handleShowManageMembers"
      @dissolve="handleModalShow(RoomActEnum.DISSOLVE, t('home.chat_header.dissolve_confirm'))"
      @exit="handleModalShow(RoomActEnum.EXIT, t('home.chat_header.exit_confirm'))"
      @delete-friend="handleModalShow(RoomActEnum.DELETE_FRIEND, t('home.chat_header.delete_friend_confirm'))"
      @delete-room="handleModalShow(RoomActEnum.DELETE, t('home.chat_header.delete_room_confirm'))" />

    <n-modal
      v-model:show="modalShow"
      preset="dialog"
      :title="t('common.tip')"
      :content="tips"
      positive-text="确认"
      negative-text="取消"
      @positive-click="handleModalConfirm"
      @negative-click="modalShow = false" />

    <n-modal
      v-model:show="showQRCodeModal"
      preset="card"
      :title="t('home.chat_header.group_qr_code')"
      style="width: 300px">
      <div class="qr-code-container">
        <canvas ref="qrCanvasRef" width="200" height="200"></canvas>
      </div>
      <div class="qr-code-actions">
        <n-button type="primary" block @click="handleShareQRCode">
          {{ t('home.chat_header.share_qr_code') }}
        </n-button>
      </div>
    </n-modal>

    <n-modal
      v-model:show="showManageGroupMemberModal"
      preset="card"
      :title="t('home.chat_header.manage_members')"
      style="width: 500px">
      <ManageGroupMember :room-id="currentSessionRoomId" @close="showManageGroupMemberModal = false" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { RoomActEnum, RoomTypeEnum, NotificationTypeEnum } from '@/enums'
import { matrixRoomService } from '@/services/matrix/MatrixRoomService'
import { matrixGroupService } from '@/services/matrix/MatrixGroupService'
import { matrixSyncService } from '@/services/matrix/MatrixSyncService'
import { generateQRCode } from '@/utils/QRCodeUtils'
import { showConfirmDialog } from '@/utils/DialogUtils'
import { createLogger } from '@/utils/Logger'
import ChatHeaderInfo from './ChatHeaderInfo.vue'
import ChatHeaderToolbar from './ChatHeaderToolbar.vue'
import ChatHeaderSidebar from './ChatHeaderSidebar.vue'
import ManageGroupMember from '@/views/ManageGroupMember.vue'

const logger = createLogger('ChatHeader')
const { t } = useI18n()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const chatStore = useChatStore()
const userStore = useUserStore()

const { currentSession: activeItem, currentSessionRoomId } = storeToRefs(globalStore)

const sidebarShow = ref(false)
const modalShow = ref(false)
const showQRCodeModal = ref(false)
const showManageGroupMemberModal = ref(false)
const tips = ref('')
const optionsType = ref<RoomActEnum | undefined>(undefined)

const isEditingGroupName = ref(false)
const editingGroupName = ref('')
const localMyName = ref('')
const localRemark = ref('')

const qrCanvasRef = ref<HTMLCanvasElement | null>(null)

const isGroup = computed(() => activeItem.value?.type === RoomTypeEnum.GROUP)
const isChannel = computed(() => activeItem.value?.hotFlag === 1 || currentSessionRoomId.value === '1')
const isBotUser = computed(() => activeItem.value?.account === 'BOT')
const roomType = computed(() => activeItem.value?.type)
const roomTypeValue = computed(() => activeItem.value?.type ?? RoomTypeEnum.SINGLE)
const hotFlag = computed(() => activeItem.value?.hotFlag)
const roomName = computed(() => activeItem.value?.name || '')
const memberCount = computed(() => groupStore.userList.length || 0)
const currentUserAvatar = computed(() => activeItem.value?.avatar || '')
const isPinned = computed(() => activeItem.value?.top || false)

const isGroupOwner = computed(() => {
  if (!activeItem.value || currentSessionRoomId.value === '1') return false
  const currentUser = groupStore.userList.find((u) => u.uid === userStore.userInfo?.uid)
  return currentUser?.roleId === 1
})

const shouldShowDeleteFriend = computed(() => {
  if (!activeItem.value || isGroup.value) return false
  return true
})

const isOnline = ref(false)
const statusIcon = ref('')
const statusTitle = ref('')
const hasCustomState = ref(false)

const userList = computed(() => {
  return groupStore.userList.slice(0, 10)
})

const messageSettingOptions = computed(() => [
  { label: t('home.chat_header.message_setting.receive_no_alert'), value: 'notification' },
  { label: t('home.chat_header.message_setting.shield'), value: 'shield' }
])

const handleSidebarShow = () => {
  sidebarShow.value = !sidebarShow.value
}

const handleInfoClick = () => {
  handleSidebarShow()
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
    await handleDeleteRoom()
  } catch (error) {
    logger.error('删除好友失败:', error)
  }
}

const handlePinRoom = async () => {
  if (!currentSessionRoomId.value) return
  try {
    const newPinStatus = !isPinned.value
    await matrixRoomService.setRoomPinStatus(currentSessionRoomId.value, newPinStatus)
  } catch (error) {
    logger.error('置顶操作失败:', error)
  }
}

const handleMuteNotification = async (type: string) => {
  if (!currentSessionRoomId.value) return
  try {
    const shield = type === 'shield'
    await matrixRoomService.setRoomNotificationStatus(
      currentSessionRoomId.value,
      NotificationTypeEnum.NOT_DISTURB,
      shield
    )
  } catch (error) {
    logger.error('消息设置失败:', error)
  }
}

const handleUpdateGroupName = async (name: string) => {
  if (!currentSessionRoomId.value || !name.trim()) return
  try {
    await matrixGroupService.updateGroupName(currentSessionRoomId.value, name.trim())
  } catch (error) {
    logger.error('更新群名失败:', error)
  }
}

const handleUpdateMyName = async (name: string) => {
  if (!currentSessionRoomId.value) return
  try {
    await matrixGroupService.updateMyGroupName(currentSessionRoomId.value, name.trim())
  } catch (error) {
    logger.error('更新昵称失败:', error)
  }
}

const handleUpdateRemark = async (remark: string) => {
  const targetUid = activeItem.value?.detailId
  if (!targetUid) return
  try {
    logger.debug('更新备注:', targetUid, remark)
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

const handleShowQRCode = async () => {
  showQRCodeModal.value = true
  await nextTick()

  if (qrCanvasRef.value && currentSessionRoomId.value) {
    const qrData = `matrix:room/${currentSessionRoomId.value}`
    const dataUrl = await generateQRCode(qrData)
    const ctx = qrCanvasRef.value.getContext('2d')
    if (ctx) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, qrCanvasRef.value!.width, qrCanvasRef.value!.height)
      }
      img.src = dataUrl
    }
  }
}

const handleShareQRCode = () => {
  logger.debug('分享二维码')
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

const handleScreenShare = () => {
  logger.debug('屏幕共享')
}

watch(
  () => currentSessionRoomId.value,
  () => {
    if (currentSessionRoomId.value) {
      localMyName.value = groupStore.myNameInCurrentGroup || ''
      localRemark.value = ''
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  min-height: 60px;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.qr-code-actions {
  margin-top: 16px;
}
</style>
