import { type Ref, ref } from 'vue'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useDeviceTrust')

export interface DeviceTrustInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
  isVerified: boolean
  isCrossSigningVerified: boolean
  isBlocked: boolean
}

export function useDeviceTrust() {
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)
  const devices: Ref<DeviceTrustInfo[]> = ref([])
  const unverifiedDevices: Ref<DeviceTrustInfo[]> = ref([])
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
        device.isVerified = true
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
        device.isVerified = false
        device.isCrossSigningVerified = false
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
      isTofu: false
    }
  }

  async function loadUnverifiedDevicesInRoom(_roomId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // TODO: No direct replacement in MatrixCryptoService yet
      const deviceIds: string[] = []
      const result: DeviceTrustInfo[] = []

      for (const entry of deviceIds) {
        const colonIndex = entry.indexOf(':')
        if (colonIndex === -1) continue
        const entryUserId = entry.substring(0, colonIndex)
        const entryDeviceId = entry.substring(colonIndex + 1)
        if (!entryUserId || !entryDeviceId) continue

        try {
          const status = await matrixCryptoService.getDeviceVerificationStatus(entryUserId, entryDeviceId)
          const trustLevel = {
            isVerified: status.verified,
            isCrossSigningVerified: status.crossSigningVerified,
            isTofu: false
          }
          result.push({
            deviceId: entryDeviceId,
            userId: entryUserId,
            isVerified: trustLevel.isVerified,
            isCrossSigningVerified: trustLevel.isCrossSigningVerified,
            isBlocked: false
          })
        } catch {
          result.push({
            deviceId: entryDeviceId,
            userId: entryUserId,
            isVerified: false,
            isCrossSigningVerified: false,
            isBlocked: false
          })
        }
      }

      unverifiedDevices.value = result
    } catch (err) {
      logger.error('Failed to load unverified devices in room:', err)
      error.value = String(err)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    devices,
    unverifiedDevices,
    blockedDevices,
    loadDevices,
    trustDevice,
    untrustDevice,
    blockDevice,
    unblockDevice,
    getDeviceTrustLevel,
    loadUnverifiedDevicesInRoom
  }
}
