<template>
  <div class="room-detail-pane" :class="{ 'is-empty': !roomId }">
    <template v-if="!roomId">
      <div class="pane-empty">
        <svg class="size-40px color-[--hula-text-tertiary]"><use href="#view-grid-card"></use></svg>
        <p class="empty-text">{{ t('room.detail.no_selection') }}</p>
      </div>
    </template>

    <template v-else>
      <div class="pane-loading" v-if="loading">
        <n-spin size="medium" />
      </div>

      <template v-else-if="roomDetail">
        <div class="pane-header">
          <div class="header-avatar-wrapper">
            <div class="header-avatar" :class="{ 'is-uploading': avatarUploading }" @click="handleAvatarClick">
              <img v-if="roomDetail.avatar" :src="roomDetail.avatar" alt="room avatar" class="avatar-img" />
              <div v-else class="avatar-fallback">
                <svg class="size-24px color-[--hula-text-tertiary]"><use href="#view-grid-card"></use></svg>
              </div>
              <n-spin v-if="avatarUploading" size="small" class="avatar-spin" />
              <div class="avatar-overlay" v-else-if="roomDetail.canEdit">
                <svg class="size-14px"><use href="#camera"></use></svg>
              </div>
            </div>
          </div>

          <div class="header-info">
            <h3 class="room-name">{{ roomDetail.name }}</h3>
            <div class="room-id-row">
              <span class="room-id-label">ID:</span>
              <span class="room-id-value" :title="roomId">{{ truncateId(roomId) }}</span>
              <n-button text size="tiny" class="copy-btn" @click="copyRoomId">
                <svg class="size-12px"><use href="#copy"></use></svg>
              </n-button>
            </div>
          </div>
        </div>

        <div class="pane-divider" />

        <div class="pane-section" v-if="inviteMode">
          <div class="section-title">{{ t('space.invite_title') }}</div>
          <n-form label-placement="top" :show-feedback="false" class="invite-form">
            <n-form-item :label="t('space.invite')">
              <n-input
                :value="inviteUserId"
                :placeholder="t('space.invite_user_placeholder')"
                @update:value="emit('update:inviteUserId', $event)" />
            </n-form-item>
            <n-flex justify="flex-end" :size="12" class="invite-actions">
              <n-button @click="emit('closeInvite')">{{ t('common.cancel') }}</n-button>
              <n-button
                type="primary"
                :loading="inviting"
                :disabled="!inviteUserId?.trim()"
                @click="emit('submitInvite')">
                {{ t('common.confirm') }}
              </n-button>
            </n-flex>
          </n-form>
        </div>

        <div class="pane-section" v-else-if="settingsMode">
          <div class="section-title">{{ t('room.detail.settings') }}</div>
          <n-form label-placement="top" :show-feedback="false" class="invite-form">
            <n-form-item :label="t('room.create.name')">
              <n-input
                :value="settingsName"
                :placeholder="t('room.create.name_placeholder')"
                @update:value="emit('update:settingsName', $event)" />
            </n-form-item>
            <n-form-item :label="t('room.create.topic')">
              <n-input
                :value="settingsTopic"
                type="textarea"
                :rows="4"
                :placeholder="t('room.create.topic_placeholder')"
                @update:value="emit('update:settingsTopic', $event)" />
            </n-form-item>
            <n-flex justify="flex-end" :size="12" class="invite-actions">
              <n-button @click="emit('closeSettings')">{{ t('common.cancel') }}</n-button>
              <n-button
                type="primary"
                :loading="settingsSubmitting"
                :disabled="!settingsName?.trim()"
                @click="emit('submitSettings')">
                {{ t('common.confirm') }}
              </n-button>
            </n-flex>
          </n-form>
        </div>

        <template v-else>
          <div class="pane-section">
            <div class="section-title">{{ t('room.detail.overview') }}</div>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">{{ t('room.detail.topic') }}</span>
                <span class="info-value" :class="{ 'is-empty': !roomDetail.topic }">
                  {{ roomDetail.topic || t('room.detail.no_topic') }}
                </span>
              </div>

              <div class="info-item">
                <span class="info-label">{{ t('room.detail.members') }}</span>
                <span class="info-value">{{ roomDetail.memberCount }}</span>
              </div>

              <div class="info-item">
                <span class="info-label">{{ t('room.detail.online') }}</span>
                <span class="info-value online">{{ roomDetail.onlineCount || 0 }}</span>
              </div>

              <div class="info-item">
                <span class="info-label">{{ t('room.detail.visibility') }}</span>
                <span class="info-value">
                  <n-tag :type="roomDetail.isPublic ? 'info' : 'default'" size="small" round>
                    {{ roomDetail.isPublic ? t('room.detail.public') : t('room.detail.private') }}
                  </n-tag>
                </span>
              </div>

              <div class="info-item">
                <span class="info-label">{{ t('room.detail.encryption') }}</span>
                <span class="info-value">
                  <n-tag :type="roomDetail.isEncrypted ? 'success' : 'default'" size="small" round>
                    {{ roomDetail.isEncrypted ? t('room.detail.encrypted') : t('room.detail.not_encrypted') }}
                  </n-tag>
                </span>
              </div>
            </div>
          </div>

          <div class="pane-divider" />

          <div class="pane-section">
            <RoomEncryptionSettings v-if="roomId" :room-id="roomId" />
          </div>

          <div class="pane-divider" />

          <div class="pane-section">
            <RoomParentSpaces :room-id="roomId!" />
          </div>

          <div class="pane-divider" />

          <div class="pane-section">
            <div class="section-title">{{ t('room.detail.actions') }}</div>

            <div class="action-buttons">
              <n-button type="primary" block @click="enterRoom">
                <template #icon>
                  <svg class="size-14px"><use href="#message"></use></svg>
                </template>
                {{ t('room.detail.enter_chat') }}
              </n-button>

              <n-button block secondary @click="openRoomSettings">
                <template #icon>
                  <svg class="size-14px"><use href="#settings"></use></svg>
                </template>
                {{ t('room.detail.settings') }}
              </n-button>

              <n-button v-if="roomDetail.canInvite" block secondary @click="showInviteDialog = true">
                <template #icon>
                  <svg class="size-14px"><use href="#add-user"></use></svg>
                </template>
                {{ t('room.detail.invite') }}
              </n-button>
            </div>
          </div>
        </template>
      </template>

      <template v-else>
        <div class="pane-error">
          <p>{{ t('room.detail.load_failed') }}</p>
          <n-button size="small" @click="loadRoomDetail">{{ t('common.retry') }}</n-button>
        </div>
      </template>
    </template>
  </div>

  <InviteDialog v-model:visible="showInviteDialog" :room-id="roomId ?? ''" />

  <input
    ref="avatarFileInput"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="hidden"
    @change="handleAvatarFileChange" />
  <AvatarCropper
    ref="avatarCropperRef"
    v-model:show="avatarCropperVisible"
    :image-url="avatarLocalImageUrl"
    @crop="handleAvatarCrop" />
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import InviteDialog from '@/components/room/InviteDialog.vue'
import RoomEncryptionSettings from '@/components/room/RoomEncryptionSettings.vue'
import RoomParentSpaces from '@/components/space/RoomParentSpaces.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum } from '@/enums'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomStateService } from '@/services/matrix/room/StateService'
import { useGroupStore } from '@/stores/domains/chat/group'

interface RoomDetail {
  name: string
  avatar: string
  topic: string
  memberCount: number
  onlineCount: number
  isPublic: boolean
  isEncrypted: boolean
  canEdit: boolean
  canInvite: boolean
}

const props = defineProps<{
  roomId: string | null
  roomName?: string
  roomAvatar?: string
  roomType?: number
  inviteMode?: boolean
  inviteUserId?: string
  inviting?: boolean
  settingsMode?: boolean
  settingsName?: string
  settingsTopic?: string
  settingsSubmitting?: boolean
  refreshVersion?: number
}>()

const emit = defineEmits<{
  enterRoom: []
  settings: []
  invite: []
  closeInvite: []
  submitInvite: []
  closeSettings: []
  submitSettings: []
  'update:inviteUserId': [value: string]
  'update:settingsName': [value: string]
  'update:settingsTopic': [value: string]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const loading = ref(false)
const roomDetail = ref<RoomDetail | null>(null)
const showInviteDialog = ref(false)
const avatarUploading = ref(false)

const {
  fileInput: avatarFileInput,
  localImageUrl: avatarLocalImageUrl,
  showCropper: avatarCropperVisible,
  cropperRef: avatarCropperRef,
  openAvatarCropper,
  handleFileChange: handleAvatarFileChange,
  handleCrop: onAvatarCrop
} = useAvatarUpload({
  onSuccess: async (mxcUrl) => {
    if (!props.roomId) return
    await matrixRoomStateService.setRoomAvatar(props.roomId, mxcUrl)
    if (roomDetail.value) {
      roomDetail.value = { ...roomDetail.value, avatar: mxcUrl }
    }
    showFeedback(t('room.detail.avatar_updated'), 'success')
  }
})

const truncateId = (id: string) => {
  if (id.length <= 20) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
}

const copyRoomId = async () => {
  if (!props.roomId) return
  const { copy } = useClipboard()
  await copy(props.roomId)
  showFeedback(t('room.detail.id_copied'), 'success')
}

const handleAvatarClick = () => {
  if (!roomDetail.value?.canEdit || avatarUploading.value) return
  openAvatarCropper()
}

const handleAvatarCrop = async (cropBlob: Blob) => {
  avatarUploading.value = true
  try {
    await onAvatarCrop(cropBlob)
  } finally {
    avatarUploading.value = false
  }
}

const enterRoom = () => {
  emit('enterRoom')
}

const openRoomSettings = () => {
  emit('settings')
}

const openInviteMember = () => {
  showInviteDialog.value = true
}

const buildRoomDetail = async (): Promise<RoomDetail | null> => {
  if (!props.roomId) return null

  try {
    const groupInfo = await groupStore.getGroupDetailByRoomId(props.roomId)

    let onlineCount = 0
    let memberCount = groupInfo?.memberCount || 0

    try {
      const members = await groupStore.getMembersByRoomId(props.roomId)
      memberCount = Math.max(memberCount, members?.length || 0)
      onlineCount =
        members?.filter((m) => (m as unknown as Record<string, unknown>).activeStatus === OnlineEnum.ONLINE).length || 0
    } catch {
      // member retrieval is best-effort
    }

    // 用真实 power level 推 canEdit / canInvite，避免硬编码
    let canEdit = false
    let canInvite = false
    const client = matrixClientService.getClient()
    const room = client?.getRoom(props.roomId)
    const userId = client?.getUserId()
    if (room && userId) {
      canEdit = (
        room.currentState as unknown as { maySendStateEvent: (t: string, u: string) => boolean }
      ).maySendStateEvent('m.room.name', userId)
      canInvite = (room as unknown as { canInvite: (u: string) => boolean }).canInvite(userId)
    }

    return {
      name: groupInfo?.name || props.roomName || props.roomId,
      avatar: groupInfo?.avatar || props.roomAvatar || '',
      topic: groupInfo?.topic || '',
      memberCount,
      onlineCount,
      isPublic: groupInfo?.isPublic !== false,
      isEncrypted: groupInfo?.isEncrypted ?? false,
      canEdit,
      canInvite
    }
  } catch {
    return null
  }
}

const loadRoomDetail = async () => {
  loading.value = true
  roomDetail.value = await buildRoomDetail()
  loading.value = false
}

watch(
  () => [props.roomId, props.refreshVersion] as const,
  ([newId]) => {
    if (newId) {
      loadRoomDetail()
    } else {
      roomDetail.value = null
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.room-detail-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: var(--hula-surface-panel);

  &.is-empty {
    justify-content: center;
    align-items: center;
  }
}

.pane-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-text {
  font-size: 13px;
  color: var(--hula-text-tertiary);
  margin: 0;
}

.pane-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 16px 12px;
}

.header-avatar-wrapper {
  flex-shrink: 0;
}

.header-avatar {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: var(--hula-surface-raised);
  border: 1px solid var(--hula-border-default);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-surface-list-hover);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-overlay-mask-default);
  opacity: 0;
  transition: opacity 0.15s;
  color: var(--hula-text-inverse);
}

.header-avatar:hover .avatar-overlay {
  opacity: 1;
}

.header-avatar.is-uploading {
  cursor: wait;
}

.avatar-spin {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-overlay-mask-default);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--hula-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-id-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.room-id-label {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.room-id-value {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  flex-shrink: 0;
  color: var(--hula-text-tertiary);
}

.pane-divider {
  height: 1px;
  background: var(--hula-border-default);
  margin: 0 16px;
}

.pane-section {
  padding: 12px 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--hula-text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 13px;
  color: var(--hula-text-secondary);
}

.info-value {
  font-size: 13px;
  color: var(--hula-text-primary);

  &.is-empty {
    color: var(--hula-text-tertiary);
    font-style: italic;
  }

  &.online {
    color: var(--hula-color-success-500);
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.announcement-content {
  font-size: 13px;
  color: var(--hula-text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.pane-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--hula-text-tertiary);
  font-size: 13px;
}

.invite-form {
  margin-top: 4px;
}

.invite-actions {
  margin-top: 16px;
}
</style>
