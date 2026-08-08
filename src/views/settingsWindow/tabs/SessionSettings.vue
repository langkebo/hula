<template>
  <div class="session-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sessions.current_device') }}</h3>
      <div class="current-device">
        <div class="device-info">
          <Icon icon="mdi:laptop" :width="32" />
          <div class="device-details">
            <div class="device-name">
              {{ currentDevice?.displayName || t('setting.sessions.current_device_fallback') }}
            </div>
            <div class="device-id">{{ currentDevice?.deviceId }}</div>
          </div>
        </div>
        <div class="device-actions">
          <n-button size="small" @click="showRenameDialog(currentDevice)">{{ t('setting.sessions.rename') }}</n-button>
          <n-button size="small" @click="loadDevices">
            <template #icon><Icon icon="mdi:refresh" :width="16" /></template>
          </n-button>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sessions.other_devices') }}</h3>
      <n-spin :show="loading">
        <div v-if="otherDevices.length > 0" class="device-list">
          <div v-for="device in otherDevices" :key="device.deviceId" class="device-item">
            <div class="device-info">
              <Icon :icon="getDeviceIcon(device)" :width="24" />
              <div class="device-details">
                <div class="device-name">{{ device.displayName || t('setting.sessions.unnamed_device') }}</div>
                <div class="device-meta">
                  <span v-if="device.lastSeenIp">IP: {{ device.lastSeenIp }}</span>
                  <span v-if="device.lastSeenTs">
                    {{ t('setting.sessions.last_active') }}: {{ formatDate(device.lastSeenTs) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="device-actions">
              <n-button size="tiny" @click="showRenameDialog(device)">{{ t('setting.sessions.rename') }}</n-button>
              <n-button size="tiny" type="error" @click="handleDeleteDevice(device)">
                {{ t('setting.sessions.logout') }}
              </n-button>
            </div>
          </div>
        </div>
        <n-empty v-else :description="t('setting.sessions.no_other_devices')" />
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sessions.security_actions') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sessions.logout_all_other_devices') }}</span>
          <span class="setting-desc">{{ t('setting.sessions.logout_all_other_devices_desc') }}</span>
        </div>
        <n-button size="small" type="warning" @click="handleLogoutAllDevices" :disabled="otherDevices.length === 0">
          {{ t('setting.sessions.logout_all_action') }}
        </n-button>
      </div>
    </div>
  </div>

  <n-modal v-model:show="renameDialogVisible" preset="dialog" :title="t('setting.sessions.rename_device_title')">
    <n-form>
      <n-form-item :label="t('setting.sessions.device_name')">
        <n-input v-model:value="newDeviceName" :placeholder="t('setting.sessions.device_name_placeholder')" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-button @click="renameDialogVisible = false">{{ t('setting.common.cancel') }}</n-button>
      <n-button type="primary" @click="handleRenameDevice" :loading="renaming">
        {{ t('setting.common.confirm') }}
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDivider, NEmpty, NForm, NFormItem, NInput, NModal, NSpin, useDialog } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAccount } from '@/composables/user/useAccount'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { type DeviceInfo, matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SessionSettings')

defineOptions({
  name: 'SessionSettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t, locale } = useI18n()
const { getDevices, deleteDevices } = useAccount()
const matrixStore = useMatrixStore()

const loading = ref(false)
const renaming = ref(false)
const devices = ref<DeviceInfo[]>([])
const renameDialogVisible = ref(false)
const newDeviceName = ref('')
const editingDevice = ref<DeviceInfo | null>(null)

const currentDeviceId = computed(() => matrixStore.deviceId)

const currentDevice = computed(() => {
  return devices.value.find((d: DeviceInfo) => d.deviceId === currentDeviceId.value)
})

const otherDevices = computed(() => {
  return devices.value.filter((d: DeviceInfo) => d.deviceId !== currentDeviceId.value)
})

onMounted(async () => {
  // 独立 WebView 窗口需要先恢复 MatrixClient 实例，否则 getClient() 返回 null
  // 导致 BaseMatrixService.getClient() 抛出 client_not_initialized 错误
  logger.info('[SessionSettings] onMounted — 独立 WebView 会话恢复流程启动')
  try {
    await sessionOrchestrator.ensureClientReady()
    await matrixClientService.waitForClientReady({ timeoutMs: 15000 })
    logger.info('[SessionSettings] 会话恢复完成，开始加载设备列表')
  } catch (err) {
    logger.warn('[SessionSettings] 会话恢复失败:', err instanceof Error ? err.message : String(err))
  }
  await loadDevices()
})

async function loadDevices() {
  loading.value = true
  try {
    devices.value = await getDevices()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('[SessionSettings] 获取设备列表失败:', msg)
    showFeedback(t('setting.sessions.fetch_failed'), 'error')
  } finally {
    loading.value = false
  }
}

function getDeviceIcon(device: DeviceInfo): string {
  const ua = device.lastSeenUserAgent?.toLowerCase() || ''
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mdi:cellphone'
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'mdi:tablet'
  }
  return 'mdi:laptop'
}

function formatDate(timestamp: number): string {
  if (!timestamp) return t('setting.sessions.unknown')
  const resolvedLocale = locale.value === 'en' ? 'en-US' : locale.value
  return new Date(timestamp).toLocaleString(resolvedLocale)
}

function showRenameDialog(device: DeviceInfo | undefined) {
  if (!device) return
  editingDevice.value = device
  newDeviceName.value = device.displayName || ''
  renameDialogVisible.value = true
}

async function handleRenameDevice() {
  if (!editingDevice.value || !newDeviceName.value.trim()) {
    showFeedback(t('setting.sessions.enter_device_name'), 'warning')
    return
  }

  renaming.value = true
  try {
    await matrixAccountService.setDeviceName(editingDevice.value.deviceId, newDeviceName.value.trim())
    showFeedback(t('setting.sessions.device_name_updated'), 'success')
    renameDialogVisible.value = false
    await loadDevices()
  } catch (error) {
    showFeedback(t('setting.sessions.rename_failed'), 'error')
  } finally {
    renaming.value = false
  }
}

function handleDeleteDevice(device: DeviceInfo) {
  dialog.warning({
    title: t('setting.sessions.logout_device_title'),
    content: t('setting.sessions.logout_device_confirm', { name: device.displayName || device.deviceId }),
    positiveText: t('setting.sessions.logout_confirm'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixAccountService.deleteDevice(device.deviceId)
        showFeedback(t('setting.sessions.device_logged_out'), 'success')
        await loadDevices()
      } catch (error) {
        showFeedback(t('setting.sessions.logout_failed'), 'error')
      }
    }
  })
}

function handleLogoutAllDevices() {
  const deviceIds = otherDevices.value.map((d) => d.deviceId)
  if (deviceIds.length === 0) return

  dialog.warning({
    title: t('setting.sessions.logout_all_other_devices'),
    content: t('setting.sessions.logout_all_confirm_with_count', { count: String(deviceIds.length) }),
    positiveText: t('setting.sessions.logout_confirm'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: async () => {
      try {
        await deleteDevices(deviceIds)
        showFeedback(t('setting.sessions.all_other_devices_logged_out'), 'success')
        await loadDevices()
      } catch (error) {
        showFeedback(t('setting.sessions.logout_all_failed'), 'error')
      }
    }
  })
}
</script>

<style scoped>
.session-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.current-device {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-4);
  background-color: var(--tjg-color-info-100);
  border-radius: var(--tjg-radius-sm);
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

.device-info {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.device-id,
.device-meta {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.device-meta {
  display: flex;
  gap: var(--tjg-space-3);
}

.device-actions {
  display: flex;
  gap: var(--tjg-space-2);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}
</style>
