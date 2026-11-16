<template>
  <n-divider />
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.push.device_endpoints.title') }}</h3>
    <p class="section-desc">{{ t('setting.push.device_endpoints.desc') }}</p>

    <n-spin :show="loading">
      <div v-if="devices.length > 0" class="device-list">
        <div v-for="device in devices" :key="device.device_id" class="device-item" data-testid="push-device-item">
          <div class="device-details">
            <div class="device-name">{{ device.device_id }}</div>
            <div class="device-meta">
              <span>{{ device.push_type }}</span>
              <span v-if="device.platform">{{ device.platform }}</span>
              <span>
                {{
                  device.enabled
                    ? t('setting.push.device_endpoints.enabled')
                    : t('setting.push.device_endpoints.disabled')
                }}
              </span>
              <span v-if="device.created_ts">{{ formatTs(device.created_ts) }}</span>
            </div>
          </div>
          <div class="device-actions">
            <n-button size="tiny" :loading="sendingDeviceId === device.device_id" @click="handleSendTest(device)">
              {{ t('setting.push.device_endpoints.sendTest') }}
            </n-button>
            <n-popconfirm @positive-click="handleUnregister(device.device_id)">
              <template #trigger>
                <n-button size="tiny" type="error">{{ t('setting.push.device_endpoints.remove') }}</n-button>
              </template>
              {{ t('setting.push.device_endpoints.removeConfirm', { device: device.device_id }) }}
            </n-popconfirm>
          </div>
        </div>
      </div>
      <n-empty v-else :description="t('setting.push.device_endpoints.empty')" />
    </n-spin>

    <n-collapse class="register-collapse">
      <n-collapse-item :title="t('setting.push.device_endpoints.register')" name="register">
        <n-form label-placement="top">
          <n-form-item :label="t('setting.push.device_endpoints.deviceId')">
            <n-input
              v-model:value="form.deviceId"
              :placeholder="t('setting.push.device_endpoints.deviceIdPlaceholder')" />
          </n-form-item>
          <n-form-item :label="t('setting.push.device_endpoints.pushToken')">
            <n-input
              v-model:value="form.pushToken"
              :placeholder="t('setting.push.device_endpoints.pushTokenPlaceholder')" />
          </n-form-item>
          <n-form-item :label="t('setting.push.device_endpoints.pushType')">
            <n-select v-model:value="form.pushType" :options="pushTypeOptions" />
          </n-form-item>
          <n-button type="primary" :loading="registering" data-testid="push-device-register" @click="handleRegister">
            {{ t('setting.push.device_endpoints.registerSubmit') }}
          </n-button>
        </n-form>
      </n-collapse-item>
    </n-collapse>
  </div>
  <n-divider />
</template>

<script setup lang="ts">
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDivider,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NSelect,
  NSpin
} from 'naive-ui'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import type { IPushDevice } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'PushDeviceSettings'
})

const logger = createLogger('PushDeviceSettings')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const devices = ref<IPushDevice[]>([])
const loading = ref(false)
const registering = ref(false)
const sendingDeviceId = ref('')

const pushTypeOptions = [
  { label: 'APNs', value: 'apns' },
  { label: 'FCM', value: 'fcm' },
  { label: 'WebPush', value: 'webpush' }
]

const form = reactive({
  deviceId: '',
  pushToken: '',
  pushType: 'fcm'
})

onMounted(() => {
  loadDevices()
})

async function loadDevices() {
  loading.value = true
  try {
    devices.value = await matrixPushService.getPushDevices()
  } catch (error) {
    logger.error('Failed to load push devices', error)
    showFeedback(t('setting.push.device_endpoints.loadFailed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!form.deviceId.trim() || !form.pushToken.trim()) {
    showFeedback(t('setting.push.device_endpoints.required'), 'warning')
    return
  }
  registering.value = true
  try {
    await matrixPushService.registerPushDevice({
      device_id: form.deviceId.trim(),
      push_token: form.pushToken.trim(),
      push_type: form.pushType
    })
    showFeedback(t('setting.push.device_endpoints.registerSuccess'), 'success')
    form.pushToken = ''
    await loadDevices()
  } catch (error) {
    logger.error('Failed to register push device', error)
    showFeedback(t('setting.push.device_endpoints.registerFailed'), 'error')
  } finally {
    registering.value = false
  }
}

async function handleUnregister(deviceId: string) {
  try {
    await matrixPushService.unregisterPushDevice(deviceId)
    showFeedback(t('setting.push.device_endpoints.removeSuccess'), 'success')
    await loadDevices()
  } catch (error) {
    logger.error('Failed to unregister push device', error)
    showFeedback(t('setting.push.device_endpoints.removeFailed'), 'error')
  }
}

async function handleSendTest(device: IPushDevice) {
  sendingDeviceId.value = device.device_id
  try {
    await matrixPushService.sendPushNotification({
      device_id: device.device_id,
      title: t('setting.push.device_endpoints.testTitle'),
      body: t('setting.push.device_endpoints.testBody')
    })
    showFeedback(t('setting.push.device_endpoints.sendSuccess'), 'success')
  } catch (error) {
    logger.error('Failed to send test push notification', error)
    showFeedback(t('setting.push.device_endpoints.sendFailed'), 'error')
  } finally {
    sendingDeviceId.value = ''
  }
}

function formatTs(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}
</script>

<style scoped>
.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.section-desc {
  margin: calc(var(--tjg-space-2) * -1) 0 var(--tjg-space-4);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-family: monospace;
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.device-meta {
  display: flex;
  gap: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.device-actions {
  display: flex;
  gap: var(--tjg-space-2);
}

.register-collapse {
  margin-top: var(--tjg-space-4);
}
</style>
