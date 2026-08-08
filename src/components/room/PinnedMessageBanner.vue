<template>
  <div v-if="events.length > 0" class="pinned-banner" role="status">
    <div class="pinned-banner__header">
      <svg
        class="pinned-banner__icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M12 17v5" />
        <path
          d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      </svg>
      <span class="pinned-banner__title">{{ t('home.chat_sidebar.pins.title', '置顶消息') }}</span>
      <span class="pinned-banner__count">{{ events.length }}</span>
    </div>
    <div class="pinned-banner__list">
      <div
        v-for="event in events"
        :key="event.eventId"
        class="pinned-banner__item"
        role="button"
        tabindex="0"
        :data-testid="`pinned-item-${event.eventId}`"
        @click="$emit('navigate', event.eventId)"
        @keyup.enter="$emit('navigate', event.eventId)">
        <div class="pinned-banner__text">
          <span class="pinned-banner__sender">{{ event.sender }}</span>
          <span class="pinned-banner__body">{{ summary(event) }}</span>
          <span class="pinned-banner__time">{{ formatTime(event.timestamp) }}</span>
        </div>
        <button
          v-if="canSetSticky"
          type="button"
          class="pinned-banner__cancel"
          data-testid="pinned-cancel-btn"
          :aria-label="t('home.chat_sidebar.pins.cancel', '取消置顶')"
          @click.stop="$emit('cancel-sticky', event.eventId)">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PinnedMessageInfo } from '@/composables/room/usePinnedMessage'
import { formatChatTime } from '@/utils/ComputedTime'

defineOptions({ name: 'PinnedMessageBanner' })

withDefaults(
  defineProps<{
    events: PinnedMessageInfo[]
    canSetSticky?: boolean
  }>(),
  {
    canSetSticky: false
  }
)

defineEmits<{
  (e: 'navigate', eventId: string): void
  (e: 'cancel-sticky', eventId: string): void
}>()

const { t } = useI18n()

const MAX_SUMMARY_LENGTH = 100

const summary = (event: PinnedMessageInfo): string => {
  const body = event.body || ''
  return body.length > MAX_SUMMARY_LENGTH ? `${body.slice(0, MAX_SUMMARY_LENGTH)}…` : body
}

const formatTime = (timestamp: number): string => {
  try {
    return formatChatTime(timestamp)
  } catch {
    return ''
  }
}
</script>

<style scoped>
.pinned-banner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  margin: 6px 12px 0;
  border-radius: var(--tjg-radius-md, 10px);
  border: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  flex-shrink: 0;
}

.pinned-banner__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pinned-banner__icon {
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

.pinned-banner__title {
  font-size: var(--tjg-font-size-sm, 12px);
  font-weight: var(--tjg-font-weight-semibold, 600);
  color: var(--tjg-text-primary);
  flex: 1;
}

.pinned-banner__count {
  font-size: var(--tjg-font-size-xs, 11px);
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.pinned-banner__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
}

.pinned-banner__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--tjg-radius-sm, 8px);
  background: var(--tjg-surface-search, transparent);
  cursor: pointer;
  min-height: 36px;
  transition: background var(--tjg-motion-duration-fast, 150ms) ease;
}

.pinned-banner__item:hover {
  background: color-mix(in srgb, var(--tjg-color-primary-500) 8%, var(--tjg-surface-panel));
}

.pinned-banner__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.pinned-banner__sender {
  font-size: var(--tjg-font-size-sm, 12px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-color-primary-700, var(--tjg-text-primary));
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pinned-banner__body {
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pinned-banner__time {
  font-size: var(--tjg-font-size-xs, 11px);
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.pinned-banner__cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--tjg-radius-sm, 4px);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  transition:
    background var(--tjg-motion-duration-fast, 150ms) ease,
    color var(--tjg-motion-duration-fast, 150ms) ease;
}

.pinned-banner__cancel:hover {
  background: color-mix(in srgb, var(--tjg-color-danger-500) 12%, transparent);
  color: var(--tjg-color-danger-500);
}

@media (prefers-reduced-motion: reduce) {
  .pinned-banner__item,
  .pinned-banner__cancel {
    transition: none;
  }
}
</style>
