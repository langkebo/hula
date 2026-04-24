<template>
  <div class="session-settings">
    <div class="settings-section">
      <h3 class="section-title">当前设备</h3>
      <div class="current-device">
        <div class="device-info">
          <Icon icon="mdi:laptop" :width="32" />
          <div class="device-details">
            <div class="device-name">{{ currentDevice?.displayName || '当前设备' }}</div>
            <div class="device-id">{{ currentDevice?.deviceId }}</div>
          </div>
        </div>
        <div class="device-actions">
          <n-button size="small" @click="showRenameDialog(currentDevice)">重命名</n-button>
          <n-button size="small" @click="loadDevices">
            <template #icon><Icon icon="mdi:refresh" :width="16" /></template>
          </n-button>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">其他设备</h3>
      <n-spin :show="loading">
        <div v-if="otherDevices.length > 0" class="device-list">
          <div v-for="device in otherDevices" :key="device.deviceId" class="device-item">
            <div class="device-info">
              <Icon :icon="getDeviceIcon(device)" :width="24" />
              <div class="device-details">
                <div class="device-name">{{ device.displayName || '未命名设备' }}</div>
                <div class="device-meta">
                  <span v-if="device.lastSeenIp">IP: {{ device.lastSeenIp }}</span>
                  <span v-if="device.lastSeenTs">最后活动: {{ formatDate(device.lastSeenTs) }}</span>
                </div>
              </div>
            </div>
            <div class="device-actions">
              <n-button size="tiny" @click="showRenameDialog(device)">重命名</n-button>
              <n-button size="tiny" type="error" @click="handleDeleteDevice(device)">登出</n-button>
            </div>
          </div>
        </div>
        <n-empty v-else description="没有其他设备" />
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">安全操作</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">登出所有其他设备</span>
          <span class="setting-desc">登出除当前设备外的所有设备</span>
        </div>
        <n-button size="small" type="warning" @click="handleLogoutAllDevices" :disabled="otherDevices.length === 0">
          登出全部
        </n-button>
      </div>
    </div>
  </div>

  <n-modal v-model:show="renameDialogVisible" preset="dialog" title="重命名设备">
    <n-form>
      <n-form-item label="设备名称">
        <n-input v-model:value="newDeviceName" placeholder="请输入设备名称" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-button @click="renameDialogVisible = false">取消</n-button>
      <n-button type="primary" @click="handleRenameDevice" :loading="renaming">确定</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NDivider, NSpin, NEmpty, NModal, NForm, NFormItem, NInput, useMessage, useDialog } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { matrixAccountService, type DeviceInfo } from '@/services/matrix/user/MatrixAccountService'
import { useMatrixStore } from '@/stores/domains/chat/matrix'

defineOptions({
  name: 'SessionSettings'
})

const message = useMessage()
const dialog = useDialog()
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
  await loadDevices()
})

async function loadDevices() {
  loading.value = true
  try {
    devices.value = await matrixAccountService.getDevices()
  } catch (error) {
    message.error('获取设备列表失败')
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
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function showRenameDialog(device: DeviceInfo | undefined) {
  if (!device) return
  editingDevice.value = device
  newDeviceName.value = device.displayName || ''
  renameDialogVisible.value = true
}

async function handleRenameDevice() {
  if (!editingDevice.value || !newDeviceName.value.trim()) {
    message.warning('请输入设备名称')
    return
  }

  renaming.value = true
  try {
    await matrixAccountService.setDeviceName(editingDevice.value.deviceId, newDeviceName.value.trim())
    message.success('设备名称已更新')
    renameDialogVisible.value = false
    await loadDevices()
  } catch (error) {
    message.error('重命名失败')
  } finally {
    renaming.value = false
  }
}

function handleDeleteDevice(device: DeviceInfo) {
  dialog.warning({
    title: '登出设备',
    content: `确定要登出设备 "${device.displayName || device.deviceId}" 吗？该设备将无法再访问您的账户。`,
    positiveText: '确定登出',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await matrixAccountService.deleteDevice(device.deviceId)
        message.success('设备已登出')
        await loadDevices()
      } catch (error) {
        message.error('登出失败')
      }
    }
  })
}

function handleLogoutAllDevices() {
  const deviceIds = otherDevices.value.map((d) => d.deviceId)
  if (deviceIds.length === 0) return

  dialog.warning({
    title: '登出所有其他设备',
    content: `确定要登出所有其他设备吗？共 ${deviceIds.length} 个设备将被登出。`,
    positiveText: '确定登出',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await matrixAccountService.deleteDevices(deviceIds)
        message.success('所有其他设备已登出')
        await loadDevices()
      } catch (error) {
        message.error('批量登出失败')
      }
    }
  })
}
</script>

<style scoped>
.session-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.current-device {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: var(--color-info-light);
  border-radius: 8px;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .device-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.device-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: 14px;
  font-weight: 500;
}

.device-id,
.device-meta {
  font-size: 12px;
  color: var(--color-text-quaternary);
}

.device-meta {
  display: flex;
  gap: 12px;
}

.device-actions {
  display: flex;
  gap: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}
</style>
