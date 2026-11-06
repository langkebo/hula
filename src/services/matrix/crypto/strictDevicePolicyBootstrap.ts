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
 */

import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'
import { applyGlobalStrict, applyRoomStrict, readGlobalStrict } from './strictDevicePolicy'

const logger = createLogger('StrictDevicePolicyBootstrap')

interface StrictnessReplayResult {
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
  const settingStore = useSettingStore()
  settingStore.ensurePreferenceSettings()

  const desired = settingStore.blockUnverifiedDevicesEnabled
  const current = readGlobalStrict()
  // current === null（crypto 未就绪）时 applyGlobalStrict 会返回 false，同样安全。
  const globalApplied = current === desired ? true : applyGlobalStrict(desired)

  let applied = 0
  let skipped = 0
  for (const roomId of settingStore.strictUnverifiedRooms) {
    if (applyRoomStrict(roomId, true)) applied++
    else skipped++
  }

  logger.info(
    `严格模式重放：全局=${desired}（${globalApplied ? '已应用' : '暂不可应用'}）；房间覆盖 ${applied} 应用 / ${skipped} 跳过`
  )
  return { globalApplied, globalDesired: desired, rooms: { applied, skipped } }
}
