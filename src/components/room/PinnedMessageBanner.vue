<template>
  <div v-if="visible" class="pinned-banner" role="status">
    <div class="pinned-banner__content">
      <svg class="pinned-banner__icon">
        <use href="#pin"></use>
      </svg>
      <div class="pinned-banner__text">
        <span class="pinned-banner__summary">{{ summary }}</span>
        <span class="pinned-banner__meta">{{ meta }}</span>
      </div>
    </div>
    <div class="pinned-banner__actions">
      <button type="button" class="pinned-banner__btn pinned-banner__btn--view" @click="handleView">
        {{ t('pinned_message.view') }}
      </button>
      <button
        type="button"
        class="pinned-banner__btn pinned-banner__btn--close"
        :aria-label="t('pinned_message.dismiss')"
        @click="handleDismiss">
        <svg class="pinned-banner__close-icon">
          <use href="#close"></use>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePinnedMessage } from '@/composables/room/usePinnedMessage'
import { formatChatTime } from '@/utils/ComputedTime'

const props = defineProps<{
  roomId: string | null | undefined
}>()

const emit = defineEmits<{
  (e: 'view', payload: { eventId: string }): void
  (e: 'dismiss'): void
}>()

const { t } = useI18n()

const { latestPinnedMessage, dismissed, load, dismiss } = usePinnedMessage({
  roomId: () => props.roomId
})

const visible = computed(() => latestPinnedMessage.value !== null && !dismissed.value)

const MAX_SUMMARY_LENGTH = 100

const summary = computed(() => {
  const msg = latestPinnedMessage.value
  if (!msg) return ''
  const body = msg.body || ''
  return body.length > MAX_SUMMARY_LENGTH ? `${body.slice(0, MAX_SUMMARY_LENGTH)}…` : body
})

const meta = computed(() => {
  const msg = latestPinnedMessage.value
  if (!msg) return ''
  const time = formatChatTime(msg.timestamp)
  return t('pinned_message.pinned_by', { name: msg.sender }) + ' · ' + time
})

const handleView = () => {
  const msg = latestPinnedMessage.value
  if (!msg) return
  emit('view', { eventId: msg.eventId })
}

const handleDismiss = () => {
  dismiss()
  emit('dismiss')
}

onMounted(() => {
  void load()
})

watch(
  () => props.roomId,
  () => {
    void load()
  }
)

defineExpose({ load })
</script>

<style scoped>
.pinned-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  margin: 6px 12px 0;
  border-radius: 10px;
  border: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  flex-shrink: 0;
}

.pinned-banner__content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.pinned-banner__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

.pinned-banner__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.pinned-banner__summary {
  font-size: 13px;
  color: var(--tjg-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pinned-banner__meta {
  font-size: 11px;
  color: var(--tjg-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pinned-banner__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}

.pinned-banner__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.pinned-banner__btn--view {
  font-size: 12px;
  color: var(--tjg-color-primary-500);
  padding: 4px 8px;
  border-radius: 6px;
}

.pinned-banner__btn--view:hover {
  background: color-mix(in srgb, var(--tjg-color-primary-500) 12%, transparent);
}

.pinned-banner__btn--close {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--tjg-text-secondary);
}

.pinned-banner__btn--close:hover {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 12%, transparent);
  color: var(--tjg-text-primary);
}

.pinned-banner__close-icon {
  width: 12px;
  height: 12px;
}
</style>
