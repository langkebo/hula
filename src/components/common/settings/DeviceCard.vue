<script setup lang="ts">
/**
 * 设备卡片组件
 * 用于显示和管理用户设备
 */
import { computed } from 'vue'
import { NCard, NButton, NSpace, NTag, NPopconfirm, NIcon } from 'naive-ui'
import { Icon } from '@iconify/vue'
import type { Device } from '@/services/matrix/MatrixSettingsService'

interface Props {
  device: Device
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  rename: [deviceId: string, name: string]
  delete: [deviceId: string]
}>()

const lastSeenText = computed(() => {
  if (!props.device.lastSeenTs) return '从未活跃'
  const date = new Date(props.device.lastSeenTs)
  return `最后活跃: ${date.toLocaleString()}`
})

const deviceIcon = computed(() => {
  const ua = props.device.userAgent?.toLowerCase() || ''
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mdi:cellphone'
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'mdi:tablet'
  }
  return 'mdi:laptop'
})

const onRename = () => {
  const newName = prompt('输入新名称:', props.device.displayName || '')
  if (newName !== null && newName !== props.device.displayName) {
    emit('rename', props.device.deviceId, newName)
  }
}

const onDelete = () => {
  emit('delete', props.device.deviceId)
}
</script>

<template>
  <n-card
    class="device-card"
    :class="{ 'device-card-current': device.isCurrentDevice }"
    size="small"
  >
    <div class="device-card-header">
      <div class="device-icon">
        <n-icon :size="32">
          <Icon :icon="deviceIcon" />
        </n-icon>
      </div>
      <div class="device-info">
        <div class="device-name">
          {{ device.displayName || device.deviceId }}
          <n-tag v-if="device.isCurrentDevice" type="success" size="small">
            当前设备
          </n-tag>
        </div>
        <div class="device-meta">
          <span class="device-id">ID: {{ device.deviceId }}</span>
          <span v-if="device.lastSeenIp" class="device-ip">
            IP: {{ device.lastSeenIp }}
          </span>
        </div>
        <div class="device-last-seen">
          {{ lastSeenText }}
        </div>
      </div>
    </div>
    <div v-if="device.userAgent" class="device-user-agent">
      {{ device.userAgent }}
    </div>
    <template v-if="!device.isCurrentDevice" #action>
      <n-space>
        <n-button size="small" @click="onRename">
          重命名
        </n-button>
        <n-popconfirm @positive-click="onDelete">
          <template #trigger>
            <n-button size="small" type="error" :loading="loading">
              删除
            </n-button>
          </template>
          确定要删除此设备吗？这将使该设备上的会话失效。
        </n-popconfirm>
      </n-space>
    </template>
  </n-card>
</template>

<style scoped>
.device-card {
  margin-bottom: 12px;
}

.device-card-current {
  border: 1px solid var(--n-success-color);
}

.device-card-header {
  display: flex;
  gap: 12px;
}

.device-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--n-color-modal);
}

.device-info {
  flex: 1;
}

.device-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.device-last-seen {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.device-user-agent {
  margin-top: 8px;
  padding: 8px;
  background: var(--n-color-modal);
  border-radius: 4px;
  font-size: 11px;
  color: var(--n-text-color-3);
  word-break: break-all;
}
</style>
