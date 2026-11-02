/**
 * 设备验证状态读取。
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
 * 历史缺陷：调用方曾读 `content.verified`，而该字段在响应中恒不存在
 * ⇒ `verified` **恒为 false** ⇒ 「已验证（绿锁）」不可达。
 *
 * 权威来源与 `CryptoDeviceAdapter` 一致：`CryptoApi.getDeviceVerificationStatus`。
 * 查询失败按「未验证」处理并记录日志，**不**把失败伪装成「确实已验证」。
 */
import { createLogger } from '@/utils/Logger'
import { cryptoSDKAdapter } from '../crypto/CryptoSDKAdapter'

const logger = createLogger('MatrixDeviceService')

/**
 * 读取指定用户在**本地 crypto store** 中的逐设备验证状态。
 *
 * @param userId 目标用户 MXID
 * @param devices `/keys/query` 返回的原始设备内容
 * @returns `deviceId → 是否已验证`（无法判定/查询失败时为 `false`）
 */
export const loadDeviceVerification = async (
  userId: string,
  devices: Array<Record<string, unknown>>
): Promise<Map<string, boolean>> => {
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
