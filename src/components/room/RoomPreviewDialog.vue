<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('room.discovery.preview_title')"
    :bordered="false"
    :style="{ width: '480px', maxWidth: '90vw' }"
    @update:show="handleUpdateVisible">
    <div v-if="room" class="room-preview-dialog flex flex-col gap-[--tjg-space-3]" data-testid="room-preview-dialog">
      <n-spin :show="loading">
        <div class="room-preview-dialog__head flex items-center gap-[--tjg-space-3]">
          <div
            class="room-preview-dialog__avatar shrink-0 flex items-center justify-center size-[48px] overflow-hidden rounded-[--tjg-radius-full] bg-[--tjg-surface-subtle]">
            <img
              v-if="room.avatarUrl"
              :src="room.avatarUrl"
              :alt="''"
              class="room-preview-dialog__avatar-img w-full h-full object-cover" />
            <span v-else class="room-preview-dialog__avatar-placeholder text-[--tjg-text-secondary]">
              {{ room.name?.charAt(0) || '?' }}
            </span>
          </div>
          <div class="room-preview-dialog__title flex items-center gap-[--tjg-space-2] min-w-0">
            <span class="room-preview-dialog__name truncate text-[--tjg-text-primary]">{{ room.name }}</span>
            <span
              v-if="room.isFederated"
              class="room-preview-dialog__federated inline-flex items-center gap-2px shrink-0 px-6px py-1px rounded-[--tjg-radius-xs] bg-[--tjg-color-info-100] text-[--tjg-color-info-600]"
              :title="t('room.discovery.federated')">
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" />
                <path d="M12 3a14 14 0 0 1 0 18" />
                <path d="M12 3a14 14 0 0 0 0 18" />
              </svg>
              {{ t('room.discovery.federated') }}
            </span>
          </div>
        </div>

        <dl
          class="room-preview-dialog__meta flex flex-col gap-[--tjg-space-2] m-0 p-[--tjg-space-3] rounded-[--tjg-radius-sm] bg-[--tjg-surface-panel-muted]">
          <div class="room-preview-dialog__row flex items-start gap-[--tjg-space-2]">
            <dt
              class="room-preview-dialog__label shrink-0 w-64px m-0 text-[--tjg-text-tertiary]"
              data-testid="preview-members-label">
              {{ t('room.discovery.preview_members') }}
            </dt>
            <dd class="room-preview-dialog__value flex items-center gap-4px m-0 text-[--tjg-text-primary] break-words">
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {{ room.numJoinedMembers }}
            </dd>
          </div>
          <div class="room-preview-dialog__row flex items-start gap-[--tjg-space-2]">
            <dt class="room-preview-dialog__label shrink-0 w-64px m-0 text-[--tjg-text-tertiary]">
              {{ t('room.discovery.preview_topic') }}
            </dt>
            <dd
              class="room-preview-dialog__value room-preview-dialog__value--topic flex items-center gap-4px m-0 text-[--tjg-text-secondary] break-words">
              {{ room.topic || t('room.discovery.no_topic') }}
            </dd>
          </div>
          <div class="room-preview-dialog__row flex items-start gap-[--tjg-space-2]">
            <dt class="room-preview-dialog__label shrink-0 w-64px m-0 text-[--tjg-text-tertiary]">
              {{ t('room.discovery.preview_history') }}
            </dt>
            <dd
              class="room-preview-dialog__value room-preview-dialog__value--muted flex items-center gap-4px m-0 text-[--tjg-text-tertiary] break-words">
              {{ historySummary }}
            </dd>
          </div>
        </dl>

        <div v-if="requireReason" class="room-preview-dialog__reason-section mt-[--tjg-space-1]">
          <span class="block text-[--tjg-text-tertiary]" data-testid="reason-label">
            {{ t('room.discovery.reason_label') }}
          </span>
          <join-reason-input
            v-model="reason"
            :disabled="loading"
            :show-submit="false"
            class="room-preview-dialog__reason mt-[--tjg-space-1]" />
          <p
            v-if="!canJoin"
            class="room-preview-dialog__reason-hint mt-[--tjg-space-1] text-[--tjg-color-danger-500]"
            data-testid="reason-required-hint">
            {{ t('room.discovery.reason_required') }}
          </p>
        </div>
      </n-spin>
    </div>

    <template #footer>
      <div class="room-preview-dialog__footer flex justify-end gap-[--tjg-space-2]">
        <n-button @click="handleCancel">{{ t('room.discovery.cancel') }}</n-button>
        <n-button
          type="primary"
          :disabled="!canJoin || loading"
          :loading="loading"
          data-testid="room-preview-join-btn"
          @click="handleJoin">
          {{ t('room.discovery.preview_join') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import JoinReasonInput from './JoinReasonInput.vue'
import type { RoomCardData } from './RoomCard.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    room: RoomCardData | null
    requireReason?: boolean
    loading?: boolean
  }>(),
  {
    requireReason: false,
    loading: false
  }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  join: [roomId: string, reason?: string]
  cancel: []
}>()

const { t } = useI18n()

const reason = ref('')

const canJoin = computed(() => !props.requireReason || reason.value.trim().length > 0)

const historySummary = computed(() => {
  if (props.room?.topic) {
    return props.room.topic.length > 120 ? `${props.room.topic.slice(0, 120)}...` : props.room.topic
  }
  return t('room.discovery.preview_no_history')
})

const close = () => {
  emit('update:visible', false)
}

const handleUpdateVisible = (value: boolean) => {
  emit('update:visible', value)
}

const handleCancel = () => {
  emit('cancel')
  close()
}

const handleJoin = () => {
  if (!props.room || !canJoin.value) return
  emit('join', props.room.roomId, props.requireReason ? reason.value.trim() : undefined)
  close()
}

// 打开对话框时重置理由输入
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      reason.value = ''
    }
  }
)
</script>

<style scoped lang="scss">
.room-preview-dialog__avatar-placeholder {
  font-size: var(--tjg-font-size-xl);
  font-weight: var(--tjg-font-weight-medium);
}

.room-preview-dialog__name {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-semibold);
}

.room-preview-dialog__federated {
  font-size: var(--tjg-font-size-2xs);
  line-height: 1.4;
}

.room-preview-dialog__label {
  font-size: var(--tjg-font-size-sm);
}

.room-preview-dialog__value {
  font-size: var(--tjg-font-size-sm);
}
</style>
