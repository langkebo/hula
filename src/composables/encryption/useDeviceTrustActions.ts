import { computed, type Ref, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import type { DeviceInfo } from '@/services/matrix/crypto/cryptoAdapterTypes'
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
    blockedDevices,
    error,
    loadDevices,
    trustDevice,
    untrustDevice,
    blockDevice,
    unblockDevice
  } = useDeviceTrust()

  /**
   * 房间内未通过**交叉签名**验证的设备。
   *
   * 唯一事实源是 `CryptoDeviceAdapter.getUnverifiedDevicesInRoom`：
   * 此前这里另有一份 composable 实现，判定用 `isVerified || isCrossSigningVerified`
   * （等于放行本机手动标记），且房间不在本地 store 时返回空数组——正是「静默放行」。
   */
  const unverifiedDevices = ref<DeviceInfo[]>([])

  const activeTab = ref('devices')
  const actionLoading = ref<string | null>(null)
  /**
   * 交叉签名是否已在**本机**建立（`publicKeysOnDevice`）。
   *
   * 不能用 `encryptionStore.crossSigningSetup`：那个字段的语义是「私钥已入 4S」，
   * 名字与含义不符（见 `CryptoSecurityAdapter.getCrossSigningStatus` 的注释）。
   * `null` = 尚未查到，UI 不应据此下结论。
   */
  const crossSigningEstablished = ref<boolean | null>(null)
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

  /**
   * 设备信任的展示三态：交叉签名已验证 / 仅本机标记 / 未验证。
   *
   * 必须先判 `isCrossSigningVerified`：交叉签名验证是身份层面的强证据，
   * 而 `isVerified`（SDK `isVerified()`）还包含「本机手动标记」，二者不可混为一谈。
   * 旧实现先判 `isVerified` 会让交叉签名设备被降级成「warning」。
   */
  function getTrustTagType(device: DeviceTrustInfo): 'success' | 'warning' | 'error' | 'default' {
    if (device.isCrossSigningVerified) return 'success'
    if (device.isVerified) return 'default'
    return 'error'
  }

  function getTrustLabel(device: DeviceTrustInfo): string {
    if (device.isCrossSigningVerified) return t('encryption.device_trust.cross_signed')
    if (device.isVerified) return t('encryption.device_trust.local_only')
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

  function handleVerifyDevice(device: { userId: string; deviceId: string; displayName?: string | undefined }) {
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

  /**
   * 拉取房间内未通过交叉签名的设备。
   *
   * 「查不到」与「确实没有」必须分开：查询失败时清空列表但置 `unverifiedLoadError`，
   * 否则 UI 会显示「该房间全部设备都已验证」—— 一个静默的假安全信号。
   */
  async function loadRoomUnverified(roomId: string): Promise<void> {
    try {
      unverifiedDevices.value = await cryptoSDKAdapter.getUnverifiedDevicesInRoom(roomId)
      unverifiedLoadError.value = false
    } catch (err) {
      logger.warn('Failed to load unverified devices in room:', err)
      unverifiedDevices.value = []
      unverifiedLoadError.value = true
    }
  }

  async function handleRoomSelect(roomId: string | null) {
    selectedRoomId.value = roomId
    if (roomId) {
      await loadRoomUnverified(roomId)
    } else {
      unverifiedDevices.value = []
      unverifiedLoadError.value = false
    }
  }

  /**
   * 读取「交叉签名是否已建立」。
   *
   * 这个值是「未验证设备」列表的解读前提：没建立交叉签名时，**所有**设备都会
   * 落进未验证清单——用户看到满屏红标却不知道为什么，必须给出可操作的出口。
   */
  async function loadCrossSigningEstablished(): Promise<void> {
    try {
      const status = await cryptoSDKAdapter.getCrossSigningStatus()
      crossSigningEstablished.value = status.publicKeysOnDevice
    } catch (err) {
      logger.warn('Failed to read cross-signing status:', err)
      crossSigningEstablished.value = null
    }
  }

  async function handleRefresh() {
    try {
      devicesLoadError.value = false
      unverifiedLoadError.value = false
      await loadCrossSigningEstablished()
      const client = matrixEncryptionService['getClient']()
      const userId = (client as { getUserId?: () => string }).getUserId?.()
      if (userId) {
        await loadDevices(userId)
        devicesLoadError.value = Boolean(error.value)
      }
      if (selectedRoomId.value) {
        await loadRoomUnverified(selectedRoomId.value)
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
    crossSigningEstablished,
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
