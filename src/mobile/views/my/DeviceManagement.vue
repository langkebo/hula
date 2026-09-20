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
              :label="formatDeviceLabel(device)"
              is-link
              @click="
                selectedDevice = device
                showDeviceActionSheet = true
              ">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center">
                  <Icon :icon="getDeviceIcon(device)" :width="20" color="var(--tjg-text-secondary)" />
                </div>
              </template>
              <template #right-icon>
                <div class="flex items-center gap-4px">
                  <van-tag v-if="device.deviceId === currentDeviceId" type="primary" size="medium">
                    {{ t('mobile_devices.current') }}
                  </van-tag>
                  <van-tag v-if="device.isVerified && !isCurrentDevice(device.deviceId)" type="success" size="medium">
                    {{ t('mobile_devices.verified') }}
                  </van-tag>
                  <van-tag v-if="device.isBlocked" type="danger" size="medium">
                    {{ t('mobile_devices.blocked') }}
                  </van-tag>
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <!-- 操作按钮组 -->
          <div v-if="devices.length > 0" class="mt-16px px-16px flex flex-col gap-8px">
            <van-button
              v-if="hasUnverifiedOrUnblockedDevices"
              type="primary"
              block
              @click="showDeviceActionSheet = true">
              {{ t('mobile_devices.trust_all') }}
            </van-button>
            <van-button type="danger" block plain @click="handleDeleteOtherDevices">
              {{ t('mobile_devices.delete_other') }}
            </van-button>
          </div>

          <!-- 设备操作面板 -->
          <van-action-sheet
            v-model:show="showDeviceActionSheet"
            :title="t('mobile_devices.actions')"
            :actions="deviceActions"
            @select="handleActionSelect" />
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceManagement')

const { t } = useI18n()

// Use the unified device trust composable (keys/query based)
const {
  loading,
  devices: trustDevices,
  unverifiedDevices,
  blockedDevices,
  loadDevices: loadTrustDevices,
  trustDevice,
  untrustDevice,
  blockDevice,
  unblockDevice
} = useDeviceTrust()

const currentDeviceId = ref<string>('')
const showDeviceActionSheet = ref(false)
const selectedDevice = ref<DeviceTrustInfo | null>(null)

// Unified devices ref (exposes trust info for rendering)
const devices = computed(() => trustDevices.value)

// Action sheet buttons (dynamically shown based on selected device state)
const deviceActions = computed(() => {
  const actions = []
  if (selectedDevice.value) {
    if (!selectedDevice.value.isVerified && !isCurrentDevice(selectedDevice.value.deviceId)) {
      actions.push({ name: 'trust', text: t('mobile_devices.trust_device') })
    }
    if (selectedDevice.value.isVerified && !isCurrentDevice(selectedDevice.value.deviceId)) {
      actions.push({ name: 'untrust', text: t('mobile_devices.untrust_device') })
    }
    if (!selectedDevice.value.isBlocked && !isCurrentDevice(selectedDevice.value.deviceId)) {
      actions.push({ name: 'block', text: t('mobile_devices.block_device') })
    }
    if (selectedDevice.value.isBlocked) {
      actions.push({ name: 'unblock', text: t('mobile_devices.unblock_device') })
    }
  }
  return actions
})

// Whether there are any unverified/unblocked devices (for "trust all" button)
const hasUnverifiedOrUnblockedDevices = computed(() => {
  return devices.value.some((d) => !d.isVerified || !d.isBlocked)
})

onMounted(async () => {
  await loadDevices()
})
async function loadDevices() {
  try {
    currentDeviceId.value = matrixDeviceService.getCurrentDeviceId() || ''
    const userId = matrixClientService.getUserId() || ''
    if (userId) {
      await loadTrustDevices(userId)
    }
  } catch (error) {
    logger.error('Failed to load devices', error)
    showToast({ type: 'fail', message: t('mobile_devices.load_failed') })
  }
}

function isCurrentDevice(deviceId: string): boolean {
  return deviceId === currentDeviceId.value
}

function getDeviceIcon(device: DeviceTrustInfo): string {
  const ua = device.lastSeenIp || ''
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mdi:cellphone'
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'mdi:tablet'
  }
  return 'mdi:laptop'
}

function formatDeviceLabel(device: DeviceTrustInfo): string {
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

// 设备操作选择（信任/取消信任/屏蔽/解除屏蔽）
async function handleActionSelect(action: { name: string }) {
  if (!selectedDevice.value) return
  const device = selectedDevice.value
  const userId = device.userId
  const deviceId = device.deviceId

  try {
    switch (action.name) {
      case 'trust':
        await showConfirmDialog({
          title: t('mobile_devices.trust_device'),
          message: t('mobile_devices.trust_confirm', { name: device.displayName || t('mobile_devices.unnamed_device') })
        })
        await trustDevice(userId, deviceId)
        showToast(t('mobile_devices.trust_success'))
        break
      case 'untrust':
        await showConfirmDialog({
          title: t('mobile_devices.untrust_device'),
          message: t('mobile_devices.untrust_confirm')
        })
        await untrustDevice(userId, deviceId)
        showToast(t('mobile_devices.untrust_success'))
        break
      case 'block':
        await showConfirmDialog({
          title: t('mobile_devices.block_device'),
          message: t('mobile_devices.block_confirm')
        })
        await blockDevice(userId, deviceId)
        showToast(t('mobile_devices.block_success'))
        break
      case 'unblock':
        await unblockDevice(userId, deviceId)
        showToast(t('mobile_devices.unblock_success'))
        break
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error(`Device ${action.name} failed`, error)
      showToast(t(`mobile_devices.${action.name}_failed`))
    }
  }
  showDeviceActionSheet.value = false
}

async function handleDeleteDevice(device: DeviceTrustInfo) {
  try {
    await showConfirmDialog({
      title: t('mobile_devices.delete_confirm.title'),
      message: t('mobile_devices.delete_confirm.message', {
        name: device.displayName || t('mobile_devices.unnamed_device')
      }),
      confirmButtonText: t('mobile_devices.delete_confirm.confirm'),
      cancelButtonText: t('mobile_devices.delete_confirm.cancel')
    })

    await matrixDeviceService.deleteDevice(device.deviceId)
    showToast({
      type: 'success',
      message: t('mobile_devices.delete_success')
    })
    await loadDevices()
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to delete device', error)
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
    await matrixDeviceService.deleteDevices(deviceIds)
    showToast({
      type: 'success',
      message: t('mobile_devices.delete_success')
    })
    await loadDevices()
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to delete devices in batch', error)
      showToast({
        type: 'fail',
        message: t('mobile_devices.delete_failed')
      })
    }
  }
}
</script>

<style scoped></style>
