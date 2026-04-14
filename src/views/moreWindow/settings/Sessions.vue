<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sessions.devices') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-spin :show="loading">
          <n-scrollbar style="max-height: 400px">
            <div v-if="devices.length === 0 && !loading" class="text-(12px #909090) text-center py-20px">
              {{ t('setting.sessions.no_devices') }}
            </div>

            <template v-else>
              <template v-for="(device, index) in devices" :key="device.device_id">
                <n-flex align="center" justify="space-between" class="py-12px">
                  <n-flex align="center" :size="12">
                    <div class="device-icon">
                      <svg class="size-24px">
                        <use :href="device.device_id === currentDeviceId ? '#computer' : '#phone'"></use>
                      </svg>
                    </div>
                    <n-flex vertical :size="4">
                      <n-flex align="center" :size="8">
                        <span class="text-14px">{{ device.displayName || device.deviceId }}</span>
                        <n-tag v-if="device.device_id === currentDeviceId" size="small" type="success">
                          {{ t('setting.sessions.current_device') }}
                        </n-tag>
                      </n-flex>
                      <span class="text-(12px #909090)">
                        {{ t('setting.sessions.last_active') }}:
                        {{ device.lastSeenTs ? formatTime(device.lastSeenTs) : t('setting.sessions.unknown') }}
                      </span>
                      <span class="text-(12px #909090) truncate max-w-300px">
                        {{ device.lastSeenIp || t('setting.sessions.unknown') }}
                      </span>
                    </n-flex>
                  </n-flex>

                  <n-flex :size="8">
                    <n-button size="small" secondary @click="handleRenameDevice(device)">
                      {{ t('setting.sessions.rename') }}
                    </n-button>
                    <n-button
                      v-if="device.device_id !== currentDeviceId"
                      size="small"
                      secondary
                      @click="handleRemoveDevice(device)"
                    >
                      {{ t('setting.sessions.remove') }}
                    </n-button>
                  </n-flex>
                </n-flex>

                <span v-if="index < devices.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
              </template>
            </template>
          </n-scrollbar>
        </n-spin>

        <span class="w-full h-1px bg-[--line-color] my-12px block"></span>

        <n-flex justify="space-between" align="center">
          <span class="text-(12px #909090)"
            >{{ devices.length }} {{ t('setting.sessions.devices') }}</span
          >
          <n-button
            size="small"
            type="error"
            secondary
            :disabled="otherDevices.length === 0"
            @click="handleLogoutAll"
          >
            {{ t('setting.sessions.logout_all') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sessions.login_history') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <div v-if="loginHistory.length === 0" class="text-(12px #909090) text-center py-20px">
          {{ t('setting.sessions.no_history') }}
        </div>

        <template v-else>
          <template v-for="(record, index) in loginHistory" :key="index">
            <n-flex align="center" justify="space-between" class="py-8px">
              <n-flex align="center" :size="12">
                <div class="device-icon-small">
                  <svg class="size-16px">
                    <use :href="record.device_type === 'desktop' ? '#computer' : '#phone'"></use>
                  </svg>
                </div>
                <n-flex vertical :size="2">
                  <span class="text-12px">{{ record.device_name }}</span>
                  <span class="text-(10px #909090)">{{ record.ip_address }}</span>
                </n-flex>
              </n-flex>
              <span class="text-(12px #909090)">{{ formatTime(record.timestamp) }}</span>
            </n-flex>
            <span v-if="index < loginHistory.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
          </template>
        </template>
      </n-flex>
    </n-flex>
  </n-flex>

  <DeviceRenameDialog
    v-model:show="renameDialogVisible"
    :device-id="selectedDevice?.deviceId || ''"
    :current-name="selectedDevice?.displayName"
    @success="handleRenameSuccess"
  />
</template>

<script setup lang="ts">
import { NButton, NTag, NScrollbar, NSpin, useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import DeviceRenameDialog from '@/components/settings/DeviceRenameDialog.vue'
import matrixAccountService, { type DeviceInfo } from '@/services/matrix/MatrixAccountService'
import matrixClientService from '@/services/matrix/MatrixClientService'

interface Device extends DeviceInfo {
  device_id?: string
}

interface LoginRecord {
  device_type: 'desktop' | 'mobile'
  device_name: string
  ip_address: string
  timestamp: number
}

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const renameDialogVisible = ref(false)
const selectedDevice = ref<Device | null>(null)
const loading = ref(false)
const currentDeviceId = ref<string | null>(null)

const devices = ref<Device[]>([])
const loginHistory = ref<LoginRecord[]>([])

const otherDevices = computed(() => devices.value.filter((d) => d.device_id !== currentDeviceId.value))

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const loadDevices = async () => {
  loading.value = true
  try {
    currentDeviceId.value = matrixAccountService.getCurrentDeviceId() ?? null

    const result = await matrixAccountService.getDevices()
    devices.value = result.map((d) => ({
      ...d,
      device_id: d.deviceId
    }))
  } catch (err) {
    message.error(t('setting.sessions.load_failed'))
  } finally {
    loading.value = false
  }
}

const handleRenameDevice = (device: Device) => {
  selectedDevice.value = device
  renameDialogVisible.value = true
}

const handleRenameSuccess = () => {
  message.success(t('setting.sessions.rename_success'))
  loadDevices()
}

const handleRemoveDevice = (device: Device) => {
  dialog.warning({
    title: t('setting.sessions.remove'),
    content: t('setting.sessions.remove_device_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixAccountService.deleteDevice(device.deviceId)
        message.success(t('setting.sessions.device_removed'))
        loadDevices()
      } catch (err) {
        message.error(t('setting.sessions.remove_failed'))
      }
    }
  })
}

const handleLogoutAll = () => {
  dialog.warning({
    title: t('setting.sessions.logout_all'),
    content: t('setting.sessions.logout_all_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const deviceIds = otherDevices.value.map((d) => d.deviceId)
        if (deviceIds.length > 0) {
          await matrixAccountService.deleteDevices(deviceIds)
          message.success(t('setting.sessions.devices_logged_out'))
          loadDevices()
        }
      } catch (err) {
        message.error(t('setting.sessions.logout_all_failed'))
      }
    }
  })
}

onMounted(() => {
  loadDevices()
})
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}

.device-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;

  :deep(.dark) & {
    background: rgba(255, 255, 255, 0.05);
  }
}

.device-icon-small {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 6px;

  :deep(.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
}
</style>
