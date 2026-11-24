import { type Ref, ref } from 'vue'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useDeviceTrust')

export interface DeviceTrustInfo {
  deviceId: string
  userId: string
  displayName?: string | undefined
  lastSeenTs?: number | undefined
  lastSeenIp?: string | undefined
  isVerified: boolean
  isCrossSigningVerified: boolean
  isBlocked: boolean
}

export function useDeviceTrust() {
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)
  const devices: Ref<DeviceTrustInfo[]> = ref([])
  const blockedDevices: Ref<DeviceTrustInfo[]> = ref([])

  async function loadDevices(userId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const rawDevices = await cryptoSDKAdapter.getDevices(userId)

      const enrichedDevices: DeviceTrustInfo[] = []
      for (const device of rawDevices) {
        try {
          const status = await matrixCryptoService.getDeviceVerificationStatus(userId, device.deviceId)
          enrichedDevices.push({
            deviceId: device.deviceId,
            userId: device.userId,
            displayName: device.displayName,
            lastSeenTs: device.lastSeenTs,
            lastSeenIp: device.lastSeenIp,
            isVerified: status.verified,
            isCrossSigningVerified: status.crossSigningVerified,
            isBlocked: false
          })
        } catch {
          enrichedDevices.push({
            deviceId: device.deviceId,
            userId: device.userId,
            displayName: device.displayName,
            lastSeenTs: device.lastSeenTs,
            lastSeenIp: device.lastSeenIp,
            isVerified: device.isVerified ?? false,
            isCrossSigningVerified: false,
            isBlocked: false
          })
        }
      }

      devices.value = enrichedDevices
      blockedDevices.value = enrichedDevices.filter((d) => d.isBlocked)
    } catch (err) {
      logger.error('Failed to load devices:', err)
      error.value = String(err)
    } finally {
      loading.value = false
    }
  }

  async function trustDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await matrixCryptoService.verifyDevice(userId, deviceId)
      const device = devices.value.find((d) => d.deviceId === deviceId)
      if (device) {
        // 回读真实状态：本地标记不会让 `crossSigningVerified` 变真，不能顺手把它置 true
        const status = await matrixCryptoService.getDeviceVerificationStatus(userId, deviceId)
        device.isVerified = status.verified
        device.isCrossSigningVerified = status.crossSigningVerified
      }
    } catch (err) {
      logger.error('Failed to trust device:', err)
      error.value = String(err)
      throw err
    }
  }

  async function untrustDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await matrixCryptoService.unverifyDevice(userId, deviceId)
      const device = devices.value.find((d) => d.deviceId === deviceId)
      if (device) {
        // 回读真实状态：取消本地信任不应抹掉交叉签名验证结果
        const status = await matrixCryptoService.getDeviceVerificationStatus(userId, deviceId)
        device.isVerified = status.verified
        device.isCrossSigningVerified = status.crossSigningVerified
      }
    } catch (err) {
      logger.error('Failed to untrust device:', err)
      error.value = String(err)
      throw err
    }
  }

  async function blockDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.blockDevice(userId, deviceId)
      const device = devices.value.find((d) => d.deviceId === deviceId)
      if (device) {
        device.isBlocked = true
      }
      blockedDevices.value = devices.value.filter((d) => d.isBlocked)
    } catch (err) {
      logger.error('Failed to block device:', err)
      error.value = String(err)
      throw err
    }
  }

  async function unblockDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.unblockDevice(userId, deviceId)
      const device = devices.value.find((d) => d.deviceId === deviceId)
      if (device) {
        device.isBlocked = false
      }
      blockedDevices.value = devices.value.filter((d) => d.isBlocked)
    } catch (err) {
      logger.error('Failed to unblock device:', err)
      error.value = String(err)
      throw err
    }
  }

  async function getDeviceTrustLevel(
    userId: string,
    deviceId: string
  ): Promise<{ isVerified: boolean; isCrossSigningVerified: boolean; isTofu: boolean }> {
    const status = await matrixCryptoService.getDeviceVerificationStatus(userId, deviceId)
    return {
      isVerified: status.verified,
      isCrossSigningVerified: status.crossSigningVerified,
      isTofu: status.tofu ?? false
    }
  }

  return {
    loading,
    error,
    devices,
    blockedDevices,
    loadDevices,
    trustDevice,
    untrustDevice,
    blockDevice,
    unblockDevice,
    getDeviceTrustLevel
  }
}
