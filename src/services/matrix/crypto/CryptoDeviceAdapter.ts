/**
 * CryptoDeviceAdapter — device trust and verification operations.
 *
 * Extracted from CryptoSDKAdapter to keep file sizes under the 400-line budget.
 * All methods delegate to SDK managers via CryptoAdapterAccessors.
 */

import type { LegacyStoredDevice, TrustLevel, VerificationRequest } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import type { CryptoAdapterAccessors, DeviceInfo, DeviceVerificationResult } from './cryptoAdapterTypes'

const logger = createLogger('CryptoDeviceAdapter')

export class CryptoDeviceAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

  /** 获取用户设备列表
   *
   * 权威来源是 `POST /keys/query`（经 `DeviceKeysManager.getUserDevices` 封装）——
   * 它是唯一能查「他人」设备的端点。
   *
   * ⚠️ 不能用 `DeviceTrustManager.getDeviceTrustList()` 代替：`GET /device_trust`
   * 只返回 `{ device_id, trust_level, verified_at, verified_by }`，既没有
   * `user_id` 也没有 `display_name`，且仅覆盖「当前用户自己」的设备。此前
   * 按 `d.user_id === userId` 过滤该列表，导致好友设备列表恒为空。
   * 这里改为「keys/query 拿设备 + 信任列表按 device_id 打标」。
   */
  async getDevices(userId: string): Promise<DeviceInfo[]> {
    const sdkDeviceKeysManager = this.accessors.getSDKDeviceKeysManager()
    if (sdkDeviceKeysManager) {
      const deviceMap = (await sdkDeviceKeysManager.getUserDevices(userId)) ?? {}
      const trustByDeviceId = await this.loadTrustByDeviceId()
      return Object.entries(deviceMap).map(([deviceId, content]) => {
        const keys = (content ?? {}) as Record<string, unknown>
        const unsigned = (keys.unsigned ?? {}) as Record<string, unknown>
        return {
          deviceId,
          userId,
          displayName:
            typeof keys.display_name === 'string'
              ? keys.display_name
              : typeof unsigned.device_display_name === 'string'
                ? unsigned.device_display_name
                : undefined,
          isVerified: trustByDeviceId.get(deviceId) === 'verified'
        }
      })
    }

    const client = this.accessors.getExtendedClient()
    if (typeof client.getStoredDevicesForUser === 'function') {
      const devices = (await client.getStoredDevicesForUser(userId)) ?? []
      return devices.map((device: LegacyStoredDevice) => ({
        deviceId: device.deviceId,
        userId: device.userId,
        displayName: device.displayName,
        isVerified: device.isVerified()
      }))
    }

    return []
  }

  /** 获取指定设备信息
   */
  async getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null> {
    const sdkDeviceKeysManager = this.accessors.getSDKDeviceKeysManager()
    if (sdkDeviceKeysManager) {
      const deviceMap = (await sdkDeviceKeysManager.getUserDevices(userId)) ?? {}
      const keys = (deviceMap[deviceId] ?? null) as Record<string, unknown> | null
      if (keys) {
        const unsigned = (keys.unsigned ?? {}) as Record<string, unknown>
        const trustByDeviceId = await this.loadTrustByDeviceId()
        return {
          deviceId,
          userId,
          displayName:
            typeof keys.display_name === 'string'
              ? keys.display_name
              : typeof unsigned.device_display_name === 'string'
                ? unsigned.device_display_name
                : undefined,
          isVerified: trustByDeviceId.get(deviceId) === 'verified'
        }
      }
    }

    const trustManager = this.accessors.getDeviceTrustManager()
    if (trustManager) {
      const trustInfo = await trustManager.getDeviceTrust(deviceId)
      if (!trustInfo) return null
      // trust 记录里没有 user_id / display_name / last_seen_*，不要凭空取值。
      return {
        deviceId: trustInfo.device_id,
        userId,
        isVerified: trustInfo.trust_level === 'verified'
      }
    }

    const client = this.accessors.getExtendedClient()
    if (typeof client.getStoredDevice === 'function') {
      const device = client.getStoredDevice(userId, deviceId)
      if (!device) return null
      return {
        deviceId: device.deviceId,
        userId: device.userId,
        displayName: device.displayName,
        isVerified: device.isVerified()
      }
    }

    return null
  }

  /**
   * `GET /device_trust` 只覆盖当前用户自己的设备，且不含 user_id，
   * 因此只能按 device_id 建索引；信任等级取不到时按「未验证」处理。
   */
  private async loadTrustByDeviceId(): Promise<Map<string, TrustLevel>> {
    const trustManager = this.accessors.getDeviceTrustManager()
    if (!trustManager) return new Map()
    try {
      const trustList = await trustManager.getDeviceTrustList()
      return new Map(trustList.map((d) => [d.device_id, d.trust_level]))
    } catch (err) {
      logger.warn(`设备信任列表获取失败，按未验证处理: ${err}`)
      return new Map()
    }
  }

  /** 验证设备
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    const trustManager = this.accessors.getDeviceTrustManager()
    if (trustManager) {
      await trustManager.respondToVerification(
        (
          await trustManager.requestVerification({
            new_device_id: deviceId,
            device_id: this.accessors.getClient().getDeviceId() ?? '',
            method: 'sas'
          })
        ).token,
        true
      )
      logger.info(`设备验证成功(Manager): ${userId}:${deviceId}`)
      return
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId)
      logger.info(`设备验证成功(CryptoApi): ${userId}:${deviceId}`)
      return
    }

    const client = this.accessors.getExtendedClient()
    if (typeof client.setDeviceVerified === 'function') {
      await client.setDeviceVerified(userId, deviceId)
      logger.info(`设备验证成功(Legacy): ${userId}:${deviceId}`)
    }
  }

  /** 取消验证设备
   */
  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    const crypto = this.accessors.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId, false)
      logger.info(`取消设备验证: ${userId}:${deviceId}`)
      return
    }

    const client = this.accessors.getExtendedClient()
    if (typeof client.setDeviceVerified === 'function') {
      await client.setDeviceVerified(userId, deviceId, false)
      logger.info(`取消设备验证(Legacy): ${userId}:${deviceId}`)
    }
  }

  /** 获取设备验证状态
   */
  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationResult> {
    const crypto = this.accessors.getCrypto()
    if (crypto) {
      const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
      if (!status) {
        return { verified: false, crossSigningVerified: false, devicesCrossSigningVerified: false, tofu: false }
      }
      return {
        verified: status.isVerified(),
        crossSigningVerified: status.crossSigningVerified,
        devicesCrossSigningVerified: status.crossSigningVerified,
        tofu: status.tofu ?? false
      }
    }

    const client = this.accessors.getExtendedClient()
    if (typeof client.checkDeviceTrust === 'function') {
      const trust = await client.checkDeviceTrust(userId, deviceId)
      return {
        verified: trust.isVerified(),
        crossSigningVerified: trust.crossSigningVerified,
        devicesCrossSigningVerified: trust.crossSigningVerified,
        tofu: trust.tofu ?? false
      }
    }

    return { verified: false, crossSigningVerified: false, devicesCrossSigningVerified: false, tofu: false }
  }

  /** 请求设备验证
   */
  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    const trustManager = this.accessors.getDeviceTrustManager()
    if (trustManager) {
      await trustManager.requestVerification({
        new_device_id: deviceId,
        device_id: this.accessors.getClient().getDeviceId() ?? '',
        method: 'sas'
      })
      return null
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      return await crypto.requestDeviceVerification(userId, deviceId)
    }

    return null
  }

  /** 屏蔽设备
   */
  async blockDevice(userId: string, deviceId: string): Promise<void> {
    const client = this.accessors.getExtendedClient()
    if (typeof client.setDeviceBlocked === 'function') {
      await client.setDeviceBlocked(userId, deviceId, true)
      logger.info(`设备已屏蔽(Legacy): ${userId}:${deviceId}`)
      return
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId, false)
      logger.info(`设备已标记为未验证(CryptoApi, 等效屏蔽): ${userId}:${deviceId}`)
      return
    }

    logger.warn(`无法屏蔽设备：无可用的加密接口`)
  }

  /** 取消屏蔽设备
   */
  async unblockDevice(userId: string, deviceId: string): Promise<void> {
    const client = this.accessors.getExtendedClient()
    if (typeof client.setDeviceBlocked === 'function') {
      await client.setDeviceBlocked(userId, deviceId, false)
      logger.info(`设备已取消屏蔽(Legacy): ${userId}:${deviceId}`)
      return
    }

    const crypto = this.accessors.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId, false)
      logger.info(`设备已恢复为未验证状态(CryptoApi): ${userId}:${deviceId}`)
      return
    }

    logger.warn(`无法取消屏蔽设备：无可用的加密接口`)
  }
}
