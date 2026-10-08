/**
 * CryptoDeviceAdapter — device trust and verification operations.
 *
 * Extracted from CryptoSDKAdapter to keep file sizes under the 400-line budget.
 * All methods delegate to the live CryptoApi / SDK managers via CryptoAdapterAccessors.
 */

import type { VerificationRequest } from '@/types/matrix-extensions'
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
      const verifiedByDeviceId = await this.loadVerificationByDeviceId(userId)
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
          isVerified: verifiedByDeviceId.get(deviceId) ?? false
        }
      })
    }

    // 历史缺陷：这里曾有一个 `client.getStoredDevicesForUser` 兜底——该方法在
    // vendored matrix-js-sdk 中不存在，兜底永远不可达，却让「设备列表为空」看起来正常。
    // 现在显式失败，避免把「能力缺失」伪装成「没有设备」。
    throw new Error('无法获取设备列表：DeviceKeysManager 不可用（keys/query 是查询他人设备的唯一端点）')
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
        const verifiedByDeviceId = await this.loadVerificationByDeviceId(userId)
        return {
          deviceId,
          userId,
          displayName:
            typeof keys.display_name === 'string'
              ? keys.display_name
              : typeof unsigned.device_display_name === 'string'
                ? unsigned.device_display_name
                : undefined,
          isVerified: verifiedByDeviceId.get(deviceId) ?? false
        }
      }
    }

    // 历史缺陷：此处曾用 `client.getStoredDevice` 兜底——该方法在 SDK 中不存在，
    // 兜底不可达，却让「查不到设备」与「能力缺失」难以区分。

    return null
  }

  /**
   * 逐设备查询本地验证状态。
   *
   * 权威来源是 `CryptoApi.getDeviceVerificationStatus`（本机 crypto store），
   * 不是后端 HTTP：`GET /device_trust` 已随后端模块一并删除，调用必然 404。
   * 查询失败时按「未验证」处理，并显式记录，避免把「查询失败」伪装成「确实未验证」。
   */
  private async loadVerificationByDeviceId(userId: string): Promise<Map<string, boolean>> {
    const crypto = this.accessors.getCrypto()
    const result = new Map<string, boolean>()
    if (!crypto) return result

    const sdkDeviceKeysManager = this.accessors.getSDKDeviceKeysManager()
    if (!sdkDeviceKeysManager) return result

    let deviceIds: string[]
    try {
      deviceIds = Object.keys((await sdkDeviceKeysManager.getUserDevices(userId)) ?? {})
    } catch (err) {
      logger.warn(`设备列表获取失败，按未验证处理: ${err}`)
      return result
    }

    await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
          result.set(deviceId, status?.isVerified() ?? false)
        } catch (err) {
          logger.warn(`设备 ${deviceId} 验证状态获取失败，按未验证处理: ${err}`)
          result.set(deviceId, false)
        }
      })
    )
    return result
  }

  /** 验证设备
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      throw new Error('无法标记设备已验证：CryptoApi 不可用')
    }
    await crypto.setDeviceVerified(userId, deviceId)
    logger.info(`设备验证成功(CryptoApi): ${userId}:${deviceId}`)
  }

  /** 取消验证设备
   */
  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      throw new Error('无法取消设备验证：CryptoApi 不可用')
    }
    await crypto.setDeviceVerified(userId, deviceId, false)
    logger.info(`取消设备验证: ${userId}:${deviceId}`)
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

    // 历史缺陷：这里曾用 `client.checkDeviceTrust` 兜底——该方法在 SDK 中不存在，
    // 兜底永远不可达，最终恒返回「全部 false」，使所有设备都被显示为未验证。
    // 明确报错，让上层区分「查询失败」与「确实未验证」。
    throw new Error('无法获取设备验证状态：CryptoApi 不可用')
  }

  /** 请求设备验证
   */
  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) return null
    return await crypto.requestDeviceVerification(userId, deviceId)
  }

  /**
   * 屏蔽设备。
   *
   * **当前客户端不支持该操作。** vendored matrix-js-sdk 没有设备屏蔽的写入 API
   * （`DeviceTrustManager` 只提供只读的 `isDeviceBlocked`，也不存在 `client.setDeviceBlocked`）。
   * 此前的实现会退化成 `setDeviceVerified(userId, deviceId, false)`，即把"屏蔽"
   * 悄悄变成"取消验证"——设备仍可参与加密通信，而 UI 却显示已屏蔽。
   * 在真正实现之前显式失败，让调用方与用户看到真实状态。
   *
   * @throws 始终抛出，表示当前客户端不支持设备屏蔽
   */
  async blockDevice(_userId: string, _deviceId: string): Promise<void> {
    throw new Error('当前客户端不支持屏蔽设备：SDK 未提供设备屏蔽接口')
  }

  /**
   * 取消屏蔽设备。
   *
   * 同 {@link blockDevice}：SDK 无对应 API，显式失败而不是谎称已取消屏蔽。
   *
   * @throws 始终抛出，表示当前客户端不支持该操作
   */
  async unblockDevice(_userId: string, _deviceId: string): Promise<void> {
    throw new Error('当前客户端不支持取消屏蔽设备：SDK 未提供设备屏蔽接口')
  }
}
