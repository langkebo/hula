/**
 * 严格模式偏好的**启动重放**（R-1）。
 *
 * 为什么需要单独一层：
 * - `CryptoApi.globalBlacklistUnverifiedDevices` 是**普通属性**，随 client 重建归零；
 * - `Room.setBlacklistUnverifiedDevices()` **只写内存**，不落盘。
 *
 * 两处都不持久化，所以用户此前的决定必须每次 crypto 初始化完成后从设置存储里重放。
 * 放在 service 层（而非 composable）是为了让 crypto 初始化链路可以调用它，
 * 且保持 `strictDevicePolicy.ts` 本身无 pinia 依赖、可独立单测。
 *
 * 偏好来源通过 `registerStrictDevicePolicyPreferences()` 注入（应用入口在 pinia
 * 激活后注册），避免 service → store 的静态反向依赖（S7）。未注入时按默认值
 * 「全局关闭、无房间覆盖」处理，行为等同于全新安装。
 */

import { createLogger } from '@/utils/Logger'
import { applyGlobalStrict, applyRoomStrict, readGlobalStrict } from './strictDevicePolicy'

const logger = createLogger('StrictDevicePolicyBootstrap')

export interface StrictDevicePolicyPreferences {
  /** 确保偏好设置已从存储加载（幂等） */
  ensureLoaded: () => void
  /** 全局「阻止未验证设备」开关 */
  isBlockUnverifiedDevicesEnabled: () => boolean
  /** 已登记的单房间严格模式覆盖（roomId 列表） */
  listRoomOverrides: () => readonly string[]
}

let preferences: StrictDevicePolicyPreferences | null = null

/** 注入严格模式偏好的读取器（应用入口在 pinia 激活后调用一次）。 */
export function registerStrictDevicePolicyPreferences(provider: StrictDevicePolicyPreferences): void {
  preferences = provider
}

export interface StrictnessReplayResult {
  /** 全局开关是否已处于期望值（含"本来就一致、无需改写"） */
  globalApplied: boolean
  globalDesired: boolean
  rooms: { applied: number; skipped: number }
}

/**
 * 把持久化的严格模式偏好施加到 SDK。
 *
 * 幂等：全局值已等于期望值时**不写**（避免把 SDK 的默认 `false` 误记为用户的决定）；
 * 单房间覆盖按登记列表重放，房间尚未加载的计入 `skipped`（下次进入该房间时
 * `useRoomStrictness` 会再次施加）。
 */
export function reapplyPersistedStrictness(): StrictnessReplayResult {
  const globalDesired = preferences?.isBlockUnverifiedDevicesEnabled() ?? false
  const roomOverrides = preferences?.listRoomOverrides() ?? []

  if (!preferences) {
    logger.debug('严格模式偏好未注入，按默认值（关闭）处理')
  } else {
    preferences.ensureLoaded()
  }

  const current = readGlobalStrict()
  // current === null（crypto 未就绪）时 applyGlobalStrict 会返回 false，同样安全。
  const globalApplied = current === globalDesired ? true : applyGlobalStrict(globalDesired)

  let applied = 0
  let skipped = 0
  for (const roomId of roomOverrides) {
    if (applyRoomStrict(roomId, true)) applied++
    else skipped++
  }

  logger.info(
    `严格模式重放：全局=${globalDesired}（${globalApplied ? '已应用' : '暂不可应用'}）；房间覆盖 ${applied} 应用 / ${skipped} 跳过`
  )
  return { globalApplied, globalDesired, rooms: { applied, skipped } }
}
