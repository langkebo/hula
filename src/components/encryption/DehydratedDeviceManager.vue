<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.dehydrated_device.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    style="width: 600px; max-width: 90vw">
    <n-spin :show="loading">
      <div class="device-list">
        <div v-if="devices.length === 0" class="empty-state">
          <Icon icon="mdi:cellphone-off" :width="48" />
          <p>{{ t('encryption.dehydrated_device.no_devices') }}</p>
        </div>
        <div v-for="device in devices" :key="device.deviceId" class="device-item">
          <div class="device-info">
            <div class="device-header">
              <Icon icon="mdi:cellphone-link" :width="20" />
              <span class="device-id">{{ device.deviceId }}</span>
            </div>
            <n-descriptions label-placement="left" :column="1" size="small">
              <n-descriptions-item :label="t('encryption.dehydrated_device.device_name')">
                {{ device.initialDeviceDisplayName || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('encryption.dehydrated_device.algorithm')">
                {{ getDeviceAlgorithm(device) }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('encryption.dehydrated_device.state')">
                <n-tag :type="getDeviceStateType(device)" size="small">
                  {{ getDeviceState(device) }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item :label="t('encryption.dehydrated_device.created_at')">
                {{ formatDate(device.createdAt) }}
              </n-descriptions-item>
            </n-descriptions>
          </div>
          <div class="device-actions">
            <n-button size="small" type="primary" @click="handleClaim(device.deviceId)">
              <template #icon><Icon icon="mdi:key-variant" :width="16" /></template>
              {{ t('encryption.dehydrated_device.claim') }}
            </n-button>
            <n-popconfirm @positive-click="handleDelete(device.deviceId)">
              <template #trigger>
                <n-button size="small" type="error">
                  <template #icon><Icon icon="mdi:delete" :width="16" /></template>
                  {{ t('encryption.dehydrated_device.delete') }}
                </n-button>
              </template>
              {{ t('encryption.dehydrated_device.delete_confirm') }}
            </n-popconfirm>
          </div>
        </div>
      </div>
    </n-spin>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="handleRefresh">
          <template #icon><Icon icon="mdi:refresh" :width="16" /></template>
          {{ t('encryption.dehydrated_device.refresh') }}
        </n-button>
        <n-button type="primary" @click="handleCreate">
          <template #icon><Icon icon="mdi:plus" :width="16" /></template>
          {{ t('encryption.dehydrated_device.create') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDescriptions, NDescriptionsItem, NModal, NPopconfirm, NSpin, NTag } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useDehydratedDevice } from '@/composables/encryption/useDehydratedDevice'
import type { DehydratedDevice } from '@/services/matrix/crypto/MatrixDehydratedDeviceService'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const {
  devices,
  loading,
  loadDehydratedDevices,
  createDehydratedDevice,
  claimDehydratedDevice,
  deleteDehydratedDevice
} = useDehydratedDevice()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<(e: 'update:show', value: boolean) => void>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const claimKeyInput = ref<Record<string, string>>({})

onMounted(() => {
  if (props.show) {
    loadDehydratedDevices()
  }
})

watch(
  () => props.show,
  (val) => {
    if (val) {
      loadDehydratedDevices()
    }
  }
)

function getDeviceAlgorithm(device: DehydratedDevice): string {
  if (device.deviceData && 'algorithm' in device.deviceData) {
    return String(device.deviceData.algorithm)
  }
  return 'Unknown'
}

function getDeviceState(device: DehydratedDevice): string {
  if (device.expiresAt && device.expiresAt < Date.now()) {
    return t('encryption.dehydrated_device.state_expired')
  }
  return t('encryption.dehydrated_device.state_active')
}

function getDeviceStateType(device: DehydratedDevice): 'success' | 'warning' | 'error' {
  if (device.expiresAt && device.expiresAt < Date.now()) {
    return 'warning'
  }
  return 'success'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

async function handleRefresh() {
  await loadDehydratedDevices()
  showFeedback(t('encryption.dehydrated_device.refresh_success'), 'success')
}

async function handleCreate() {
  const result = await createDehydratedDevice()
  if (result) {
    showFeedback(t('encryption.dehydrated_device.create_success'), 'success')
  } else {
    showFeedback(t('encryption.dehydrated_device.create_failed'), 'error')
  }
}

async function handleClaim(deviceId: string) {
  const signingPubKey = claimKeyInput.value[deviceId] || ''
  const result = await claimDehydratedDevice(deviceId, signingPubKey)
  if (result) {
    showFeedback(t('encryption.dehydrated_device.claim_success'), 'success')
  } else {
    showFeedback(t('encryption.dehydrated_device.claim_failed'), 'error')
  }
}

async function handleDelete(deviceId: string): Promise<void> {
  const success = await deleteDehydratedDevice(deviceId)
  if (success) {
    showFeedback(t('encryption.dehydrated_device.delete_success'), 'success')
  } else {
    showFeedback(t('encryption.dehydrated_device.delete_failed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
  color: var(--tjg-text-secondary);

  p {
    margin: 0;
    font-size: 14px;
  }
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.device-id {
  font-family: monospace;
  font-size: 13px;
  font-weight: 500;
  word-break: break-all;
}

.device-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.dialog-footer .n-button {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
</style>
