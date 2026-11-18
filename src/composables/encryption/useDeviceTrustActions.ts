import { computed, type Ref, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import type { RoomInfo } from '@/services/types'
import { useRoomStore } from '@/stores/domains/chat/room'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceTrustManager')

/**
 * DeviceTrustManager 的交互编排：设备信任/屏蔽动作、房间未验证设备筛选、验证对话框目标。
 * 组件保留模板与样式，仅通过该 composable 暴露的状态与动作完成渲染。
 */
export function useDeviceTrustActions(options: { visible: Ref<boolean> }) {
  const { visible } = options
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const roomStore = useRoomStore()

  const {
    loading,
    devices,
    unverifiedDevices,
    blockedDevices,
    error,
    loadDevices,
    trustDevice,
    untrustDevice,
    blockDevice,
    unblockDevice,
    loadUnverifiedDevicesInRoom
  } = useDeviceTrust()

  const activeTab = ref('devices')
  const actionLoading = ref<string | null>(null)
  const selectedRoomId = ref<string | null>(null)
  // 读取失败态：失败不得伪装成「暂无设备」，有缓存时保留旧列表
  const devicesLoadError = ref(false)
  const unverifiedLoadError = ref(false)
  const showVerifyDialog = ref(false)
  const verifyTargetUserId = ref<string | undefined>()
  const verifyTargetDeviceId = ref<string | undefined>()
  const verifyTargetDeviceName = ref<string | undefined>()

  const currentDeviceId = computed(() => matrixEncryptionService.getCurrentDeviceId())

  const roomOptions = computed(() => {
    const rooms: RoomInfo[] = roomStore.roomList || []
    return rooms
      .filter((room: RoomInfo) => room.isEncrypted)
      .map((room: RoomInfo) => ({
        label: room.name || room.roomId,
        value: room.roomId
      }))
  })

  function getTrustTagType(device: DeviceTrustInfo): 'success' | 'warning' | 'error' | 'default' {
    if (device.isVerified) return 'success'
    if (device.isCrossSigningVerified) return 'warning'
    return 'error'
  }

  function getTrustLabel(device: DeviceTrustInfo): string {
    if (device.isVerified) return t('encryption.device_trust.verified')
    if (device.isCrossSigningVerified) return t('encryption.device_trust.cross_signed')
    return t('encryption.device_trust.unverified')
  }

  function formatTimestamp(ts: number): string {
    if (!ts) return ''
    const date = new Date(ts)
    return date.toLocaleString()
  }

  async function handleTrustDevice(device: DeviceTrustInfo) {
    actionLoading.value = `trust-${device.deviceId}`
    try {
      await trustDevice(device.userId, device.deviceId)
      showFeedback(t('encryption.device_trust.trust_success'), 'success')
    } catch (err) {
      logger.error('Failed to trust device:', err)
      showFeedback(t('encryption.device_trust.trust_failed'), 'error')
    } finally {
      actionLoading.value = null
    }
  }

  async function handleUntrustDevice(device: DeviceTrustInfo) {
    actionLoading.value = `untrust-${device.deviceId}`
    try {
      await untrustDevice(device.userId, device.deviceId)
      showFeedback(t('encryption.device_trust.untrust_success'), 'success')
    } catch (err) {
      logger.error('Failed to untrust device:', err)
      showFeedback(t('encryption.device_trust.untrust_failed'), 'error')
    } finally {
      actionLoading.value = null
    }
  }

  async function handleBlockDevice(device: DeviceTrustInfo) {
    actionLoading.value = `block-${device.deviceId}`
    try {
      await blockDevice(device.userId, device.deviceId)
      showFeedback(t('encryption.device_trust.block_success'), 'success')
    } catch (err) {
      logger.error('Failed to block device:', err)
      showFeedback(t('encryption.device_trust.block_failed'), 'error')
    } finally {
      actionLoading.value = null
    }
  }

  async function handleUnblockDevice(device: DeviceTrustInfo) {
    actionLoading.value = `unblock-${device.deviceId}`
    try {
      await unblockDevice(device.userId, device.deviceId)
      showFeedback(t('encryption.device_trust.unblock_success'), 'success')
    } catch (err) {
      logger.error('Failed to unblock device:', err)
      showFeedback(t('encryption.device_trust.unblock_failed'), 'error')
    } finally {
      actionLoading.value = null
    }
  }

  function handleVerifyDevice(device: DeviceTrustInfo) {
    // 必须带上 userId：「未验证设备」「已屏蔽设备」两个 tab 里的条目可能属于**其他用户**，
    // 只传 deviceId 会让对话框把 targetUserId 解析成自己，从而发出
    // (自己, 对方 deviceId) 这种 SDK 侧不存在的验证事务。
    verifyTargetUserId.value = device.userId
    verifyTargetDeviceId.value = device.deviceId
    verifyTargetDeviceName.value = device.displayName || device.deviceId
    showVerifyDialog.value = true
  }

  function handleVerifySuccess() {
    showVerifyDialog.value = false
    void handleRefresh()
  }

  async function handleRoomSelect(roomId: string | null) {
    selectedRoomId.value = roomId
    if (roomId) {
      unverifiedLoadError.value = false
      await loadUnverifiedDevicesInRoom(roomId)
      unverifiedLoadError.value = Boolean(error.value)
    } else {
      unverifiedDevices.value = []
      unverifiedLoadError.value = false
    }
  }

  async function handleRefresh() {
    try {
      devicesLoadError.value = false
      unverifiedLoadError.value = false
      const client = matrixEncryptionService['getClient']()
      const userId = (client as { getUserId?: () => string }).getUserId?.()
      if (userId) {
        await loadDevices(userId)
        devicesLoadError.value = Boolean(error.value)
      }
      if (selectedRoomId.value) {
        await loadUnverifiedDevicesInRoom(selectedRoomId.value)
        unverifiedLoadError.value = Boolean(error.value)
      }
    } catch (err) {
      logger.error('Failed to refresh:', err)
    }
  }

  function handleClose() {
    visible.value = false
  }

  watch(visible, async (val) => {
    if (val) {
      await handleRefresh()
    }
  })

  return {
    loading,
    devices,
    unverifiedDevices,
    blockedDevices,
    activeTab,
    actionLoading,
    selectedRoomId,
    devicesLoadError,
    unverifiedLoadError,
    showVerifyDialog,
    verifyTargetUserId,
    verifyTargetDeviceId,
    verifyTargetDeviceName,
    currentDeviceId,
    roomOptions,
    getTrustTagType,
    getTrustLabel,
    formatTimestamp,
    handleTrustDevice,
    handleUntrustDevice,
    handleBlockDevice,
    handleUnblockDevice,
    handleVerifyDevice,
    handleVerifySuccess,
    handleRoomSelect,
    handleRefresh,
    handleClose
  }
}
