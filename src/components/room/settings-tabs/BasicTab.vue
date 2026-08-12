<template>
  <div class="rs-tab" data-testid="basic-tab">
    <n-spin :show="loading">
      <!-- Section: Room Information -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_room_info') }}</h4>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_room_name') }}</label>
          <n-input v-model:value="roomName" :placeholder="t('room.settings_drawer.field_room_name')" />
        </div>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_room_topic') }}</label>
          <n-input v-model:value="roomTopic" type="textarea" :rows="4" />
        </div>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_room_id') }}</label>
          <div class="rs-tab__field-id">
            <span class="rs-tab__field-readonly">{{ truncatedRoomId }}</span>
            <n-button
              quaternary
              size="small"
              :aria-label="t('room.settings_drawer.field_room_id')"
              data-testid="basic-copy-room-id"
              @click="copyRoomId">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </n-button>
          </div>
        </div>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_member_count') }}</label>
          <div class="rs-tab__field-readonly">
            {{ t('room.settings_drawer.member_count_value', { count: memberCount }) }}
          </div>
        </div>

        <div class="rs-tab__actions">
          <n-button type="primary" :loading="saving" data-testid="basic-save" @click="handleSave">
            {{ t('common.save') }}
          </n-button>
        </div>
      </section>

      <!-- Section: Room Avatar -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_room_avatar') }}</h4>
        <div class="rs-tab__avatar">
          <div class="rs-tab__avatar-preview">
            <img v-if="avatarHttpUrl" :src="avatarHttpUrl" class="rs-tab__avatar-img" alt="" />
            <div v-else class="rs-tab__avatar-placeholder">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          </div>
          <div class="rs-tab__avatar-actions">
            <n-button
              size="small"
              :loading="avatarUploading"
              data-testid="basic-upload-avatar"
              @click="openAvatarCropper">
              {{ t('room.settings_drawer.action_upload_avatar') }}
            </n-button>
            <n-button v-if="avatarUrl" size="small" quaternary data-testid="basic-remove-avatar" @click="removeAvatar">
              {{ t('room.settings_drawer.action_remove_avatar') }}
            </n-button>
          </div>
        </div>
      </section>
    </n-spin>

    <input
      ref="avatarFileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="rs-tab__hidden"
      @change="handleAvatarFileChange" />
    <AvatarCropper
      ref="avatarCropperRef"
      v-model:show="avatarCropperVisible"
      :image-url="avatarLocalImageUrl"
      @crop="handleAvatarCrop" />
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { useGroupStore } from '@/stores/domains/chat/group'

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()
const { copy } = useClipboard()

const loading = ref(false)
const saving = ref(false)
const avatarUploading = ref(false)
const roomName = ref('')
const roomTopic = ref('')
const avatarUrl = ref('')
const memberCount = ref(0)

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
    await matrixRoomActionFacade.setRoomAvatar(props.roomId, mxcUrl)
    avatarUrl.value = mxcUrl
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  }
})

const avatarHttpUrl = computed(() => {
  if (!avatarUrl.value) return ''
  return matrixMediaService.getThumbnailUrl(avatarUrl.value, 64, 64) ?? ''
})

const truncatedRoomId = computed(() => {
  const id = props.roomId
  if (id.length <= 20) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
})

async function loadRoomDetail() {
  loading.value = true
  try {
    await groupStore.loadGroupInfo(props.roomId)
    const detail = groupStore.getGroupDetailByRoomId(props.roomId)
    roomName.value = detail?.name ?? ''
    roomTopic.value = detail?.topic ?? ''
    avatarUrl.value = detail?.avatar ?? ''
    memberCount.value = detail?.memberCount ?? 0
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await matrixRoomActionFacade.setRoomName(props.roomId, roomName.value)
    await matrixRoomActionFacade.setRoomTopic(props.roomId, roomTopic.value)
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    saving.value = false
  }
}

async function copyRoomId() {
  await copy(props.roomId)
  showFeedback(t('room.detail.id_copied'), 'success')
}

async function removeAvatar() {
  try {
    await matrixRoomActionFacade.setRoomAvatar(props.roomId, '')
    avatarUrl.value = ''
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  }
}

async function handleAvatarCrop(cropBlob: Blob) {
  avatarUploading.value = true
  try {
    await onAvatarCrop(cropBlob)
  } finally {
    avatarUploading.value = false
  }
}

watch(
  () => props.roomId,
  (id) => {
    if (id) loadRoomDetail()
  }
)
onMounted(() => {
  loadRoomDetail()
})
</script>

<style scoped lang="scss">
.rs-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rs-tab__section {
  display: flex;
  flex-direction: column;
}
.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin: 0 0 10px 0;
}
.rs-tab__field {
  margin-bottom: 12px;
}
.rs-tab__field-label {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  margin-bottom: 5px;
}
.rs-tab__field-readonly {
  padding: 8px 10px;
  background: var(--tjg-surface-app);
  border-radius: var(--tjg-radius-sm);
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm);
  opacity: 0.6;
}
.rs-tab__field-id {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  .rs-tab__field-readonly {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.rs-tab__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}
.rs-tab__avatar {
  display: flex;
  align-items: center;
  gap: 14px;
}
.rs-tab__avatar-preview {
  width: 64px;
  height: 64px;
  border-radius: var(--tjg-radius-full);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--tjg-surface-app);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-tertiary);
}
.rs-tab__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rs-tab__avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rs-tab__hidden {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab,
  .rs-tab * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
