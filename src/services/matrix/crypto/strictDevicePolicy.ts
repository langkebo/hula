/**
 * 「未验证设备密钥策略」的唯一事实源（R-1）。
 *
 * ## 背景与产品决策（2026-10-12）
 *
 * 客户端**不**默认开启 `globalBlacklistUnverifiedDevices`。那是 Element 的互操作默认：
 * 一旦默认开启，未验证设备（含新设备、未完成交叉签名的设备）会**完全收不到消息**，
 * 且用户没有任何解释。因此策略改为：
 *
 * 1. 保持默认（向未验证设备发送），不破坏互操作；
 * 2. 在加密房间用**权威查询**给出「本房间有 N 台未验证设备」的提示；
 * 3. 由用户**显式**决定是否启用严格模式（全局开关 + 单房间覆盖）。
 *
 * ## SDK 事实（本 fork 实测，勿按上游记忆写）
 *
 * - **没有** `setGlobalBlacklistUnverifiedDevices()` 方法（全仓 0 命中）。
 *   开关是 `CryptoApi.globalBlacklistUnverifiedDevices` 的**可写属性**，
 *   在 `rust-crypto.js` 中初始化为 `false`，并在每次
 *   `encryptEvent(event, globalBlacklistUnverifiedDevices, deviceIsolationMode)`
 *   与 `prepareForEncryption(...)` 时读取 —— 即**改属性即时生效**，无需重建 client。
 * - `Room.setBlacklistUnverifiedDevices(value)` **只写内存字段、不持久化**；
 *   `Room.getBlacklistUnverifiedDevices()` 未设置时返回 `null`。
 *   `RoomEncryptor` 的判定是
 *   `room.getBlacklistUnverifiedDevices() ?? globalBlacklistUnverifiedDevices`
 *   ⇒ 传 `null` 即「跟随全局」。单房间覆盖的持久化必须由调用方负责。
 * - 严格模式**只影响此后共享的房间密钥**：已经共享出去的密钥无法收回，
 *   所以关闭严格模式时不会补发历史消息（UI 文案须如实说明）。
 */

import { createLogger } from '@/utils/Logger'
import { cryptoSDKAdapter } from './CryptoSDKAdapter'

const logger = createLogger('StrictDevicePolicy')

/**
 * 写入全局严格模式开关。
 *
 * @param value `true` = 不向未验证设备发送房间密钥
 * @returns 是否真的写入了（crypto 未就绪时返回 `false`，调用方须区分"已应用"与"暂不可应用"）
 */
export function applyGlobalStrict(value: boolean): boolean {
  const crypto = cryptoSDKAdapter.getCrypto()
  if (!crypto) {
    logger.warn('crypto 未就绪，全局严格模式暂不可应用（待 crypto 初始化后重放）')
    return false
  }
  crypto.globalBlacklistUnverifiedDevices = value
  logger.info(`全局严格模式已设为 ${value}`)
  return true
}

/**
 * 读取全局严格模式开关。
 *
 * @returns `null` 表示 crypto 未就绪（**不等于 false**）
 */
export function readGlobalStrict(): boolean | null {
  const crypto = cryptoSDKAdapter.getCrypto()
  if (!crypto) return null
  return crypto.globalBlacklistUnverifiedDevices === true
}

/**
 * 写入单房间严格模式覆盖。
 *
 * @param strict `true` = 本房间不向未验证设备发送；`null` = 恢复"跟随全局"
 * @returns 是否真的写入了（房间不在本地 store 时返回 `false`）
 */
export function applyRoomStrict(roomId: string, strict: boolean | null): boolean {
  const client = cryptoSDKAdapter.getClient()
  const room = client?.getRoom(roomId)
  if (!room) {
    logger.warn(`房间不在本地 store，无法应用严格模式覆盖: ${roomId}`)
    return false
  }
  // JSDoc 明确「null to use the global value for this room」，但 d.ts 只声明 boolean，
  // 故这里必须显式断言：传 null 才能在运行时表达"跟随全局"。
  room.setBlacklistUnverifiedDevices((strict ?? null) as boolean)
  logger.info(`房间严格模式覆盖 ${roomId} → ${strict === null ? '跟随全局' : strict}`)
  return true
}

/**
 * 读取单房间严格模式覆盖。
 *
 * @returns `true`/`false` = 已设置的覆盖；`null` = 未设置（跟随全局）或房间不存在
 */
export function readRoomStrict(roomId: string): boolean | null {
  const client = cryptoSDKAdapter.getClient()
  const room = client?.getRoom(roomId)
  if (!room) return null
  return room.getBlacklistUnverifiedDevices()
}

/**
 * 重放一批持久化的单房间覆盖。
 *
 * 用途：`Room.setBlacklistUnverifiedDevices` 不持久化，因此每次冷启动/换账号后
 * 必须把用户此前的决定重新施加到房间上。
 *
 * @returns 成功施加的房间数（缺房间的会被跳过并计数在 `skipped`）
 */
export function reapplyRoomStrict(roomIds: readonly string[]): { applied: number; skipped: number } {
  let applied = 0
  let skipped = 0
  for (const roomId of roomIds) {
    if (applyRoomStrict(roomId, true)) applied++
    else skipped++
  }
  return { applied, skipped }
}
