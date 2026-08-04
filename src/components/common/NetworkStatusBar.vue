<template>
  <Transition name="network-status-bar">
    <div v-if="isOffline" class="network-status-bar">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="network-status-bar__icon">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span class="network-status-bar__text">{{ t('connection.offline') }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStatus } from '@/composables/useConnectionStatus'

const { t } = useI18n()
const { state } = useConnectionStatus()

const isOffline = computed(() => state.value === 'offline')
</script>

<style scoped>
.network-status-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--tjg-color-warning-500);
  color: var(--tjg-text-inverse);
  font-size: 12px;
  font-weight: 500;
}

.network-status-bar__icon {
  flex-shrink: 0;
}

.network-status-bar__text {
  white-space: nowrap;
}

.network-status-bar-enter-active,
.network-status-bar-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.network-status-bar-enter-from,
.network-status-bar-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
