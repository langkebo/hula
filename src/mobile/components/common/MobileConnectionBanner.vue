<template>
  <Transition name="conn-banner">
    <div v-if="visible" class="conn-banner" :class="`conn-banner--${state}`">
      <van-loading v-if="spinner" :size="14" color="var(--tjg-text-inverse)" />
      <span class="conn-banner__text">{{ text }}</span>
      <button v-if="canRetry" type="button" class="conn-banner__retry" :disabled="retrying" @click="handleRetry">
        {{ t('mobile_connection.retry') }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStatus } from '@/composables/useConnectionStatus'

const { t } = useI18n()
const { state, retry } = useConnectionStatus()

const visible = computed(() => state.value !== 'online' && state.value !== 'idle')

const spinner = computed(() => ['connecting', 'reconnecting', 'syncing'].includes(state.value))

// 只有「已确认断开 / 连接失败」才给手动重试；重连中自动退避已在跑，重复点击无意义
const canRetry = computed(() => state.value === 'offline' || state.value === 'error')

const retrying = ref(false)

const handleRetry = async () => {
  if (retrying.value) return
  retrying.value = true
  try {
    await retry()
  } finally {
    retrying.value = false
  }
}

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

.conn-banner__retry {
  margin-left: 8px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 16px;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--tjg-radius-full);
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
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
