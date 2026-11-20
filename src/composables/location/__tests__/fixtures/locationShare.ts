/**
 * location 域测试夹具（位置共享 composable）。
 *
 * 类型来自真实契约：
 * - 信标信息取自 `matrixBeaconService.createBeacon()` 的返回类型推导（服务未导出该接口）；
 * - `LocationData` 取自 `MatrixLocationService` 的导出。
 *
 * ⚠️ 修正的假结构：旧测试里 `{ event_id: '$beacon1' }` 只写了一个字段，
 * 而 `BeaconInfo` 契约要求 `room_id` / `user_id` / `is_live` / `last_updated` 必填——服务当前只读
 * `event_id`，所以测试一直绿，但 mock 描述的是不存在的响应；夹具统一补全。
 */
import type { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import type { LocationData } from '@/services/matrix/media/MatrixLocationService'

type BeaconInfo = Awaited<ReturnType<typeof matrixBeaconService.createBeacon>>

/** `matrixBeaconService.createBeacon()` 返回的实时位置信标（MSC3489） */
export function makeBeaconInfo(overrides: Partial<BeaconInfo> = {}): BeaconInfo {
  return {
    event_id: '$beacon:example.org',
    room_id: '!room:server',
    user_id: '@u:s',
    is_live: true,
    last_updated: 1,
    ...overrides
  }
}

/** 位置消息与 `currentLocation` 的载荷 */
export function makeLocationData(overrides: Partial<LocationData> = {}): LocationData {
  return {
    latitude: 0,
    longitude: 0,
    timestamp: 0,
    ...overrides
  }
}
