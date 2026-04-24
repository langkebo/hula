<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sessions.devices') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-scrollbar style="max-height: 400px">
          <template v-for="(device, index) in devices" :key="device.device_id">
            <n-flex align="center" justify="space-between" class="py-12px">
              <n-flex align="center" :size="12">
                <div class="device-icon">
                  <svg class="size-24px"><use :href="device.is_current ? '#computer' : '#phone'"></use></svg>
                </div>
                <n-flex vertical :size="4">
                  <n-flex align="center" :size="8">
                    <span class="text-14px">{{ device.device_name || device.device_id }}</span>
                    <n-tag v-if="device.is_current" size="small" type="success">
                      {{ t('setting.sessions.current_device') }}
                    </n-tag>
                  </n-flex>
                  <span class="text-(12px --color-text-tertiary)">
                    {{ t('setting.sessions.last_active') }}: {{ formatTime(device.last_seen ?? Date.now()) }}
                  </span>
                  <span class="text-(12px --color-text-tertiary) truncate max-w-300px">{{ device.ip_address }}</span>
                </n-flex>
              </n-flex>

              <n-flex :size="8" v-if="!device.is_current">
                <n-button size="small" secondary @click="handleRemoveDevice(device)">
                  {{ t('setting.sessions.remove') }}
                </n-button>
              </n-flex>
            </n-flex>

            <span v-if="index < devices.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
          </template>
        </n-scrollbar>

        <span class="w-full h-1px bg-[--line-color] my-12px block"></span>

        <n-flex justify="space-between" align="center">
          <span class="text-(12px --color-text-tertiary)">{{ devices.length }} {{ t('setting.sessions.devices') }}</span>
          <n-button size="small" type="error" secondary @click="handleLogoutAll">
            {{ t('setting.sessions.logout_all') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.sessions.login_history') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <div v-if="loginHistory.length === 0" class="text-(12px --color-text-tertiary) text-center py-20px">
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
                  <span class="text-(12px --color-text-tertiary)">{{ record.ip_address }}</span>
                </n-flex>
              </n-flex>
              <span class="text-(12px --color-text-tertiary)">{{ formatTime(record.timestamp) }}</span>
            </n-flex>
            <span v-if="index < loginHistory.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
          </template>
        </template>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { NButton, NTag, NScrollbar, useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'

interface Device {
  device_id: string
  device_name?: string
  ip_address?: string
  last_seen?: number
  is_current?: boolean
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

const devices = ref<Device[]>([
  {
    device_id: 'CURRENT_DEVICE',
    device_name: '当前设备',
    ip_address: '192.168.1.100',
    last_seen: Date.now(),
    is_current: true
  }
])

const loginHistory = ref<LoginRecord[]>([
  {
    device_type: 'desktop',
    device_name: 'MacBook Pro',
    ip_address: '192.168.1.100',
    timestamp: Date.now() - 86400000
  },
  {
    device_type: 'mobile',
    device_name: 'iPhone 14',
    ip_address: '10.0.0.5',
    timestamp: Date.now() - 172800000
  }
])

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const handleRemoveDevice = (device: Device) => {
  dialog.warning({
    title: t('setting.sessions.remove'),
    content: t('setting.sessions.remove_device_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      const index = devices.value.findIndex((d) => d.device_id === device.device_id)
      if (index > -1) {
        devices.value.splice(index, 1)
      }
      message.success(t('setting.sessions.device_removed'))
    }
  })
}

const handleLogoutAll = () => {
  dialog.warning({
    title: t('setting.sessions.logout_all'),
    content: t('setting.sessions.logout_all_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      devices.value = devices.value.filter((d) => d.is_current)
      message.success(t('setting.sessions.devices_logged_out'))
    }
  })
}
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
