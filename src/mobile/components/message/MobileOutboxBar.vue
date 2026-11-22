<template>
  <div v-if="failedCount > 0" class="mobile-outbox-bar mobile-outbox-bar--error" data-test="mobile-outbox-bar">
    <span class="mobile-outbox-bar__text" data-test="outbox-failed-text">
      {{ t('mobile_chat.outbox_failed', { count: failedCount }) }}
    </span>
    <button type="button" class="mobile-outbox-bar__action" data-test="outbox-retry-btn" @click="handleRetry">
      {{ t('mobile_chat.outbox_retry') }}
    </button>
    <button type="button" class="mobile-outbox-bar__action" data-test="outbox-clear-btn" @click="handleClear">
      {{ t('mobile_chat.outbox_clear') }}
    </button>
  </div>
  <div v-else-if="pendingCount > 0" class="mobile-outbox-bar" data-test="mobile-outbox-bar">
    <svg class="mobile-outbox-bar__spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="var(--tjg-text-tertiary)" stroke-width="1.5" opacity="0.35" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--tjg-text-secondary)" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <span class="mobile-outbox-bar__text" data-test="outbox-pending-text">
      {{ t('mobile_chat.outbox_pending', { count: pendingCount }) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'

defineOptions({
  name: 'MobileOutboxBar'
})

/** 队列变化没有事件通道，轮询是这里唯一的可见性来源。 */
const POLL_INTERVAL_MS = 15_000

const { t } = useI18n()

const pendingCount = ref(0)
const failedCount = ref(0)

let timer: ReturnType<typeof setInterval> | null = null

const refresh = (): void => {
  pendingCount.value = offlineQueueService.getPendingCount()
  failedCount.value = offlineQueueService.getFailedCount()
}

const handleRetry = (): void => {
  offlineQueueService.retryFailed()
  refresh()
}

const handleClear = (): void => {
  offlineQueueService.clearFailed()
  refresh()
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped lang="scss">
.mobile-outbox-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px;
  box-sizing: border-box;
  background: var(--tjg-surface-panel-muted);
  border-radius: var(--tjg-radius-sm);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);

  &--error {
    color: var(--tjg-color-danger-500);
  }

  &__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__spinner {
    flex: none;
    width: 16px;
    height: 16px;
    animation: mobile-outbox-spin 1s linear infinite;
  }

  &__action {
    position: relative;
    flex: none;
    min-height: 28px;
    padding: 0 10px;
    border: none;
    border-radius: var(--tjg-radius-xs);
    background: transparent;
    font-size: var(--tjg-font-size-sm);
    color: var(--tjg-color-primary-500);
    cursor: pointer;

    /* 视觉保持 28px 行高，上下各扩 8px 把热区补到 44px */
    &::after {
      content: '';
      position: absolute;
      inset: -8px 0;
    }

    &:active {
      background: var(--tjg-surface-list-hover);
    }
  }

  &--error &__action {
    color: var(--tjg-color-danger-500);
  }
}

@keyframes mobile-outbox-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-outbox-bar__spinner {
    animation: none;
  }
}
</style>
