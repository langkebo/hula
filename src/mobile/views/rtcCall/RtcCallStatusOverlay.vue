<template>
  <div v-if="reconnecting" class="reconnecting-banner" role="status" aria-live="polite">
    <van-loading size="16" class="reconnecting-spinner" />
    <span>{{ t('voip.states.reconnecting') }}</span>
  </div>

  <div v-if="permissionDenied" class="permission-denied-banner" role="alert">
    <span>{{ t('voip.errors.mic_permission_denied') }}</span>
    <span>{{ t('voip.errors.mic_permission_guide') }}</span>
  </div>

  <div v-if="!isVideo" class="voice-container">
    <van-image round width="100" height="100" :src="avatarUrl || ''" />
    <span class="user-name">{{ peerName }}</span>
    <span class="call-status">{{ t('voip.states.connected') }}</span>
    <span v-if="durationText" class="call-duration">{{ durationText }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  peerName: string
  callState?: string | null
  durationText?: string | null
  reconnecting: boolean
  permissionDenied?: boolean
  avatarUrl?: string
  isVideo?: boolean
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.reconnecting-banner {
  @apply absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-8px px-16px py-8px text-13px;
  background: var(--tjg-surface-subtle);
  color: var(--tjg-text-primary);
  --van-loading-spinner-color: var(--tjg-color-warning-500);
}

@media (prefers-reduced-motion: reduce) {
  .reconnecting-banner :deep(.van-loading__circular) {
    animation: none;
  }
}

.permission-denied-banner {
  @apply flex flex-col items-center gap-4px px-16px py-8px text-13px;
  color: var(--tjg-text-tertiary);
}

.voice-container {
  @apply flex flex-col items-center justify-center gap-16px flex-1;

  .user-name {
    @apply text-20px font-medium;
    color: var(--tjg-text-primary);
  }

  .call-status {
    @apply text-14px;
    color: var(--tjg-text-tertiary);
  }

  .call-duration {
    @apply text-14px;
    color: var(--tjg-text-secondary);
  }
}
</style>
