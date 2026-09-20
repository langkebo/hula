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
              @click="openDeviceActions(device)">
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

          <!-- 安全操作区（危险操作独立分区，远离高频区域；方案 3.1.3） -->
          <div v-if="otherDevices.length > 0" class="mt-16px px-16px flex flex-col gap-8px">
            <div class="text-14px text-[--tjg-text-secondary]">{{ t('mobile_devices.danger_section') }}</div>
            <div class="text-12px text-[--tjg-text-tertiary]">{{ t('mobile_devices.logout_other_desc') }}</div>
            <van-button type="danger" block plain @click="handleLogoutOtherDevices">
              {{ t('mobile_devices.logout_other') }}
            </van-button>
          </div>

          <!-- 设备操作面板 -->
          <van-action-sheet
            v-model:show="showDeviceActionSheet"
            :title="t('mobile_devices.actions')"
            :actions="deviceActions"
            @select="handleActionSelect" />

          <!-- 重命名弹窗（方案 3.1.1） -->
          <van-dialog
            v-model:show="showRenameDialog"
            :title="t('mobile_devices.rename_device')"
            show-cancel-button
            :confirm-button-text="t('common.confirm')"
            :cancel-button-text="t('common.cancel')"
            @confirm="handleRenameConfirm">
            <div class="p-16px">
              <van-field
                v-model="renameInput"
                :aria-label="t('mobile_devices.rename_device')"
                :placeholder="t('mobile_devices.rename_placeholder')"
                maxlength="64" />
            </div>
          </van-dialog>
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
const showRenameDialog = ref(false)
const renameInput = ref('')

// Unified devices ref (exposes trust info for rendering)
const devices = computed(() => trustDevices.value)

// Action sheet buttons (dynamically shown based on selected device state)
const deviceActions = computed(() => {
  const actions: Array<{ name: string; text: string }> = []
  const device = selectedDevice.value
  // 当前设备不可操作（方案 3.1：当前设备固定在列表顶部，不可删除）
  if (!device || isCurrentDevice(device.deviceId)) {
    return actions
  }

  actions.push({ name: 'rename', text: t('mobile_devices.rename_device') })

  if (!device.isVerified) {
    actions.push({ name: 'trust', text: t('mobile_devices.trust_device') })
  } else {
    actions.push({ name: 'untrust', text: t('mobile_devices.untrust_device') })
  }

  // 屏蔽/解除屏蔽：SDK 未提供设备屏蔽写入 API，不再提供必然失败的操作项
  // （此前点击只会得到 "blockDevice is not a function" 类错误）

  actions.push({ name: 'logout', text: t('mobile_devices.logout_device') })

  return actions
})

/** 其他设备（用于「安全操作」分区的显示与计数） */
const otherDevices = computed(() => devices.value.filter((d) => !isCurrentDevice(d.deviceId)))

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

/**
 * 设备图标。
 *
 * 历史缺陷：原实现把 `lastSeenIp`（一个 IP 地址）当作 User-Agent 字符串去匹配
 * `mobile`/`ipad`，恒不命中而永远返回笔记本图标。`DeviceTrustInfo` 当前没有
 * UA 字段（`keys/query` 不返回），因此这里返回中性图标而不是臆测设备类型。
 */
function getDeviceIcon(_device: DeviceTrustInfo): string {
  return 'mdi:devices'
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

/** 打开某台设备的操作面板（替代原先非法的多语句内联表达式） */
function openDeviceActions(device: DeviceTrustInfo): void {
  selectedDevice.value = device
  showDeviceActionSheet.value = true
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
      case 'rename':
        renameInput.value = device.displayName || ''
        showRenameDialog.value = true
        break
      case 'logout':
        await showConfirmDialog({
          title: t('mobile_devices.logout_device'),
          message: t('mobile_devices.logout_confirm', {
            name: device.displayName || t('mobile_devices.unnamed_device')
          })
        })
        await matrixDeviceService.deleteDevice(deviceId)
        showToast(t('mobile_devices.logout_success'))
        await loadDevices()
        break
      case 'block':
      case 'unblock':
        // 不再提供这两个操作项；若被旧调用触达则明确告知能力缺失
        showToast(t('mobile_devices.block_unsupported'))
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

/** 重命名确认（方案 3.1.1） */
async function handleRenameConfirm(): Promise<void> {
  const device = selectedDevice.value
  const name = renameInput.value.trim()
  if (!device) return
  if (!name) {
    showToast(t('mobile_devices.rename_empty'))
    return
  }
  try {
    await matrixDeviceService.updateDevice(device.deviceId, name)
    showToast(t('mobile_devices.rename_success'))
    showRenameDialog.value = false
    await loadDevices()
  } catch (error) {
    logger.error('Failed to rename device', error)
    showToast({ type: 'fail', message: t('mobile_devices.rename_failed') })
  }
}

/** 一键登出所有其他设备（方案 3.1.3） */
async function handleLogoutOtherDevices(): Promise<void> {
  const others = otherDevices.value
  if (others.length === 0) {
    showToast(t('mobile_devices.no_other_devices'))
    return
  }
  try {
    await showConfirmDialog({
      title: t('mobile_devices.logout_other_confirm.title'),
      message: t('mobile_devices.logout_other_confirm.message', { count: others.length }),
      confirmButtonText: t('mobile_devices.logout_other_confirm.confirm'),
      cancelButtonText: t('mobile_devices.logout_other_confirm.cancel')
    })
    await matrixDeviceService.deleteDevices(others.map((d) => d.deviceId))
    showToast(t('mobile_devices.logout_other_success'))
    await loadDevices()
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to log out other devices', error)
      showToast({ type: 'fail', message: t('mobile_devices.logout_other_failed') })
    }
  }
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
