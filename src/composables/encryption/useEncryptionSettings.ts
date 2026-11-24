import { computed, ref } from 'vue'
import { createLogger } from '@/utils/Logger'
import { useDeviceSessions } from './useDeviceSessions'
import { useEncryption, type VerificationTransaction } from './useEncryption'
import { useEncryptionOverview } from './useEncryptionOverview'
import { useGlobalStrictMode } from './useGlobalStrictMode'

const logger = createLogger('useEncryptionSettings')

interface RefreshEncryptionSettingsOptions {
  /** 是否加载桌面端专属的设备详情（本机指纹 + 待处理验证请求）；移动端无对应视图，默认关闭 */
  includeDeviceDetails?: boolean
}

interface RefreshEncryptionSettingsResult {
  encryptionEnabled: boolean
  devicesLoaded: boolean
}

/**
 * 加密设置页的双端共享实现（桌面 Naive UI / 移动 Vant 共用）。
 *
 * 承载加密总览、设备会话、严格模式、设备统计、设备指纹与待处理验证请求，
 * 并统一「总览 → 设备详情 → 设备列表」的刷新顺序；两端页面只保留视图与交互壳。
 */
export function useEncryptionSettings() {
  const overview = useEncryptionOverview()
  const sessions = useDeviceSessions()
  const strictMode = useGlobalStrictMode()
  const { getDeviceFingerprint, getPendingVerifications, cancelVerification } = useEncryption()

  const deviceFingerprint = ref('')
  const pendingVerifications = ref<VerificationTransaction[]>([])

  // 「已验证设备」只认交叉签名验证：isVerified 还包含「本机手动标记」，不能计入已验证
  const verifiedDevicesCount = computed(
    () => sessions.devices.value.filter((device) => device.crossSigningVerified).length
  )
  const unverifiedDevicesCount = computed(
    () => sessions.devices.value.filter((device) => !device.crossSigningVerified).length
  )

  function formatFingerprint(key: string): string {
    return key.match(/.{1,4}/g)?.join(' ') || key
  }

  async function loadDeviceDetails() {
    try {
      const fingerprint = await getDeviceFingerprint()
      deviceFingerprint.value = fingerprint ? formatFingerprint(fingerprint) : ''
      pendingVerifications.value = await getPendingVerifications()
    } catch (error) {
      logger.error('Failed to load encryption device details', error)
    }
  }

  /**
   * 双端统一刷新入口：先刷新加密总览，再按需加载设备详情，最后刷新设备会话列表。
   */
  async function refreshEncryptionSettings(
    options: RefreshEncryptionSettingsOptions = {}
  ): Promise<RefreshEncryptionSettingsResult> {
    const encryptionEnabled = await overview.loadOverview()
    if (encryptionEnabled && options.includeDeviceDetails) {
      await loadDeviceDetails()
    }
    const devicesLoaded = await sessions.loadDevices()
    return { encryptionEnabled, devicesLoaded }
  }

  async function cancelPendingVerification(transactionId: string): Promise<void> {
    await cancelVerification(transactionId, 'User cancelled verification')
    pendingVerifications.value = pendingVerifications.value.filter((item) => item.transactionId !== transactionId)
  }

  return {
    ...overview,
    devices: sessions.devices,
    devicesLoading: sessions.loading,
    currentDeviceId: sessions.currentDeviceId,
    loadDevices: sessions.loadDevices,
    deleteDevice: sessions.deleteDevice,
    startDeviceVerification: sessions.startVerification,
    strictModeEnabled: strictMode.enabled,
    setStrictMode: strictMode.setEnabled,
    deviceFingerprint,
    pendingVerifications,
    verifiedDevicesCount,
    unverifiedDevicesCount,
    refreshEncryptionSettings,
    cancelPendingVerification
  }
}
