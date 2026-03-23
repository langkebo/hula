<template>
  <div class="connection-status" :class="`connection-status--${status}`">
    <div class="connection-status__indicator"></div>
    <span class="connection-status__text">{{ statusText }}</span>
    <span v-if="showRetry && status === 'error'" class="connection-status__retry" @click="handleRetry">重试</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ConnectionState } from '@/services/openclaw'

const props = defineProps<{
  status: ConnectionState | 'disconnected' | 'connecting' | 'connected' | 'error'
  showRetry?: boolean
}>()

const emit = defineEmits<(event: 'retry') => void>()

const statusText = computed(() => {
  switch (props.status) {
    case ConnectionState.Connected:
    case 'connected':
      return '已连接'
    case ConnectionState.Connecting:
    case 'connecting':
      return '连接中...'
    case ConnectionState.Disconnected:
    case 'disconnected':
      return '未连接'
    case ConnectionState.Reconnecting:
      return '重新连接中...'
    case ConnectionState.Error:
    case 'error':
      return '连接失败'
    default:
      return '未知状态'
  }
})

const handleRetry = () => {
  emit('retry')
}
</script>

<style scoped>
.connection-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.connection-status--connected,
.connection-status--success {
  background: rgba(19, 152, 127, 0.1);
  color: #13987f;
}

.connection-status--connecting,
.connection-status--reconnecting {
  background: rgba(250, 173, 20, 0.1);
  color: #faad14;
}

.connection-status--disconnected,
.connection-status--error {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.connection-status__indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.connection-status--connecting .connection-status__indicator,
.connection-status--reconnecting .connection-status__indicator {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.connection-status__retry {
  margin-left: 4px;
  padding: 2px 6px;
  background: currentColor;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.connection-status__retry:hover {
  opacity: 0.9;
}
</style>
