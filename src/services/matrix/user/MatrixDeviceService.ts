/**
 * Matrix 设备管理服务
 *
 * 提供设备列表、设备详情、设备更新、设备删除等功能
 * 参考 API 契约: device.md
 */

import type { IDeviceUpdateRequest } from 'matrix-js-sdk'
import type { AuthDict, DeviceManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { BaseMatrixService } from '../BaseMatrixService'
import { cryptoSDKAdapter } from '../crypto/CryptoSDKAdapter'

const logger = createLogger('MatrixDeviceService')

/**
 * 设备信息接口
 */
export interface Device {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  last_seen_user_agent?: string
  verified?: boolean
}

/**
 * 设备更新响应
 */
interface DeviceUpdateResponse {
  device_id: string
  display_name: string
  updated_ts: number
}

/**
 * 设备列表变更响应
 */
interface DeviceListUpdatesResponse {
  changed: Array<{ user_id: string; device_id: string; device_data: unknown }>
  left: string[]
  deleted?: string[]
  stream_id?: number
}

/**
 * 设备列表变更请求
 */
interface DeviceListUpdatesRequest {
  users: string[]
  since?: string | number
  from?: string | number
  to?: string | number
}

/**
 * 设备管理服务
 */
class MatrixDeviceService extends BaseMatrixService {
  /**
   * 获取 DeviceManager（不存在时抛出）。
   *
   * 注：本地 `MatrixClientExtended` 与 SDK 的 `getKeyBackupManager` 签名不兼容，
   * 无法直接 `as` 降级，故在此保留唯一的 unknown 桥接；调用方统一走本方法。
   */
  private requireDeviceManager(): DeviceManager {
    const deviceManager = (this.getClient() as unknown as MatrixClientExtended).getDeviceManager?.()
    if (!deviceManager) {
      throw new Error('DeviceManager 不可用')
    }
    return deviceManager
  }

  /**
   * 获取当前用户的所有设备
   *
   * @returns 设备列表
   */
  async getDevices(): Promise<Device[]> {
    try {
      const deviceManager = this.requireDeviceManager()

      const devices = await deviceManager.getDevices()
      logger.info(`[DeviceService] 获取设备列表成功: ${devices.length} 个设备`)
      return devices
    } catch (err) {
      logger.error(`[DeviceService] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取指定用户的所有设备（用于好友详情页设备列表展示）
   *
   * 契约：`DeviceKeysManager.getUserDevices(userId)`
   *   → `MatrixClient.getUserDevices` → `POST /_matrix/client/v3/keys/query`
   *   → 返回 `{ device_keys: { [userId]: { [deviceId]: DeviceKeys } } }`，
   *   SDK 已解包为 `{ [deviceId]: DeviceKeys }`。
   *
   * ⚠️ 不能用 `GET /devices` 收口：该端点没有 `{user_id}` 路径段
   * （`synapse-web/src/routes/device.rs` 用 `auth_user.user_id`），只能查自己，
   * 且响应是 `{ devices: [...] }` 数组。用它做第三方查询会让好友设备列表恒为空。
   *
   * @param userId 目标用户 MXID
   * @returns 设备列表（失败时返回空数组，不抛出异常）
   */
  async getUserDevices(userId: string): Promise<Device[]> {
    try {
      // ⚠️ 必须走 `this.getClient()`（BaseMatrixService 的 provider 取 client）。
      // 上一版收口写成 `this.client.getDeviceKeysManager()`，而本类没有 `client`
      // 字段 → 运行期 TypeError 被 catch 吞掉，好友设备列表恒为空。
      const deviceMap = (await this.getClient().getDeviceKeysManager().getUserDevices(userId)) ?? {}
      const rawDevices = Object.values(deviceMap) as Array<Record<string, unknown>>
      // 逐设备查**本地 crypto store** 的验证状态（见 loadDeviceVerification 的说明）。
      const verification = await this.loadDeviceVerification(userId, rawDevices)
      const devices: Device[] = rawDevices
        .map((content) => {
          // keys/query 返回的是设备密钥，display_name 通常位于 unsigned.device_display_name
          const unsigned = (content.unsigned ?? {}) as Record<string, unknown>
          const displayName =
            typeof content.display_name === 'string'
              ? content.display_name
              : typeof unsigned.device_display_name === 'string'
                ? unsigned.device_display_name
                : undefined
          const deviceId = String(content.device_id ?? '')
          return {
            device_id: deviceId,
            display_name: displayName,
            last_seen_ts: typeof content.last_seen_ts === 'number' ? content.last_seen_ts : undefined,
            last_seen_ip: typeof content.last_seen_ip === 'string' ? content.last_seen_ip : undefined,
            last_seen_user_agent:
              typeof content.last_seen_user_agent === 'string' ? content.last_seen_user_agent : undefined,
            verified: verification.get(deviceId) ?? false
          }
        })
        .filter((device) => device.device_id)
      logger.info(`[DeviceService] 获取用户设备列表成功: userId=${userId}, ${devices.length} 个设备`)
      return devices
    } catch (err) {
      logger.error(`[DeviceService] 获取用户设备列表失败: userId=${userId}, ${err}`)
      return []
    }
  }

  /**
   * 读取指定用户在**本地 crypto store** 中的逐设备验证状态。
   *
   * ## 为什么不能读 `/keys/query` 响应里的 `verified`
   *
   * `/keys/query` 返回的是 *device_keys*（`user_id` / `device_id` / `algorithms` /
   * `keys` / `signatures` / `unsigned`）—— 其中**没有任何信任标记**。
   * 「设备是否已验证」是**纯本地**状态：由客户端依据 cross-signing 信任链
   * （master → self_signing → device）或本地显式验证在 crypto store 里推导。
   * 服务端的 `GET /device_trust` 曾承载这一信息，但它随后端模块一起被删除，
   * 调用必然 404（见 `E2EE_SPEC_COMPLIANCE.md` 对 T-2/T-5 的说明）。
   *
   * 历史缺陷：本方法曾写 `verified: typeof content.verified === 'boolean' ? content.verified : false`，
   * 而该字段在响应中恒不存在 ⇒ `verified` **恒为 false** ⇒ 依赖它推导信任等级的上层
   * （`useMessageTrust`）永远得到「未验证」⇒ 「已验证（绿锁）」不可达。
   *
   * 权威来源与 {@link CryptoDeviceAdapter} 一致：`CryptoApi.getDeviceVerificationStatus`。
   * 查询失败按「未验证」处理并记录日志，**不**把失败伪装成「确实已验证」。
   *
   * @param userId 目标用户 MXID
   * @param devices `/keys/query` 返回的原始设备内容
   * @returns `deviceId → 是否已验证`（无法判定/查询失败时为 `false`）
   */
  private async loadDeviceVerification(
    userId: string,
    devices: Array<Record<string, unknown>>
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>()
    // ⚠️ 取 crypto 本身必须防御：客户端未初始化 / crypto 未启用时这里会抛错，
    // 而"验证状态查不到"绝不能连带把**设备列表**也变成空数组
    // （那会让"无设备"与"查询失败"再也分不开）。
    let crypto: ReturnType<typeof cryptoSDKAdapter.getCrypto>
    try {
      crypto = cryptoSDKAdapter.getCrypto()
    } catch (err) {
      logger.warn(`[DeviceService] crypto 不可用，设备验证状态按未验证处理: ${err}`)
      return result
    }
    if (!crypto) return result

    await Promise.all(
      devices.map(async (device) => {
        const deviceId = String(device.device_id ?? '')
        if (!deviceId) return
        try {
          const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
          result.set(deviceId, status?.isVerified() ?? false)
        } catch (err) {
          logger.warn(`[DeviceService] 设备 ${deviceId} 验证状态获取失败，按未验证处理: ${err}`)
          result.set(deviceId, false)
        }
      })
    )
    return result
  }

  /**
   * 获取单个设备详情
   *
   * @param deviceId 设备 ID
   * @returns 设备详情
   */
  async getDevice(deviceId: string): Promise<Device> {
    try {
      const deviceManager = this.requireDeviceManager()

      const device = await deviceManager.getDevice(deviceId)
      logger.info(`[DeviceService] 获取设备详情成功: ${deviceId}`)
      return device
    } catch (err) {
      logger.error(`[DeviceService] 获取设备详情失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 更新设备显示名称
   *
   * @param deviceId 设备 ID
   * @param displayName 新的显示名称
   * @returns 更新结果
   */
  async updateDevice(deviceId: string, displayName: string): Promise<DeviceUpdateResponse> {
    try {
      // SDK-9: 设备名称长度 ≤100 字符前端校验
      if (displayName && displayName.length > 100) {
        throw new Error(`设备名称不能超过 100 个字符（当前: ${displayName.length}）`)
      }

      const deviceManager = this.requireDeviceManager()

      // SDK-9: 适配 IDeviceUpdateRequest 对象签名
      const updates: IDeviceUpdateRequest = { display_name: displayName }
      await deviceManager.updateDevice(deviceId, updates)
      logger.info(`[DeviceService] 更新设备成功: ${deviceId}`)
      return {
        device_id: deviceId,
        display_name: displayName,
        updated_ts: Date.now()
      }
    } catch (err) {
      logger.error(`[DeviceService] 更新设备失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 删除单个设备
   *
   * @param deviceId 设备 ID
   * @param auth 可选的认证信息（用于 UIA）
   */
  async deleteDevice(deviceId: string, auth?: AuthDict): Promise<void> {
    try {
      const deviceManager = this.requireDeviceManager()

      // DeviceManager 会自动保护当前设备
      await deviceManager.deleteDevice(deviceId, auth)
      logger.info(`[DeviceService] 删除设备成功: ${deviceId}`)
    } catch (err) {
      logger.error(`[DeviceService] 删除设备失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 批量删除设备
   *
   * @param deviceIds 设备 ID 列表
   * @param auth 可选的认证信息（用于 UIA）
   */
  async deleteDevices(deviceIds: string[], auth?: AuthDict): Promise<void> {
    try {
      const deviceManager = this.requireDeviceManager()

      // SDK 真实签名只接受一个参数，且仅对象形式会读取 auth。
      // 传第二个位置参数会被静默丢弃，导致 UIA 重试永远失败。
      await deviceManager.deleteDevices(auth ? { devices: deviceIds, auth } : { devices: deviceIds })
      logger.info(`[DeviceService] 批量删除设备成功: ${deviceIds.length} 个设备`)
    } catch (err) {
      logger.error(`[DeviceService] 批量删除设备失败: ${err}`)
      throw err
    }
  }

  /**
   * 查询多用户设备列表变更
   *
   * @param request 查询请求
   * @returns 设备变更信息
   */
  async getDeviceListUpdates(request: DeviceListUpdatesRequest): Promise<DeviceListUpdatesResponse> {
    try {
      const client = this.getClient()
      const deviceManager = client.getDeviceManager()
      const updates = await deviceManager.getDeviceListUpdates(request.users)
      logger.info(`[DeviceService] 获取设备变更成功: ${request.users.length} 个用户`)
      return updates as DeviceListUpdatesResponse
    } catch (err) {
      logger.error(`[DeviceService] 获取设备变更失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取当前设备 ID
   *
   * @returns 当前设备 ID
   */
  getCurrentDeviceId(): string | null {
    try {
      const client = this.getClient()
      return client.getDeviceId() || null
    } catch (err) {
      logger.error(`[DeviceService] 获取当前设备 ID 失败: ${err}`)
      return null
    }
  }

  /**
   * 检查是否为当前设备
   *
   * @param deviceId 设备 ID
   * @returns 是否为当前设备
   */
  isCurrentDevice(deviceId: string): boolean {
    const currentDeviceId = this.getCurrentDeviceId()
    return currentDeviceId === deviceId
  }

  async getRoomKeyRequests(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      // 注意：SDK 的 listRoomKeyRequests() 类型声明为 RoomKeyRequestResponse[]，但运行时实际返回
      // 的是 GET /room_keys/request 的原始响应体 { requests: [...] }（Matrix 规范的包裹结构）。
      // 必须按真实结构解包，否则会把包裹对象当成数组返回，违反本函数声明的 Array 契约。
      const response = await client.getE2EEManager().listRoomKeyRequests()
      const requests = unknownToObject<{ requests?: Array<Record<string, unknown>> }>(response)?.requests
      logger.info('[DeviceService] 获取密钥请求列表成功')
      return requests ?? []
    } catch (err) {
      logger.error(`[DeviceService] 获取密钥请求列表失败: ${err}`)
      return []
    }
  }

  async deleteRoomKeyRequest(requestId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.getE2EEManager().deleteRoomKeyRequest(requestId)
      logger.info(`[DeviceService] 删除密钥请求成功: ${requestId}`)
      return true
    } catch (err) {
      logger.error(`[DeviceService] 删除密钥请求失败: ${err}`)
      return false
    }
  }
}

/**
 * 单例实例
 */
export const matrixDeviceService = new MatrixDeviceService()
