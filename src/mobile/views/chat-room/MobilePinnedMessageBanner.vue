<template>
  <div v-if="visible" class="mobile-pinned-banner" role="status" @click="handleView">
    <svg class="mobile-pinned-banner__icon">
      <use href="#pin"></use>
    </svg>
    <span class="mobile-pinned-banner__summary">{{ summary }}</span>
    <button
      type="button"
      class="mobile-pinned-banner__close"
      :aria-label="t('pinned_message.dismiss')"
      @click.stop="handleDismiss">
      <svg class="mobile-pinned-banner__close-icon">
        <use href="#close"></use>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePinnedMessage } from '@/composables/room/usePinnedMessage'

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

const MAX_SUMMARY_LENGTH = 60

const summary = computed(() => {
  const msg = latestPinnedMessage.value
  if (!msg) return ''
  const body = msg.body || ''
  return body.length > MAX_SUMMARY_LENGTH ? `${body.slice(0, MAX_SUMMARY_LENGTH)}…` : body
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
.mobile-pinned-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  margin: 0;
  background: var(--hula-surface-panel);
  border-bottom: 1px solid var(--hula-border-default);
  color: var(--hula-text-primary);
  flex-shrink: 0;
  cursor: pointer;
}

.mobile-pinned-banner__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--hula-color-primary-500);
}

.mobile-pinned-banner__summary {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--hula-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-pinned-banner__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--hula-text-secondary);
  flex-shrink: 0;
  cursor: pointer;
}

.mobile-pinned-banner__close:active {
  background: color-mix(in srgb, var(--hula-text-tertiary) 16%, transparent);
}

.mobile-pinned-banner__close-icon {
  width: 12px;
  height: 12px;
}
</style>
