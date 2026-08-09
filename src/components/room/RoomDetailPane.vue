<template>
  <div class="room-detail-pane" :class="{ 'is-empty': !roomId }">
    <template v-if="!roomId">
      <div class="pane-empty">
        <svg class="size-40px color-[--tjg-text-tertiary]"><use href="#view-grid-card"></use></svg>
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
            <div
              class="header-avatar"
              :class="{ 'is-uploading': avatarUploading }"
              style="width: 64px; height: 64px"
              @click="handleAvatarClick">
              <img v-if="roomDetail.avatar" :src="roomDetail.avatar" alt="room avatar" class="avatar-img" />
              <div v-else class="avatar-fallback">
                <svg class="size-28px color-[--tjg-text-tertiary]"><use href="#view-grid-card"></use></svg>
              </div>
              <n-spin v-if="avatarUploading" size="small" class="avatar-spin" />
              <div class="avatar-overlay" v-else-if="roomDetail.canEdit">
                <svg class="size-14px"><use href="#camera"></use></svg>
              </div>
            </div>
          </div>

          <div class="header-info">
            <div class="room-name-row flex items-center gap-[--tjg-space-2]">
              <h3 class="room-name">{{ roomDetail.name }}</h3>
              <div class="header-badges flex items-center gap-[--tjg-space-1]">
                <span
                  v-if="roomDetail.isPublic"
                  class="inline-flex items-center px-[6px] py-[1px] rounded-[--tjg-radius-xs] bg-[--tjg-color-info-100] text-[--tjg-color-info-600] text-[length:var(--tjg-font-size-2xs)]"
                  :title="t('room.detail.public')">
                  {{ t('room.detail.public') }}
                </span>
                <span
                  v-if="roomDetail.isEncrypted"
                  class="inline-flex items-center px-[6px] py-[1px] rounded-[--tjg-radius-xs] bg-[--tjg-color-success-100] text-[--tjg-color-success-600] text-[length:var(--tjg-font-size-2xs)]"
                  :title="t('room.detail.encrypted')">
                  {{ t('room.detail.encrypted') }}
                </span>
              </div>
            </div>
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
          <!-- P1-2：统计卡片（总成员/在线/公告） -->
          <div class="pane-section">
            <RoomDetailStats
              :member-count="roomDetail.memberCount"
              :online-count="roomDetail.onlineCount"
              :announcement-count="announcementCount" />
          </div>

          <div class="pane-divider" />

          <!-- P1-3：最近消息预览 -->
          <div class="pane-section">
            <RoomDetailLastMessage
              :last-message="lastMessage"
              :sender-name="lastMessageSender"
              :timestamp="lastMessageTime" />
          </div>

          <div class="pane-divider" />

          <!-- P1-3：核心成员预览 -->
          <div class="pane-section">
            <RoomDetailMembers :members="roomMembers" :loading="membersLoading" />
          </div>

          <div class="pane-divider" />

          <div class="pane-section">
            <RoomEncryptionSettings v-if="roomId" :room-id="roomId" />
          </div>

          <div class="pane-divider" />

          <div class="pane-section">
            <RoomParentSpaces :room-id="roomId!" />
          </div>

          <!-- P1-4：底部横向操作栏 -->
          <div
            class="pane-action-bar flex flex-row items-center gap-[--tjg-space-2]"
            data-testid="room-detail-action-bar">
            <n-button type="primary" class="flex-1" data-testid="room-detail-action-enter" @click="enterRoom">
              <template #icon>
                <svg class="size-14px"><use href="#message"></use></svg>
              </template>
              {{ t('room.detail.enter_chat') }}
            </n-button>

            <n-button secondary class="flex-1" data-testid="room-detail-action-settings" @click="openRoomSettings">
              <template #icon>
                <svg class="size-14px"><use href="#settings"></use></svg>
              </template>
              {{ t('room.detail.settings') }}
            </n-button>
          </div>

          <!-- 邀请按钮：保留为次要操作（仅 canInvite 时显示） -->
          <div v-if="roomDetail.canInvite" class="pane-invite-secondary">
            <n-button block text size="small" @click="showInviteDialog = true">
              <template #icon>
                <svg class="size-12px"><use href="#add-user"></use></svg>
              </template>
              {{ t('room.detail.invite') }}
            </n-button>
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
import RoomDetailLastMessage from '@/components/room/RoomDetailLastMessage.vue'
import RoomDetailMembers from '@/components/room/RoomDetailMembers.vue'
import RoomDetailStats from '@/components/room/RoomDetailStats.vue'
import RoomEncryptionSettings from '@/components/room/RoomEncryptionSettings.vue'
import RoomParentSpaces from '@/components/space/RoomParentSpaces.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { usePinnedMessage } from '@/composables/room/usePinnedMessage'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import { OnlineEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'

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
const roomMembers = ref<MatrixRoomMember[]>([])
const membersLoading = ref(false)
const lastMessage = ref<string | null>(null)
const lastMessageSender = ref<string | null>(null)
const lastMessageTime = ref<number | null>(null)

// P1-2：置顶消息作为公告数来源
const { pinnedEventIds, load: loadPinnedMessages } = usePinnedMessage({
  roomId: () => props.roomId
})

const announcementCount = computed(() => pinnedEventIds.value?.length ?? 0)

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
    await matrixRoomActionFacade.setRoomAvatar(props.roomId, mxcUrl)
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

interface MatrixTimelineEvent {
  getType?: () => string
  type?: string
  getContent?: () => Record<string, unknown> | undefined
  content?: Record<string, unknown>
  getSender?: () => string | null
  sender?: string
  getTs?: () => number | null
  origin_server_ts?: number
}

const resolveLastMessage = () => {
  if (!props.roomId) {
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
    return
  }
  try {
    const room = matrixClientService.getRoom(props.roomId)
    if (!room) return
    const timeline = (
      room as unknown as {
        getLiveTimeline?: () => { getEvents?: () => MatrixTimelineEvent[] }
      }
    ).getLiveTimeline?.()
    const events = timeline?.getEvents?.() ?? []
    // 从末尾向前找第一条可显示消息事件
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      const eventType = event.getType?.() ?? event.type
      if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') continue
      const content = event.getContent?.() ?? event.content
      const body = (content?.body as string) ?? null
      const sender = event.getSender?.() ?? event.sender ?? null
      const ts = event.getTs?.() ?? event.origin_server_ts ?? null
      lastMessage.value = body
      lastMessageSender.value = resolveSenderName(sender)
      lastMessageTime.value = ts ?? null
      return
    }
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
  } catch {
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
  }
}

const resolveSenderName = (senderId: string | null): string | null => {
  if (!senderId) return null
  const member = roomMembers.value.find((m) => m.userId === senderId)
  return member?.displayName || member?.name || senderId
}

const loadRoomMembers = async () => {
  if (!props.roomId) {
    roomMembers.value = []
    return
  }
  membersLoading.value = true
  try {
    const members = await groupStore.getMembersByRoomId(props.roomId)
    roomMembers.value = (members as MatrixRoomMember[]) || []
  } catch {
    roomMembers.value = []
  } finally {
    membersLoading.value = false
  }
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
      roomMembers.value = (members as MatrixRoomMember[]) || []
    } catch {
      // member retrieval is best-effort
    }

    // 用真实 power level 推 canEdit / canInvite，避免硬编码
    let canEdit = false
    let canInvite = false
    const room = matrixClientService.getRoom(props.roomId)
    const userId = matrixClientService.getUserId()
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
  // 并行加载：最近消息 + 置顶消息（公告数）
  resolveLastMessage()
  try {
    await loadPinnedMessages?.()
  } catch {
    // best-effort: 置顶消息加载失败不影响主流程
  }
  loadRoomMembers()
}

watch(
  () => [props.roomId, props.refreshVersion] as const,
  ([newId]) => {
    if (newId) {
      loadRoomDetail()
    } else {
      roomDetail.value = null
      roomMembers.value = []
      lastMessage.value = null
      lastMessageSender.value = null
      lastMessageTime.value = null
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
  background: var(--tjg-surface-panel);

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
  color: var(--tjg-text-tertiary);
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
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: var(--tjg-surface-raised);
  border: 1px solid var(--tjg-border-default);
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
  background: var(--tjg-surface-list-hover);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tjg-overlay-mask-default);
  opacity: 0;
  transition: opacity 0.15s;
  color: var(--tjg-text-inverse);
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
  background: var(--tjg-overlay-mask-default);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.room-name-row {
  margin-bottom: 2px;
}

.room-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--tjg-text-primary);
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
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.room-id-value {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
}

.pane-divider {
  height: 1px;
  background: var(--tjg-border-default);
  margin: 0 16px;
}

.pane-section {
  padding: 12px 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--tjg-text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pane-action-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
}

.pane-invite-secondary {
  padding: 0 16px 12px;
}

.pane-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--tjg-text-tertiary);
  font-size: 13px;
}

.invite-form {
  margin-top: 4px;
}

.invite-actions {
  margin-top: 16px;
}
</style>
