<template>
  <Transition name="conn-banner">
    <div v-if="visible" class="conn-banner" :class="`conn-banner--${state}`">
      <van-loading v-if="spinner" :size="14" color="var(--tjg-text-inverse)" />
      <span class="conn-banner__text">{{ text }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStatus } from '@/composables/useConnectionStatus'

const { t } = useI18n()
const { state } = useConnectionStatus()

const visible = computed(() => state.value !== 'online' && state.value !== 'idle')

const spinner = computed(() => ['connecting', 'reconnecting', 'syncing'].includes(state.value))

const text = computed(() => {
  switch (state.value) {
    case 'connecting':
      return t('mobile_connection.connecting')
    case 'reconnecting':
      return t('mobile_connection.reconnecting')
    case 'syncing':
      return t('mobile_connection.syncing')
    case 'offline':
      return t('mobile_connection.offline')
    case 'error':
      return t('mobile_connection.error')
    default:
      return ''
  }
})
</script>

<style lang="scss" scoped>
.conn-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tjg-text-inverse);
  text-align: center;

  &--connecting,
  &--reconnecting,
  &--syncing {
    background: var(--tjg-color-info-500);
  }

  &--offline {
    background: var(--tjg-color-warning-500);
  }

  &--error {
    background: var(--tjg-color-danger-500);
  }
}

.conn-banner__text {
  white-space: nowrap;
}

.conn-banner-enter-active,
.conn-banner-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.conn-banner-enter-from,
.conn-banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
