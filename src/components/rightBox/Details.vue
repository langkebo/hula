<template>
  <div class="details-panel">
    <section v-if="content.type === RoomTypeEnum.SINGLE" class="single-details">
      <div class="single-details__hero">
        <n-avatar
          round
          :size="148"
          class="single-details__avatar"
          :src="AvatarUtils.getAvatarUrl(singleAvatar)"
          @dblclick="openImageViewer" />
        <h2 class="single-details__name">{{ singleName }}</h2>
        <p class="single-details__uid">{{ singleUid }}</p>
        <p class="single-details__signature">{{ singleSignature }}</p>

        <div v-if="friendStatusLabel" class="single-details__status">
          <n-tag :type="friendStatusTagType" size="small" round>{{ friendStatusLabel }}</n-tag>
        </div>

        <div v-if="lastSeenText" class="single-details__last-seen">
          <span class="single-details__last-seen-label">{{ t('friend.detail.last_seen') }}</span>
          <span class="single-details__last-seen-value">{{ lastSeenText }}</span>
        </div>

        <div class="single-details__meta">
          <span>{{ t('home.chat_details.single.region', { place: t('home.chat_details.single.unknown') }) }}</span>
          <span>账号：{{ singleAccount }}</span>
        </div>
      </div>

      <div v-if="!isBotUser" class="single-details__actions">
        <button class="single-details__action" type="button" @click="handleSendMessage">
          <span class="single-details__action-icon">
            <svg><use href="#message" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('home.chat_details.actions.message') }}</span>
        </button>

        <button class="single-details__action" type="button" @click="handleEncryptedChat">
          <span class="single-details__action-icon single-details__action-icon--encrypted">
            <svg><use href="#lock" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('friend.detail.encrypted_chat') }}</span>
        </button>

        <button class="single-details__action" type="button" @click="handleVoiceCall">
          <span class="single-details__action-icon">
            <svg><use href="#phone" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('home.chat_details.single.footer.audio_call') }}</span>
        </button>

        <button class="single-details__action" type="button" @click="handleVideoCall">
          <span class="single-details__action-icon">
            <svg><use href="#video" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('home.chat_details.single.footer.video_call') }}</span>
        </button>

        <!-- 附录 C.6：在新窗口打开（仅桌面端显示） -->
        <button v-if="!isMobile" class="single-details__action" type="button" @click="handleOpenInNewWindow">
          <span class="single-details__action-icon">
            <svg><use href="#expand" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('chat.header.open_in_new_window', '在新窗口打开') }}</span>
        </button>
      </div>

      <div v-if="!isBotUser" class="single-details__management">
        <InlineEdit
          class="management-section"
          :label="t('friend.detail.note')"
          :value="contactInfo.note || contactInfo.remark || ''"
          :placeholder="t('friend.detail.note_placeholder')"
          :loading="savingNote"
          :edit-aria-label="t('friend.detail.note_section')"
          :maxlength="200"
          @submit="handleSaveNote" />

        <InlineEdit
          class="management-section"
          :label="t('friend.detail.display_name')"
          :value="contactInfo.remark || contactInfo.displayName || ''"
          :placeholder="t('friend.detail.display_name_placeholder')"
          :loading="savingDisplayName"
          :edit-aria-label="t('friend.detail.edit_display_name')"
          :maxlength="100"
          @submit="handleSaveDisplayName" />

        <div class="management-section">
          <div class="management-header">
            <span class="management-label">{{ t('friend.detail.status_section') }}</span>
          </div>
          <div class="management-actions">
            <n-button
              size="small"
              :type="contactInfo.friendStatus === 'favorite' ? 'warning' : 'default'"
              @click="handleSetFavorite">
              {{ t('friend.context.set_favorite') }}
            </n-button>
            <n-button
              size="small"
              :type="!contactInfo.friendStatus || contactInfo.friendStatus === 'normal' ? 'info' : 'default'"
              @click="handleSetNormal">
              {{ t('friend.context.set_normal') }}
            </n-button>
            <n-button
              size="small"
              :type="contactInfo.friendStatus === 'blocked' ? 'error' : 'default'"
              @click="handleSetBlocked">
              {{ t('friend.context.set_blocked') }}
            </n-button>
          </div>
        </div>

        <div class="management-section management-section--danger">
          <n-button size="small" type="error" block @click="handleRemoveFriend">
            {{ t('friend.detail.remove_friend') }}
          </n-button>
        </div>
      </div>
    </section>

    <n-flex v-else-if="content.type === RoomTypeEnum.GROUP" vertical align="center" :size="20" class="group-details">
      <!-- 房间头像（管理员可上传） -->
      <n-upload
        v-if="canManageRoom"
        :max="1"
        accept="image/*"
        :custom-request="handleAvatarUpload"
        :show-file-list="false"
        :disabled="uploadingAvatar">
        <n-image
          object-fit="cover"
          show-toolbar-tooltip
          preview-disabled
          width="120"
          height="120"
          style="border: 2px solid var(--hula-text-inverse)"
          class="rounded-12px select-none cursor-pointer"
          :src="AvatarUtils.getAvatarUrl(item.avatar)"
          alt="群头像" />
      </n-upload>
      <n-image
        v-else
        object-fit="cover"
        show-toolbar-tooltip
        preview-disabled
        width="120"
        height="120"
        style="border: 2px solid var(--hula-text-inverse)"
        class="rounded-12px select-none cursor-pointer"
        :src="AvatarUtils.getAvatarUrl(item.avatar)"
        @dblclick="openImageViewer"
        alt="群头像" />

      <InlineEdit
        class="group-details__name-edit"
        :label="t('home.chat_details.group.name_label')"
        :value="item.name || ''"
        :placeholder="t('room.detail.name_placeholder')"
        :loading="savingRoomName"
        :edit-aria-label="t('home.chat_details.group.edit_name')"
        :maxlength="100"
        @submit="handleSaveRoomName" />

      <div class="single-details__actions single-details__actions--group">
        <button class="single-details__action" type="button" @click="handleSendMessage">
          <span class="single-details__action-icon">
            <svg><use href="#message" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('home.chat_details.actions.message') }}</span>
        </button>

        <button class="single-details__action" type="button" @click="handleVideoCall">
          <span class="single-details__action-icon">
            <svg><use href="#video" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('home.chat_details.single.footer.video_call') }}</span>
        </button>

        <!-- 附录 C.6：在新窗口打开（仅桌面端显示） -->
        <button v-if="!isMobile" class="single-details__action" type="button" @click="handleOpenInNewWindow">
          <span class="single-details__action-icon">
            <svg><use href="#expand" /></svg>
          </span>
          <span class="single-details__action-label">{{ t('chat.header.open_in_new_window', '在新窗口打开') }}</span>
        </button>
      </div>

      <div v-if="announcementContent" class="announcement-container">
        <div class="announcement-header">
          <span class="text-14px">{{ t('home.chat_details.group.announcement.label') }}</span>
          <n-button text type="primary" size="small" @click="handleOpenAnnouncement">
            {{ t('home.chat_details.group.announcement.window_title') }}
          </n-button>
        </div>
        <div class="announcement-content">{{ announcementContent }}</div>
      </div>

      <!-- Step 1.2：完整成员列表（含邀请/踢出/封禁/解封管理） -->
      <div class="group-details__members">
        <RoomMembersPane :room-id="content.uid" :can-manage="canManageRoom" @member-click="handleMemberClick" />
      </div>

      <!-- Step 1.2：房间可见性切换（仅管理员可见） -->
      <div v-if="canManageRoom" class="group-details__visibility">
        <RoomVisibilityToggle :room-id="content.uid" />
      </div>

      <!-- Step 1.2：危险操作区（离开/忘记房间） -->
      <div class="group-details__danger-zone">
        <n-button size="small" type="warning" block @click="handleLeaveRoom">
          {{ t('room.detail.leave_room') }}
        </n-button>
        <n-button size="small" type="error" block ghost @click="handleForgetRoom">
          {{ t('room.detail.forget_room') }}
        </n-button>
      </div>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import type { UploadCustomRequestOptions } from 'naive-ui'
import { storeToRefs } from 'pinia'
import type { PropType } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import RoomMembersPane from '@/components/rightBox/RoomMembersPane.vue'
import RoomVisibilityToggle from '@/components/rightBox/RoomVisibilityToggle.vue'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useEnterChat } from '@/composables/chat/useEnterChat'
import { useIndependentChatWindow } from '@/composables/chat/useIndependentChatWindow'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useWindow } from '@/composables/common/useWindow'
import { CallTypeEnum, MittEnum, OnlineEnum, RoomTypeEnum, UserType } from '@/enums'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('Details')
const { t } = useI18n()
const router = useRouter()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()
const contactStore = useContactStore()
const { startRtcCall } = useWindow()
const { enterChat } = useEnterChat()

const props = defineProps({
  content: {
    type: Object as PropType<{ type: RoomTypeEnum; uid: string }>,
    required: false,
    default: () => ({ type: RoomTypeEnum.SINGLE, uid: '' })
  }
})

const item = ref<
  Partial<MatrixGroupInfo> & {
    myName?: string
    account?: string
    uid?: string
    [key: string]: unknown
  }
>({})
const announcementContent = ref('')
const savingNote = ref(false)
const savingDisplayName = ref(false)
const savingRoomName = ref(false)

const contactInfo = computed<Partial<MatrixContact>>(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !props.content.uid) {
    return {}
  }
  return contactStore.getContactByUserId(props.content.uid) ?? {}
})

const singleName = computed(() => contactInfo.value.name || contactInfo.value.displayName || '未知用户')
const singleUid = computed(() => contactInfo.value.uid || props.content.uid || '')
const singleAccount = computed(
  () => contactInfo.value.account || singleUid.value.replace(/^@/, '').split(':')[0] || '未知'
)
const singleAvatar = computed(() => contactInfo.value.avatar || contactInfo.value.avatarUrl || '')
const singleSignature = computed(() => contactInfo.value.statusMessage || t('home.chat_details.single.empty_signature'))

const isBotUser = computed(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !contactInfo.value.uid) return false
  return contactInfo.value.account === UserType.BOT
})

const friendStatusTagType = computed(() => {
  const status = contactInfo.value.friendStatus
  if (status === 'favorite') return 'warning'
  if (status === 'blocked') return 'error'
  return 'info'
})

const friendStatusLabel = computed(() => {
  const status = contactInfo.value.friendStatus
  if (status === 'favorite') return t('friend.status.favorite')
  if (status === 'blocked') return t('friend.status.blocked')
  if ((status as string) === 'hidden') return t('friend.status.hidden')
  return t('friend.status.normal')
})

const formatDate = (ts: number): string => {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('friend.detail.just_now')
  if (diffMins < 60) return t('friend.detail.minutes_ago', { count: diffMins })
  if (diffHours < 24) return t('friend.detail.hours_ago', { count: diffHours })
  if (diffDays < 7) return t('friend.detail.days_ago', { count: diffDays })
  return date.toLocaleDateString()
}

const lastSeenText = computed(() => {
  if (!contactInfo.value) return ''
  if (contactInfo.value.activeStatus === OnlineEnum.ONLINE) return t('friend.list.online')
  if (contactInfo.value.lastOptTime && contactInfo.value.lastOptTime > 0) {
    return formatDate(contactInfo.value.lastOptTime)
  }
  return ''
})

watch(
  () => [props.content.type, props.content.uid] as const,
  async ([type, uid]) => {
    if (!uid) {
      item.value = {}
      announcementContent.value = ''
      return
    }

    if (type !== RoomTypeEnum.GROUP) {
      item.value = {}
      announcementContent.value = ''
      return
    }

    try {
      const response = await groupStore.loadGroupInfo(uid)
      item.value = (response as typeof item.value) || {}
      await fetchAnnouncement(uid)
    } catch (error) {
      logger.error('获取群组详情失败:', error)
      item.value = {}
      announcementContent.value = ''
    }
  },
  { immediate: true }
)

const fetchAnnouncement = async (_roomId: string) => {
  announcementContent.value = ''
}

const handleOpenAnnouncement = () => {
  if (!item.value?.roomId) return
  useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId: item.value.roomId })
}

const memberCount = computed(() => groupStore.userList.length || 0)

// 当前用户是否有管理权限（创建者或管理员）
const canManageRoom = computed(() => groupStore.isCurrentUserCreator || groupStore.isCurrentUserModerator)

// 头像上传中
const uploadingAvatar = ref(false)

const ensureSessionReady = async () => {
  const uid = props.content.uid
  if (!uid) {
    showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
    return false
  }

  const sessionType = props.content.type === RoomTypeEnum.GROUP ? RoomTypeEnum.GROUP : RoomTypeEnum.SINGLE
  await openMsgSession(uid, sessionType)
  await nextTick()
  return true
}

const handleSendMessage = async () => {
  const uid = props.content.uid
  if (!uid) {
    showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
    return
  }
  // 统一"进入聊天"入口：好友（SINGLE）走 friend 分支，房间（GROUP）走 room 分支
  const targetType = props.content.type === RoomTypeEnum.GROUP ? 'room' : 'friend'
  await enterChat(uid, targetType)
}

const handleVoiceCall = async () => {
  if (!(await ensureSessionReady())) return
  await startRtcCall(CallTypeEnum.AUDIO)
}

const handleVideoCall = async () => {
  if (!(await ensureSessionReady())) return
  await startRtcCall(CallTypeEnum.VIDEO)
}

// 附录 C.6：在新窗口打开当前聊天（群聊直接用 uid 作为 roomId，单聊先进入聊天获取 roomId）
const handleOpenInNewWindow = async () => {
  const { openInNewWindow } = useIndependentChatWindow()
  if (props.content.type === RoomTypeEnum.GROUP) {
    if (!props.content.uid) {
      showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
      return
    }
    await openInNewWindow(props.content.uid)
    return
  }
  // 单聊：先进入聊天，再从 globalStore 获取 roomId
  await handleSendMessage()
  const { currentSessionRoomId } = storeToRefs(useGlobalStore())
  if (currentSessionRoomId.value) {
    await openInNewWindow(currentSessionRoomId.value)
  }
}

const handleEncryptedChat = async () => {
  if (!singleUid.value) return
  try {
    const roomId = await contactStore.startDirectRoom(singleUid.value, true)
    if (roomId) {
      const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
      await openMsgSessionByRoomId(roomId)
    }
  } catch {
    showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
  }
}

const handleSaveNote = async (newValue: string) => {
  if (!singleUid.value || !newValue) return
  savingNote.value = true
  try {
    const success = await contactStore.setFriendNote(singleUid.value, newValue)
    if (success) {
      showFeedback(t('friend.detail.note_saved'), 'success', 'polite')
    }
  } catch {
    showFeedback(t('friend.detail.note_error'), 'error', 'assertive')
  } finally {
    savingNote.value = false
  }
}

const handleSaveDisplayName = async (newValue: string) => {
  if (!singleUid.value || !newValue) return
  savingDisplayName.value = true
  try {
    const success = await contactStore.setFriendDisplayName(singleUid.value, newValue)
    if (success) {
      showFeedback(t('friend.detail.display_name_saved'), 'success', 'polite')
    }
  } catch {
    showFeedback(t('friend.detail.display_name_error'), 'error', 'assertive')
  } finally {
    savingDisplayName.value = false
  }
}

const handleSaveRoomName = async (newValue: string) => {
  const roomId = props.content.uid
  if (!roomId || !newValue) return
  savingRoomName.value = true
  try {
    const success = await groupStore.setRoomName(roomId, newValue)
    if (success) {
      showFeedback(t('room.detail.name_saved'), 'success', 'polite')
    } else {
      showFeedback(t('room.detail.name_error'), 'error', 'assertive')
    }
  } catch {
    showFeedback(t('room.detail.name_error'), 'error', 'assertive')
  } finally {
    savingRoomName.value = false
  }
}

const handleSetFavorite = async () => {
  if (!singleUid.value) return
  await contactStore.setFriendStatus(singleUid.value, 'favorite')
}

const handleSetNormal = async () => {
  if (!singleUid.value) return
  await contactStore.setFriendStatus(singleUid.value, 'normal')
}

const handleSetBlocked = async () => {
  if (!singleUid.value) return
  await contactStore.setFriendStatus(singleUid.value, 'blocked')
}

const handleRemoveFriend = async () => {
  if (!singleUid.value) return
  window.$dialog?.warning({
    title: t('friend.detail.remove_confirm.title'),
    content: t('friend.detail.remove_confirm.content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await contactStore.removeFromContacts(singleUid.value)
      if (success) {
        showFeedback(t('friend.detail.remove_success'), 'success', 'polite')
        // 阶段 2：路由驱动后，关闭详情等价于返回上一视图
        if (window.history.length > 1) {
          void router.back()
        } else {
          void router.push('/friend')
        }
      } else {
        showFeedback(t('friend.detail.remove_error'), 'error', 'assertive')
      }
    }
  })
}

const handleMemberClick = (userId: string) => {
  if (!userId) return
  // 点击成员跳转到该成员的资料详情（路由驱动）
  void router.push({ path: `/friend/${encodeURIComponent(userId)}` }).catch((err) => {
    logger.warn('跳转成员详情失败:', err)
  })
}

const openImageViewer = () => {
  logger.debug('打开图片查看器')
}

// 房间头像上传：调用 matrixMediaService.uploadImage 上传 → groupStore.setRoomAvatar 写入 m.room.avatar
const handleAvatarUpload = async ({ file }: UploadCustomRequestOptions) => {
  const roomId = props.content.uid
  const rawFile = file.file
  if (!roomId || !rawFile) return

  uploadingAvatar.value = true
  try {
    const result = await matrixMediaService.uploadImage(rawFile)
    if (!result?.contentUri) {
      showFeedback(t('room.detail.avatar_update_failed'), 'error', 'assertive')
      return
    }
    const success = await groupStore.setRoomAvatar(roomId, result.contentUri)
    if (success) {
      // 同步更新本地展示
      item.value = { ...item.value, avatar: result.contentUri, avatarUrl: result.contentUri }
      showFeedback(t('room.detail.avatar_updated'), 'success', 'polite')
    } else {
      showFeedback(t('room.detail.avatar_update_failed'), 'error', 'assertive')
    }
  } catch (err) {
    logger.error('上传房间头像失败:', err)
    showFeedback(t('room.detail.avatar_update_failed'), 'error', 'assertive')
  } finally {
    uploadingAvatar.value = false
  }
}

// 离开房间：危险操作，使用 window.$dialog 确认
const handleLeaveRoom = () => {
  const roomId = props.content.uid
  if (!roomId) return

  window.$dialog?.warning({
    title: t('room.detail.leave_confirm_title'),
    content: t('room.detail.leave_confirm_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const success = await groupStore.leaveRoom(roomId)
        if (success) {
          showFeedback(t('room.detail.leave_success'), 'success', 'polite')
          // 离开成功后返回房间列表
          if (window.history.length > 1) {
            void router.back()
          } else {
            void router.push('/room')
          }
        } else {
          showFeedback(t('room.detail.leave_failed'), 'error', 'assertive')
        }
      } catch {
        showFeedback(t('room.detail.leave_failed'), 'error', 'assertive')
      }
    }
  })
}

// 忘记房间：危险操作，使用 window.$dialog 确认
const handleForgetRoom = () => {
  const roomId = props.content.uid
  if (!roomId) return

  window.$dialog?.warning({
    title: t('room.detail.forget_confirm_title'),
    content: t('room.detail.forget_confirm_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const success = await groupStore.forgetRoom(roomId)
        if (success) {
          showFeedback(t('room.detail.forget_success'), 'success', 'polite')
          if (window.history.length > 1) {
            void router.back()
          } else {
            void router.push('/room')
          }
        } else {
          showFeedback(t('room.detail.forget_failed'), 'error', 'assertive')
        }
      } catch {
        showFeedback(t('room.detail.forget_failed'), 'error', 'assertive')
      }
    }
  })
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.details-panel {
  height: 100%;
  padding: 24px 20px;
  box-sizing: border-box;
}

.single-details {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
  overflow-y: auto;
}

// 阶段 9：详情面板头部玻璃质感（需求文档 3.4.5b）
.single-details__hero {
  @include liquid-glass(20px, 0.85, 1.8);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.single-details__avatar {
  border: 3px solid var(--hula-overlay-mobile-sheet);
  box-shadow: var(--hula-shadow-lg);
}

.single-details__name {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  color: var(--hula-text-primary);
  font-weight: 600;
}

.single-details__uid {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--hula-text-tertiary);
}

.single-details__signature {
  margin: 0;
  max-width: 360px;
  font-size: 14px;
  line-height: 22px;
  color: var(--hula-text-secondary);
}

.single-details__meta {
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 14px;
  line-height: 20px;
  color: var(--hula-text-secondary);
}

.single-details__status {
  margin-top: 4px;
}

.single-details__last-seen {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--hula-text-tertiary);
}

.single-details__last-seen-label {
  color: var(--hula-text-tertiary);
}

.single-details__last-seen-value {
  color: var(--hula-text-secondary);
}

.single-details__actions {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 34px;
}

.single-details__actions--group {
  gap: 24px;
}

.single-details__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--hula-text-secondary);
}

.single-details__action:hover .single-details__action-icon {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(29, 163, 134, 0.22);
}

.single-details__action-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-color-primary-500);
  color: var(--hula-text-inverse);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  svg {
    width: 20px;
    height: 20px;
  }
}

.single-details__action-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--hula-text-secondary);
}

.single-details__action-icon--encrypted {
  background: var(--hula-color-success-500);
}

.single-details__management {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 8px;
  box-sizing: border-box;
}

.management-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--hula-surface-panel-muted);
  border-radius: 8px;
}

.management-section--danger {
  background: transparent;
  padding: 4px 0;
}

.management-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.management-label {
  font-size: 13px;
  color: var(--hula-text-secondary);
  font-weight: 500;
}

.management-value {
  font-size: 13px;
  color: var(--hula-text-primary);
  line-height: 20px;
  word-break: break-all;
}

.management-edit {
  display: flex;
  gap: 8px;
  align-items: center;
}

.management-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.group-details {
  margin-top: 30px;
}

.group-details__name-edit {
  width: 100%;
  max-width: 320px;
}

.announcement-container {
  width: 100%;
  padding: 12px;
  background: var(--hula-surface-panel-muted);
  border-radius: 8px;
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.announcement-content {
  font-size: 13px;
  color: var(--hula-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.member-section {
  width: 100%;
}

.member-header {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--hula-text-secondary);
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--hula-surface-panel-muted);
  }
}

.member-name {
  margin-top: 4px;
  font-size: 12px;
  color: var(--hula-text-primary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
