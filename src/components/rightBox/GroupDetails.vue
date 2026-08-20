<template>
  <n-flex vertical align="center" :size="20" class="group-details">
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
        style="border: 2px solid var(--tjg-text-inverse)"
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
      style="border: 2px solid var(--tjg-text-inverse)"
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

      <button v-if="!isMobile" class="single-details__action" type="button" @click="handleOpenInNewWindow">
        <span class="single-details__action-icon">
          <svg><use href="#expand" /></svg>
        </span>
        <span class="single-details__action-label">{{ t('chat.header.open_in_new_window', '在新窗口打开') }}</span>
      </button>
    </div>

    <div v-if="announcementContent" class="announcement-container">
      <div class="announcement-header">
        <span class="text-[length:var(--tjg-font-size-base)]">
          {{ t('home.chat_details.group.announcement.label') }}
        </span>
        <n-button text type="primary" size="small" @click="handleOpenAnnouncement">
          {{ t('home.chat_details.group.announcement.window_title') }}
        </n-button>
      </div>
      <div class="announcement-content">{{ announcementContent }}</div>
    </div>

    <!-- 完整成员列表（含邀请/踢出/封禁/解封管理） -->
    <div class="group-details__members">
      <RoomMembersPane :room-id="content.uid" :can-manage="canManageRoom" @member-click="handleMemberClick" />
    </div>

    <!-- 房间可见性切换（仅管理员可见） -->
    <div v-if="canManageRoom" class="group-details__visibility">
      <RoomVisibilityToggle :room-id="content.uid" />
    </div>

    <!-- 危险操作区（离开/忘记房间） -->
    <div class="group-details__danger-zone">
      <n-button size="small" type="warning" block @click="handleLeaveRoom">
        {{ t('room.detail.leave_room') }}
      </n-button>
      <n-button size="small" type="error" block ghost @click="handleForgetRoom">
        {{ t('room.detail.forget_room') }}
      </n-button>
    </div>
  </n-flex>
</template>

<script setup lang="ts">
import type { UploadCustomRequestOptions } from 'naive-ui'
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import RoomMembersPane from '@/components/rightBox/RoomMembersPane.vue'
import RoomVisibilityToggle from '@/components/rightBox/RoomVisibilityToggle.vue'
import { useDetailsActions } from '@/composables/chat/useDetailsActions'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GroupDetails')
const { t } = useI18n()
const router = useRouter()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const props = defineProps({
  content: {
    type: Object as PropType<{ type: RoomTypeEnum; uid: string }>,
    required: false,
    default: () => ({ type: RoomTypeEnum.GROUP, uid: '' })
  }
})

const { isMobile, handleSendMessage, handleOpenInNewWindow } = useDetailsActions(props.content)

const item = ref<
  Partial<MatrixGroupInfo> & {
    myName?: string
    account?: string
    uid?: string
    [key: string]: unknown
  }
>({})
const announcementContent = ref('')
const savingRoomName = ref(false)
const uploadingAvatar = ref(false)

const canManageRoom = computed(() => groupStore.isCurrentUserCreator || groupStore.isCurrentUserModerator)

watch(
  () => [props.content.type, props.content.uid] as const,
  async ([type, uid]) => {
    if (!uid || type !== RoomTypeEnum.GROUP) {
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

const handleMemberClick = (userId: string) => {
  if (!userId) return
  void router.push({ path: `/friend/${encodeURIComponent(userId)}` }).catch((err) => {
    logger.warn('跳转成员详情失败:', err)
  })
}

const openImageViewer = () => {
  logger.debug('打开图片查看器')
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

.group-details {
  margin-top: 30px;
}

.group-details__name-edit {
  width: 100%;
  max-width: 320px;
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
  color: var(--tjg-text-secondary);
}

.single-details__action:hover .single-details__action-icon {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--tjg-color-primary-500) 22%, transparent);
}

.single-details__action-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
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
  color: var(--tjg-text-secondary);
}

.announcement-container {
  width: 100%;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
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
  color: var(--tjg-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.group-details__danger-zone {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 8px;
}
</style>
