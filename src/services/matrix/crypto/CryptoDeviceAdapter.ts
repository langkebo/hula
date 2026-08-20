/**
 * CryptoDeviceAdapter — device trust and verification operations.
 *
 * Extracted from CryptoSDKAdapter to keep file sizes under the 400-line budget.
 * All methods delegate to SDK managers via CryptoAdapterAccessors.
 */

import type { LegacyStoredDevice, VerificationRequest } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import type { CryptoAdapterAccessors, DeviceInfo, DeviceVerificationResult } from './cryptoAdapterTypes'

const logger = createLogger('CryptoDeviceAdapter')

export class CryptoDeviceAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

  /** 获取用户设备列表
   */
  async getDevices(userId: string): Promise<DeviceInfo[]> {
    const trustManager = this.accessors.getDeviceTrustManager()
    if (trustManager) {
      const trustList = await trustManager.getDeviceTrustList()
      return trustList
        .filter((d) => (d.user_id ?? '') === userId)
        .map((d) => ({
          deviceId: d.device_id,
          userId: d.user_id ?? userId,
          displayName: d.display_name,
          lastSeenTs: d.last_seen_ts,
          lastSeenIp: d.last_seen_ip,
          isVerified: d.trust_level === 'verified'
        }))
    }

    const client = this.accessors.getExtendedClient()
    if (typeof client.getStoredDevicesForUser === 'function') {
      const devices = await client.getStoredDevicesForUser(userId)
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
    const trustManager = this.accessors.getDeviceTrustManager()
    if (trustManager) {
      const trustInfo = await trustManager.getDeviceTrust(deviceId)
      if (!trustInfo) return null
      return {
        deviceId: trustInfo.device_id,
        userId: trustInfo.user_id ?? userId,
        displayName: trustInfo.display_name,
        lastSeenTs: trustInfo.last_seen_ts,
        lastSeenIp: trustInfo.last_seen_ip,
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
