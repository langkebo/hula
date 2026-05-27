import { type Ref, ref } from 'vue'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
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

interface ClientWithStoredDevices {
  getStoredDevicesForUser?(userId: string): Promise<StoredDeviceLike[]>
  getDevices?(): Promise<DeviceListResponse | DeviceLike[]>
}

interface StoredDeviceLike {
  deviceId?: string
  userId?: string
  displayName?: string
  isVerified?(): boolean
}

interface DeviceLike {
  device_id?: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  verified?: boolean
}

interface DeviceListResponse {
  devices?: DeviceLike[]
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
      const client = matrixEncryptionService['getClient']() as unknown as ClientWithStoredDevices
      const rawDevices: Array<{
        deviceId: string
        userId: string
        displayName?: string
        lastSeenTs?: number
        lastSeenIp?: string
        isVerified?: boolean
      }> = []

      // Try to get devices via the stored devices API
      try {
        const storedDevices = await client.getStoredDevicesForUser?.(userId)
        if (storedDevices) {
          for (const device of storedDevices) {
            rawDevices.push({
              deviceId: device.deviceId ?? '',
              userId: device.userId ?? userId,
              displayName: device.displayName,
              isVerified: device.isVerified?.() ?? false
            })
          }
        }
      } catch {
        // Fallback: try the HTTP API
        try {
          const response = await client.getDevices?.()
          const deviceArray = Array.isArray(response) ? response : ((response as DeviceListResponse)?.devices ?? [])
          for (const d of deviceArray) {
            rawDevices.push({
              deviceId: d.device_id ?? '',
              userId,
              displayName: d.display_name,
              lastSeenTs: d.last_seen_ts,
              lastSeenIp: d.last_seen_ip,
              isVerified: d.verified ?? false
            })
          }
        } catch {
          // No devices available
        }
      }

      // Enrich with trust level info
      const enrichedDevices: DeviceTrustInfo[] = []
      for (const device of rawDevices) {
        try {
          const trustLevel = await matrixEncryptionService.getDeviceTrustLevel(userId, device.deviceId)
          enrichedDevices.push({
            deviceId: device.deviceId,
            userId: device.userId,
            displayName: device.displayName,
            lastSeenTs: device.lastSeenTs,
            lastSeenIp: device.lastSeenIp,
            isVerified: trustLevel.isVerified,
            isCrossSigningVerified: trustLevel.isCrossSigningVerified,
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
      await matrixEncryptionService.trustDevice(userId, deviceId)
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
      await matrixEncryptionService.untrustDevice(userId, deviceId)
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
      await matrixEncryptionService.blockDevice(userId, deviceId)
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
      await matrixEncryptionService.unblockDevice(userId, deviceId)
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
    return matrixEncryptionService.getDeviceTrustLevel(userId, deviceId)
  }

  async function loadUnverifiedDevicesInRoom(roomId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const deviceIds = await matrixEncryptionService.getUnverifiedDevicesInRoom(roomId)
      const result: DeviceTrustInfo[] = []

      for (const entry of deviceIds) {
        const colonIndex = entry.indexOf(':')
        if (colonIndex === -1) continue
        const entryUserId = entry.substring(0, colonIndex)
        const entryDeviceId = entry.substring(colonIndex + 1)
        if (!entryUserId || !entryDeviceId) continue

        try {
          const trustLevel = await matrixEncryptionService.getDeviceTrustLevel(entryUserId, entryDeviceId)
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
