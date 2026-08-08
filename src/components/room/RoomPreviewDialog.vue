<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('room.discovery.preview_title')"
    :bordered="false"
    :style="{ width: '480px', maxWidth: '90vw' }"
    @update:show="handleUpdateVisible">
    <div v-if="room" class="room-preview-dialog" data-testid="room-preview-dialog">
      <n-spin :show="loading">
        <div class="room-preview-dialog__head">
          <div class="room-preview-dialog__avatar">
            <img v-if="room.avatarUrl" :src="room.avatarUrl" :alt="''" class="room-preview-dialog__avatar-img" />
            <span v-else class="room-preview-dialog__avatar-placeholder">
              {{ room.name?.charAt(0) || '?' }}
            </span>
          </div>
          <div class="room-preview-dialog__title">
            <span class="room-preview-dialog__name">{{ room.name }}</span>
            <span v-if="room.isFederated" class="room-preview-dialog__federated" :title="t('room.discovery.federated')">
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

        <dl class="room-preview-dialog__meta">
          <div class="room-preview-dialog__row">
            <dt class="room-preview-dialog__label">{{ t('room.discovery.preview_members') }}</dt>
            <dd class="room-preview-dialog__value">
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
          <div class="room-preview-dialog__row">
            <dt class="room-preview-dialog__label">{{ t('room.discovery.preview_topic') }}</dt>
            <dd class="room-preview-dialog__value room-preview-dialog__value--topic">
              {{ room.topic || t('room.discovery.no_topic') }}
            </dd>
          </div>
          <div class="room-preview-dialog__row">
            <dt class="room-preview-dialog__label">{{ t('room.discovery.preview_history') }}</dt>
            <dd class="room-preview-dialog__value room-preview-dialog__value--muted">
              {{ historySummary }}
            </dd>
          </div>
        </dl>

        <join-reason-input
          v-if="requireReason"
          v-model="reason"
          :disabled="loading"
          :show-submit="false"
          class="room-preview-dialog__reason"
          @submit="handleReasonSubmit" />
      </n-spin>
    </div>

    <template #footer>
      <div class="room-preview-dialog__footer">
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

const handleReasonSubmit = (reasonText: string) => {
  if (!props.room) return
  emit('join', props.room.roomId, reasonText)
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
.room-preview-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
}

.room-preview-dialog__head {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
}

.room-preview-dialog__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-subtle);
}

.room-preview-dialog__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-preview-dialog__avatar-placeholder {
  font-size: var(--tjg-font-size-xl);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.room-preview-dialog__title {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  min-width: 0;
}

.room-preview-dialog__name {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-preview-dialog__federated {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--tjg-radius-xs);
  background: var(--tjg-color-info-100);
  color: var(--tjg-color-info-600);
  font-size: var(--tjg-font-size-2xs);
  line-height: 1.4;
}

.room-preview-dialog__meta {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  margin: 0;
  padding: var(--tjg-space-3);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-panel-muted);
}

.room-preview-dialog__row {
  display: flex;
  align-items: flex-start;
  gap: var(--tjg-space-2);
}

.room-preview-dialog__label {
  flex-shrink: 0;
  width: 64px;
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.room-preview-dialog__value {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
  word-break: break-word;
}

.room-preview-dialog__value--topic {
  color: var(--tjg-text-secondary);
}

.room-preview-dialog__value--muted {
  color: var(--tjg-text-tertiary);
}

.room-preview-dialog__reason {
  margin-top: var(--tjg-space-1);
}

.room-preview-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--tjg-space-2);
}
</style>
