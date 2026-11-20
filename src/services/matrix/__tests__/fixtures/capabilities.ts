/**
 * 服务端 capabilities 测试夹具。
 *
 * 结构真值来自 SDK `Capabilities`（`GET /_matrix/client/v3/capabilities` 的内层映射），
 * 经 `@/services/matrix/sdk` 边界导入，不手抄。
 *
 * 注意：`available` 的值是 SDK 的字符串枚举 `RoomVersionStability`，
 * 裸写 `'stable'` 不能赋给该类型 —— 夹具里必须用枚举成员。
 */

import type { Capabilities } from '@/services/matrix/sdk'
import { RoomVersionStability } from '@/services/matrix/sdk'

/** 空能力表：服务端未声明任何能力（含 `m.room_versions` 缺失的分支） */
export const emptyCapabilitiesFixture: Capabilities = {}

/**
 * 按版本列表构造能力表，`available` 一律标为 stable。
 * 版本号按字符串写入，排序由消费方决定（`useRoomUpgradeFlow` 自己做数值排序）。
 */
export function makeCapabilities(versions: string[], defaultVersion: string): Capabilities {
  const available: Record<string, RoomVersionStability> = {}
  for (const version of versions) {
    available[version] = RoomVersionStability.Stable
  }
  return { 'm.room_versions': { default: defaultVersion, available } }
}

/** 非标准键 `room_versions`（无 `m.` 前缀），用于验证消费方的兼容分支 */
export const legacyRoomVersionsCapabilitiesFixture: Capabilities = {
  room_versions: {
    default: '11',
    available: { '11': RoomVersionStability.Stable }
  }
}
