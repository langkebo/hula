/**
 * CryptoDeviceAdapter — device trust and verification operations.
 *
 * Extracted from CryptoSDKAdapter to keep file sizes under the 400-line budget.
 * All methods delegate to the live CryptoApi / SDK managers via CryptoAdapterAccessors.
 */

import type { IContent } from '@/services/matrix/sdk'
import type { CryptoApi, VerificationRequest } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import type {
  CryptoAdapterAccessors,
  DeviceInfo,
  DeviceVerificationFlags,
  DeviceVerificationResult
} from './cryptoAdapterTypes'

const logger = createLogger('CryptoDeviceAdapter')

/**
 * 批量读取设备验证状态——**唯一实现**（`CryptoDeviceAdapter` 与 `MatrixDeviceService` 共用）。
 *
 * 逐设备调用 `CryptoApi.getDeviceVerificationStatus`（本机 crypto store）。
 * 单台设备查询失败不影响其他设备：该台按「未验证」处理，并在批次结束时**只输出一条
 * 汇总 warn**。历史实现逐设备打一条 WARN，同一时刻 62 台设备失败就刷出 62 条
 * `null pointer passed to rust`，把真实错误淹没。
 *
 * @param crypto 提供验证状态查询的 CryptoApi（或其最小投影）
 * @param userId 目标用户 MXID
 * @param deviceIds 要查询的设备 ID 列表
 * @param label 发起查询的链路名（填入日志，便于区分调用来源）
 * @returns `deviceId → { verified, crossSigningVerified }`（查询失败两项均为 `false`）
 */
export async function loadDeviceVerificationByDeviceIds(
  crypto: Pick<CryptoApi, 'getDeviceVerificationStatus'>,
  userId: string,
  deviceIds: readonly string[],
  label: string
): Promise<Map<string, DeviceVerificationFlags>> {
  const result = new Map<string, DeviceVerificationFlags>()
  let failed = 0
  let firstError: unknown

  await Promise.all(
    deviceIds.map(async (deviceId) => {
      if (!deviceId) return
      try {
        const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
        result.set(deviceId, {
          verified: status?.isVerified() ?? false,
          crossSigningVerified: status?.crossSigningVerified ?? false
        })
      } catch (err) {
        failed += 1
        firstError ??= err
        result.set(deviceId, { verified: false, crossSigningVerified: false })
      }
    })
  )

  if (failed > 0) {
    logger.warn(
      `设备验证状态查询失败 ${failed}/${deviceIds.length} 台，按未验证处理（userId=${userId}，来源=${label}）；首个错误: ${firstError}`
    )
  }
  return result
}

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
      const verifiedByDeviceId = await this.loadVerificationByDeviceId(userId, Object.keys(deviceMap))
      return Object.entries(deviceMap).map(([deviceId, content]) => {
        const keys: IContent = content ?? {}
        const unsigned = unknownToObject(keys.unsigned) ?? {}
        return {
          deviceId,
          userId,
          displayName:
            typeof keys.display_name === 'string'
              ? keys.display_name
              : typeof unsigned.device_display_name === 'string'
                ? unsigned.device_display_name
                : undefined,
          isVerified: verifiedByDeviceId.get(deviceId)?.verified ?? false,
          crossSigningVerified: verifiedByDeviceId.get(deviceId)?.crossSigningVerified ?? false
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
      const keys: IContent | null = deviceMap[deviceId] ?? null
      if (keys) {
        const unsigned = unknownToObject(keys.unsigned) ?? {}
        const verifiedByDeviceId = await this.loadVerificationByDeviceId(userId, [deviceId])
        return {
          deviceId,
          userId,
          displayName:
            typeof keys.display_name === 'string'
              ? keys.display_name
              : typeof unsigned.device_display_name === 'string'
                ? unsigned.device_display_name
                : undefined,
          isVerified: verifiedByDeviceId.get(deviceId)?.verified ?? false,
          crossSigningVerified: verifiedByDeviceId.get(deviceId)?.crossSigningVerified ?? false
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
   * 实际批量查询与失败汇总见 {@link loadDeviceVerificationByDeviceIds}。
   */
  private async loadVerificationByDeviceId(
    userId: string,
    deviceIds: readonly string[]
  ): Promise<Map<string, DeviceVerificationFlags>> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) return new Map()
    return loadDeviceVerificationByDeviceIds(crypto, userId, deviceIds, 'CryptoDeviceAdapter')
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
        return { verified: false, crossSigningVerified: false, tofu: false }
      }
      return {
        verified: status.isVerified(),
        crossSigningVerified: status.crossSigningVerified,
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
   * 列出某房间内**尚未验证**的设备（权威实现，唯一事实源）。
   *
   * 用途：加密房间的「存在未验证设备」警示。E2EE 规范 v1.18
   * `#recommended-client-behaviour` 要求客户端 **SHOULD NOT** 向非交叉签名设备
   * 发送加密 to-device（room key / secret）；要遵守它，客户端至少必须**知道**
   * 房间里有哪些未验证设备。
   *
   * ⚠️ **空数组只能表示"确实没有未验证设备"**，不能表示"查不到"。
   * 历史缺陷：`useEncryption.getUnverifiedDevicesInRoom` 是一个恒返回 `[]` 的桩，
   * 于是任何依赖它的警示**永远不出现**（静默放行）。因此本方法在无法判定时**抛出**，
   * 由调用方决定如何呈现，而不是返回空数组装作一切正常。
   *
   * 单个成员的设备列表拉取失败不阻断整体（记录日志后跳过），
   * 因为"某个成员查不到设备"与"整个房间查不到"是不同程度的失败。
   *
   * ## 判定用 `crossSigningVerified`，不用 `isVerified`
   *
   * `isVerified()` = 交叉签名已验证 **或** 本机手动标记。本机标记没有任何密码学凭据
   * （`setDeviceVerified` 只是往本地 crypto store 写一个布尔），把它当作放行依据等于
   * 把 TOFU 当验证。安全决策只认交叉签名信任链。
   *
   * @param roomId 房间 ID
   * @returns 未通过交叉签名验证的设备列表（可能为空，但空一定意味着"都已通过"）
   * @throws 房间不在本地 store
   */
  async getUnverifiedDevicesInRoom(roomId: string): Promise<DeviceInfo[]> {
    const room = this.accessors.getClient().getRoom(roomId)
    if (!room) {
      throw new Error('无法列出房间内未验证设备：房间不在本地 store，不能当作「没有未验证设备」')
    }

    const result: DeviceInfo[] = []
    for (const member of room.getJoinedMembers()) {
      const userId = member.userId
      let devices: DeviceInfo[]
      try {
        devices = await this.getDevices(userId)
      } catch (err) {
        logger.warn(`房间 ${roomId} 内 ${userId} 的设备列表拉取失败，跳过该成员: ${err}`)
        continue
      }
      for (const device of devices) {
        if (device.crossSigningVerified === true) continue
        result.push(device)
      }
    }
    return result
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
