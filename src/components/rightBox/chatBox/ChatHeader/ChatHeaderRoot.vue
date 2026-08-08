<template>
  <div class="chat-header">
    <ChatHeaderInfo
      :name="roomName"
      :avatar="currentUserAvatar"
      :type="roomType ?? RoomTypeEnum.SINGLE"
      :is-bot-user="isBotUser"
      :member-count="memberCount"
      :is-online="isOnline"
      :status-icon="statusIcon"
      :status-title="statusTitle"
      :encryption-status="encryptionStatus"
      :has-custom-state="hasCustomState"
      :is-federated="isFederated"
      :federation-server="federationServer"
      @click="handleInfoClick" />

    <ChatHeaderToolbar
      :room-type="roomType"
      :meeting-loading="meetingLoading"
      :private-mode-active="privateModeActive"
      @video-call="handleStartVideoCall"
      @voice-call="handleStartVoiceCall"
      @start-meeting="handleStartMeeting"
      @screen-share="handleScreenShare"
      @show-qr-code="handleShowQRCode"
      @toggle-sidebar="handleSidebarShow"
      @open-in-new-window="handleOpenInNewWindow"
      @toggle-private-mode="handleTogglePrivateMode" />

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
      @delete-friend="handleModalShow(RoomActEnum.DELETE_FRIEND, t('home.chat_header.delete_friend_confirm'))"
      @delete-room="handleModalShow(RoomActEnum.DELETE_RECORD, t('home.chat_header.delete_room_confirm'))" />

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

    <!-- 私密模式确认对话框 -->
    <n-modal
      v-model:show="showPrivateConfirm"
      preset="dialog"
      :title="t('chat.header.private_mode_confirm_title')"
      :positive-text="t('chat.header.private_mode_confirm')"
      :negative-text="t('chat.header.private_mode_cancel')"
      @positive-click="confirmPrivateMode"
      @negative-click="cancelPrivateMode">
      <div class="private-confirm-body">
        <p class="private-confirm-desc">{{ t('chat.header.private_mode_confirm_desc') }}</p>
        <ul class="private-feature-list">
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z" />
            </svg>
            {{ t('chat.header.private_mode_feature_e2ee') }}
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c0 5-4 7-4 12a4 4 0 0 0 8 0c0-5-4-7-4-12z" />
            </svg>
            {{ t('chat.header.private_mode_feature_burn') }}
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
            {{ t('chat.header.private_mode_feature_screenshot') }}
          </li>
          <li>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            {{ t('chat.header.private_mode_feature_no_retention') }}
          </li>
        </ul>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIndependentChatWindow } from '@/composables/chat/useIndependentChatWindow'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { useWindow } from '@/composables/common/useWindow'
import { CallTypeEnum, RoomActEnum, RoomTypeEnum } from '@/enums'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomMemberFacade } from '@/services/matrix/room/MemberFacade'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { extractServerName } from '@/utils/userIdentity'
import ChatHeaderInfo from './ChatHeaderInfo.vue'
import ChatHeaderSidebar from './ChatHeaderSidebar.vue'
import ChatHeaderToolbar from './ChatHeaderToolbar.vue'

const logger = createLogger('ChatHeader')
const { t } = useI18n()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const chatStore = useChatStore()
const userStore = useUserStore()

const { currentSession: activeItem, currentSessionRoomId } = storeToRefs(globalStore)

// 原型对齐项 #7：联邦房间标识（房间 server name 与本地 homeserver 不一致即视为联邦）
const federationServer = computed(() => extractServerName(currentSessionRoomId.value))
const isFederated = computed(() => {
  const roomServer = federationServer.value
  const localServer = extractServerName(matrixClientService.getUserId())
  return Boolean(roomServer) && roomServer !== localServer
})

const sidebarShow = ref(false)
const modalShow = ref(false)
const showQRCodeModal = ref(false)
const tips = ref('')
const optionsType = ref<number | undefined>(undefined)

const isEditingGroupName = ref(false)
const editingGroupName = ref('')
const localMyName = ref('')
const localRemark = ref('')

const qrCanvasRef = ref<HTMLCanvasElement | null>(null)

const isGroup = computed(() => activeItem.value?.type === RoomTypeEnum.GROUP)
const isBotUser = computed(() => activeItem.value?.account === 'BOT')
const roomType = computed(() => activeItem.value?.type)
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
const meetingLoading = ref(false)
const encryptionStatus = ref<'encrypted' | 'unencrypted' | 'unknown' | 'error'>('unknown')
let encryptionStatusRequestId = 0

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
      case RoomActEnum.DELETE_RECORD:
        await handleDeleteRoom()
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
    await matrixRoomActionFacade.leaveRoom(currentSessionRoomId.value)
    chatStore.removeSession(currentSessionRoomId.value)
    globalStore.updateCurrentSessionRoomId('')
  } catch (error) {
    logger.error('删除会话失败:', error)
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
    await matrixRoomActionFacade.setPushRule(currentSessionRoomId.value, newPinStatus)
  } catch (error) {
    logger.error('置顶操作失败:', error)
  }
}

const handleMuteNotification = async (type: string) => {
  if (!currentSessionRoomId.value) return
  try {
    const shield = type === 'shield'
    await matrixRoomActionFacade.setPushRule(currentSessionRoomId.value, !shield)
  } catch (error) {
    logger.error('消息设置失败:', error)
  }
}

const handleUpdateGroupName = async (name: string) => {
  if (!currentSessionRoomId.value || !name.trim()) return
  try {
    await matrixRoomActionFacade.setRoomName(currentSessionRoomId.value, name.trim())
  } catch (error) {
    logger.error('更新群名失败:', error)
  }
}

const handleUpdateMyName = async (name: string) => {
  if (!currentSessionRoomId.value) return
  try {
    await matrixRoomMemberFacade.setMemberDisplayName(currentSessionRoomId.value, name.trim())
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

  if (!window.confirm(t('home.chat_header.clear_messages_confirm_message'))) return

  try {
    chatStore.clearRoomMessages(currentSessionRoomId.value)
  } catch (error) {
    logger.error('清空消息失败:', error)
  }
}

const handleShowQRCode = async () => {
  showQRCodeModal.value = true
  await nextTick()

  if (qrCanvasRef.value && currentSessionRoomId.value) {
    try {
      const QRCode = (await import('qrcode')).default
      await QRCode.toCanvas(qrCanvasRef.value, `matrix:room/${currentSessionRoomId.value}`, { width: 200 })
    } catch (err) {
      logger.error('生成二维码失败:', err)
    }
  }
}

const handleShareQRCode = () => {
  logger.debug('分享二维码')
}

// 原型对齐项 #5：头部通话按钮接真实逻辑（复用项目既有 callWindow + CallView 独立窗口体系）
const { startRtcCall } = useWindow()

// 私密模式：复用已有的 usePrivateMode 单例 composable
const { privateModeActive, showPrivateConfirm, setRoomId, togglePrivateMode, confirmPrivateMode, cancelPrivateMode } =
  usePrivateMode()

const handleTogglePrivateMode = () => {
  setRoomId(currentSessionRoomId.value || '')
  togglePrivateMode()
}

const handleStartVideoCall = async () => {
  if (!currentSessionRoomId.value) return
  await startRtcCall(CallTypeEnum.VIDEO)
}

const handleStartVoiceCall = async () => {
  if (!currentSessionRoomId.value) return
  await startRtcCall(CallTypeEnum.AUDIO)
}

// 屏幕共享在现有架构下只能在通话内进行（无独立发起入口，见优化方案 #5 备注），
// 头部按钮复用视频通话窗口，用户在通话内再开启共享。
const handleScreenShare = async () => {
  if (!currentSessionRoomId.value) return
  await startRtcCall(CallTypeEnum.VIDEO)
}

// 附录 C.6：在新窗口打开当前聊天
const handleOpenInNewWindow = async () => {
  if (!currentSessionRoomId.value) {
    logger.warn('无法在新窗口打开：currentSessionRoomId 为空')
    return
  }
  const { openInNewWindow } = useIndependentChatWindow()
  await openInNewWindow(currentSessionRoomId.value)
}

/**
 * 发起 Jitsi 会议：
 * 1. 从后端取 jitsi 配置（domain + 会议名），失败时用 meet.jit.si + roomId 兜底。
 * 2. 调 createWidget 把会议注册到房间，房内其他成员可在 Widget 列表加入。
 * 3. 本地打开会议页面。
 */
const handleStartMeeting = async () => {
  if (!currentSessionRoomId.value || meetingLoading.value) return
  const roomId = currentSessionRoomId.value
  meetingLoading.value = true
  try {
    const config = (await matrixWidgetService.getJitsiConfig(roomId, false)) as {
      domain?: string
      conf_id?: string
      conferenceId?: string
      auth?: string
    } | null
    const domain = config?.domain || 'meet.jit.si'
    const confId =
      config?.conf_id || config?.conferenceId || `tjg-${roomId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || Date.now()}`
    const meetingUrl = `https://${domain}/${encodeURIComponent(confId)}`

    await matrixWidgetService.createWidget(
      roomId,
      {
        widgetType: 'jitsi',
        url: meetingUrl,
        name: t('home.chat_header.meeting_widget_name'),
        data: { domain, conferenceId: confId, auth: config?.auth }
      },
      false
    )

    await openExternalUrl(meetingUrl)
    logger.info('发起会议:', roomId, meetingUrl)
  } catch (error) {
    logger.error('发起会议失败:', error)
  } finally {
    meetingLoading.value = false
  }
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

watch(
  () => currentSessionRoomId.value,
  async (roomId) => {
    const requestId = ++encryptionStatusRequestId

    if (!roomId) {
      encryptionStatus.value = 'unknown'
      return
    }

    try {
      const encrypted = await cryptoSDKAdapter.isRoomEncrypted(roomId)
      if (requestId !== encryptionStatusRequestId) {
        return
      }
      encryptionStatus.value = encrypted ? 'encrypted' : 'unencrypted'
    } catch (err) {
      if (requestId !== encryptionStatusRequestId) {
        return
      }
      logger.error('读取会话加密状态失败:', err)
      encryptionStatus.value = 'error'
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
  background-color: var(--tjg-surface-panel);
  border-bottom: 1px solid var(--tjg-border-layout-divider);
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

.private-confirm-body {
  padding: 4px 0;
}

.private-confirm-desc {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--tjg-text-secondary);
}

.private-feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--tjg-text-secondary);

    svg {
      color: var(--tjg-color-danger-500);
      flex-shrink: 0;
    }
  }
}
</style>
