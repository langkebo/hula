<template>
  <Transition name="connection-banner">
    <div v-if="showBanner" class="connection-status-banner" :class="`connection-status-banner--${state}`">
      <div class="connection-status-banner__content">
        <div class="connection-status-banner__icon">
          <n-spin v-if="state === 'reconnecting'" :size="14" />
          <svg v-else-if="state === 'offline'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <svg v-else-if="state === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <span class="connection-status-banner__text">{{ statusText }}</span>
        <button v-if="state === 'error'" class="connection-status-banner__retry" @click="$emit('retry')">
          {{ t('connection.retry') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'error'

const props = withDefaults(
  defineProps<{
    state: ConnectionState
    retryCount?: number
    maxRetries?: number
  }>(),
  {
    retryCount: 0,
    maxRetries: 20
  }
)

defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const showBanner = computed(() => props.state !== 'online')

const statusText = computed(() => {
  switch (props.state) {
    case 'offline':
      return t('connection.offline')
    case 'reconnecting':
      if (props.retryCount > 0) {
        return t('connection.reconnecting_attempt', { count: props.retryCount, max: props.maxRetries })
      }
      return t('connection.reconnecting')
    case 'error':
      return t('connection.failed')
    default:
      return ''
  }
})
</script>

<style scoped>
.connection-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 6px 16px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.connection-status-banner--offline {
  background: var(--color-warning, #f0a020);
  color: #fff;
}

.connection-status-banner--reconnecting {
  background: var(--color-info, #2080f0);
  color: #fff;
}

.connection-status-banner--error {
  background: var(--color-danger, #d03050);
  color: #fff;
}

.connection-status-banner__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.connection-status-banner__icon {
  display: flex;
  align-items: center;
}

.connection-status-banner__text {
  white-space: nowrap;
}

.connection-status-banner__retry {
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  background: transparent;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.connection-status-banner__retry:hover {
  background: rgba(255, 255, 255, 0.15);
}

.connection-banner-enter-active,
.connection-banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.connection-banner-enter-from,
.connection-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
