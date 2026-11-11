import { computed, ref } from 'vue'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixVerificationService } from '@/services/matrix/crypto/MatrixVerificationService'
import { type Device, matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useDeviceSessions')

/** 登录设备的统一视图：会话行（GET /devices）+ 当前设备的验证状态。 */
export interface DeviceSessionInfo {
  deviceId: string
  displayName?: string | undefined
  lastSeenTs?: number | undefined
  lastSeenIp?: string | undefined
  isVerified: boolean
}

/** `GET /devices` 行有两种形状：REST 原始（snake_case）与测试/适配层（camelCase） */
interface DeviceSessionRecord {
  device_id?: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  deviceId?: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
}

function normalizeDevice(raw: DeviceSessionRecord): DeviceSessionInfo | null {
  const deviceId = raw.device_id ?? raw.deviceId
  if (!deviceId) return null
  return {
    deviceId,
    displayName: raw.display_name ?? raw.displayName,
    lastSeenTs: raw.last_seen_ts ?? raw.lastSeenTs,
    lastSeenIp: raw.last_seen_ip ?? raw.lastSeenIp,
    isVerified: false
  }
}

/**
 * 登录设备列表：会话、验证状态与设备写操作的唯一入口。
 *
 * 行集合以 `GET /devices` 为准（含本机与 last_seen，是"账号有哪些登录会话"的权威来源），
 * 验证状态按设备读本地 crypto store。移动端加密设置页与登录设备页共用，
 * 避免两处各写一套"拉会话 + 逐设备查验证"的重复实现。
 */
export function useDeviceSessions() {
  const loading = ref(false)
  const devices = ref<DeviceSessionInfo[]>([])
  const currentDeviceId = ref('')
  const userId = ref('')

  const otherDevices = computed(() => devices.value.filter((device) => !isCurrentDevice(device.deviceId)))

  function isCurrentDevice(deviceId: string): boolean {
    return deviceId === currentDeviceId.value
  }

  async function resolveVerified(currentUserId: string, deviceId: string): Promise<boolean> {
    if (!currentUserId) return false
    try {
      return await matrixVerificationService.isDeviceVerified(currentUserId, deviceId)
    } catch {
      return false
    }
  }

  /**
   * 加载设备列表。
   *
   * @returns 是否加载成功；失败时清空列表并记录日志，提示文案由页面决定
   */
  async function loadDevices(): Promise<boolean> {
    loading.value = true
    try {
      const sessionContext = matrixEncryptionContextService.getCurrentSessionContext()
      userId.value = sessionContext.userId ?? ''
      currentDeviceId.value = matrixDeviceService.getCurrentDeviceId() ?? ''

      const rawDevices = (await matrixDeviceService.getDevices()) as Array<Device & DeviceSessionRecord>
      const rows = rawDevices.map(normalizeDevice).filter((row): row is DeviceSessionInfo => row !== null)

      await Promise.all(
        rows.map(async (row) => {
          row.isVerified = await resolveVerified(userId.value, row.deviceId)
        })
      )

      devices.value = rows
      return true
    } catch (err) {
      logger.error('Failed to load device sessions:', err)
      devices.value = []
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteDevice(deviceId: string): Promise<void> {
    await matrixDeviceService.deleteDevice(deviceId)
    await loadDevices()
  }

  async function deleteDevices(deviceIds: string[]): Promise<void> {
    if (!deviceIds.length) return
    await matrixDeviceService.deleteDevices(deviceIds)
    await loadDevices()
  }

  async function renameDevice(deviceId: string, displayName: string): Promise<void> {
    await matrixDeviceService.updateDevice(deviceId, displayName)
    await loadDevices()
  }

  /** 对指定设备发起 SAS 验证，返回事务 ID。 */
  async function startVerification(deviceId: string): Promise<string> {
    if (!userId.value) {
      throw new Error('No active session user for device verification')
    }
    return matrixVerificationService.startSasVerification(userId.value, deviceId)
  }

  return {
    loading,
    devices,
    currentDeviceId,
    userId,
    otherDevices,
    isCurrentDevice,
    loadDevices,
    deleteDevice,
    deleteDevices,
    renameDevice,
    startVerification
  }
}
