import { computed, ref } from 'vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
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
  /** SDK `isVerified()`：交叉签名已验证**或**本机手动标记（仅用于展示） */
  isVerified: boolean
  /** 交叉签名已验证：身份层面的强证据，展示「已验证」必须用它 */
  crossSigningVerified: boolean
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
    isVerified: false,
    crossSigningVerified: false
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

  /**
   * 读本地 crypto store 的设备验证状态。
   *
   * 必须同时取 `crossSigningVerified`：`isVerified()` 会把「本机手动标记」也算作已验证，
   * 直接拿它渲染「已验证」会让一个从未做过身份验证的设备被显示成可信。
   */
  async function resolveFlags(
    currentUserId: string,
    deviceId: string
  ): Promise<{ isVerified: boolean; crossSigningVerified: boolean }> {
    if (!currentUserId) return { isVerified: false, crossSigningVerified: false }
    try {
      const status = await matrixCryptoService.getDeviceVerificationStatus(currentUserId, deviceId)
      return { isVerified: status.verified, crossSigningVerified: status.crossSigningVerified }
    } catch {
      return { isVerified: false, crossSigningVerified: false }
    }
  }

  /**
   * 加载设备列表。
   *
   * @param options.silent 静默刷新：不驱动整页 loading，失败也不清空现有列表。
   *   用于 keep-alive 重新激活时的后台刷新，避免每次切 Tab 回来闪骨架、或一次抖动把列表清空。
   * @returns 是否加载成功；失败时清空列表（非静默）并记录日志，提示文案由页面决定
   */
  async function loadDevices(options: { silent?: boolean } = {}): Promise<boolean> {
    const silent = options.silent === true
    if (!silent) {
      loading.value = true
    }
    try {
      const sessionContext = matrixEncryptionContextService.getCurrentSessionContext()
      userId.value = sessionContext.userId ?? ''
      currentDeviceId.value = matrixDeviceService.getCurrentDeviceId() ?? ''

      const rawDevices = (await matrixDeviceService.getDevices()) as Array<Device & DeviceSessionRecord>
      const rows = rawDevices.map(normalizeDevice).filter((row): row is DeviceSessionInfo => row !== null)

      await Promise.all(
        rows.map(async (row) => {
          const flags = await resolveFlags(userId.value, row.deviceId)
          row.isVerified = flags.isVerified
          row.crossSigningVerified = flags.crossSigningVerified
        })
      )

      devices.value = rows
      return true
    } catch (err) {
      logger.error('Failed to load device sessions:', err)
      if (!silent) {
        devices.value = []
      }
      return false
    } finally {
      if (!silent) {
        loading.value = false
      }
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
