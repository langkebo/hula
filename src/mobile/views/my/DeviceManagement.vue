<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_devices.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_devices.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_devices.subtitle') }}</div>

          <van-cell-group inset>
            <van-cell
              v-for="device in devices"
              :key="device.deviceId"
              :title="device.displayName || t('mobile_devices.unnamed_device')"
              :label="formatDeviceLabel(device)">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center">
                  <Icon :icon="getDeviceIcon(device)" :width="20" color="#666" />
                </div>
              </template>
              <template #right-icon>
                <van-button
                  v-if="!isCurrentDevice(device.deviceId)"
                  size="small"
                  type="danger"
                  plain
                  @click.stop="handleDeleteDevice(device)">
                  {{ t('mobile_devices.delete') }}
                </van-button>
                <van-tag v-else type="primary">{{ t('mobile_devices.current') }}</van-tag>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px px-16px">
            <van-button type="danger" block plain @click="handleDeleteOtherDevices">
              {{ t('mobile_devices.delete_other') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { matrixAccountService, type DeviceInfo } from '@/services/matrix/MatrixAccountService'
import { matrixClientService } from '@/services/matrix'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const devices = ref<DeviceInfo[]>([])
const loading = ref(false)
const currentDeviceId = ref<string>('')

onMounted(async () => {
  await loadDevices()
})

async function loadDevices() {
  loading.value = true
  try {
    const client = matrixClientService.getClient()
    if (client) {
      currentDeviceId.value = client.getDeviceId() || ''
    }
    devices.value = await matrixAccountService.getDevices()
  } catch (error) {
    console.error('[MobileDevices] 获取设备列表失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_devices.load_failed')
    })
  } finally {
    loading.value = false
  }
}

function isCurrentDevice(deviceId: string): boolean {
  return deviceId === currentDeviceId.value
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

function formatDeviceLabel(device: DeviceInfo): string {
  const parts: string[] = []
  if (device.lastSeenIp) {
    parts.push(device.lastSeenIp)
  }
  if (device.lastSeenTs) {
    const date = new Date(device.lastSeenTs)
    parts.push(date.toLocaleDateString())
  }
  return parts.join(' · ') || t('mobile_devices.no_info')
}

async function handleDeleteDevice(device: DeviceInfo) {
  try {
    await showConfirmDialog({
      title: t('mobile_devices.delete_confirm.title'),
      message: t('mobile_devices.delete_confirm.message', {
        name: device.displayName || t('mobile_devices.unnamed_device')
      }),
      confirmButtonText: t('mobile_devices.delete_confirm.confirm'),
      cancelButtonText: t('mobile_devices.delete_confirm.cancel')
    })

    await matrixAccountService.deleteDevice(device.deviceId)
    showToast({
      type: 'success',
      message: t('mobile_devices.delete_success')
    })
    await loadDevices()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[MobileDevices] 删除设备失败:', error)
      showToast({
        type: 'fail',
        message: t('mobile_devices.delete_failed')
      })
    }
  }
}

async function handleDeleteOtherDevices() {
  const otherDevices = devices.value.filter((d) => !isCurrentDevice(d.deviceId))
  if (otherDevices.length === 0) {
    showToast(t('mobile_devices.no_other_devices'))
    return
  }

  try {
    await showConfirmDialog({
      title: t('mobile_devices.delete_other_confirm.title'),
      message: t('mobile_devices.delete_other_confirm.message', { count: otherDevices.length }),
      confirmButtonText: t('mobile_devices.delete_other_confirm.confirm'),
      cancelButtonText: t('mobile_devices.delete_other_confirm.cancel')
    })

    const deviceIds = otherDevices.map((d) => d.deviceId)
    await matrixAccountService.deleteDevices(deviceIds)
    showToast({
      type: 'success',
      message: t('mobile_devices.delete_success')
    })
    await loadDevices()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[MobileDevices] 批量删除设备失败:', error)
      showToast({
        type: 'fail',
        message: t('mobile_devices.delete_failed')
      })
    }
  }
}
</script>

<style scoped></style>
