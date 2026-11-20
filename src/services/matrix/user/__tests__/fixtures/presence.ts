import type { PresenceManager } from 'matrix-js-sdk'
import type { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'

/**
 * 在线状态（presence）域测试夹具。
 *
 * 类型取自 SDK 的 `PresenceManager['getPresence']` 返回契约（`IPresenceState`，可能为 null）：
 * - `presence` 是受限联合 `'online' | 'offline' | 'unavailable' | 'away' | 'busy'`；
 * - `status_msg` 可选且为 string —— 旧测试写 `status_msg: null` 属契约外取值，
 *   服务层对「无状态消息」的语义是透传 undefined（SDK 收到 undefined 会省略该字段）。
 */

/** `getPresence` 成功时的响应体（剔除 null）。 */
export type PresenceStateFixture = NonNullable<Awaited<ReturnType<PresenceManager['getPresence']>>>

/** 生成在线状态响应，默认一个带活跃时间的在线用户。 */
export function makePresenceState(overrides: Partial<PresenceStateFixture> = {}): PresenceStateFixture {
  return {
    presence: 'online',
    last_active_ago: 1000,
    currently_active: true,
    ...overrides
  }
}

/** `matrixPresenceService.getCurrentPresence()` 的响应（服务层在 SDK 状态上补齐 `user_id`）。 */
export type PresenceInfoFixture = Awaited<ReturnType<typeof matrixPresenceService.getCurrentPresence>>

/** 生成当前用户的在线状态，默认在线且无状态消息。 */
export function makePresenceInfo(overrides: Partial<PresenceInfoFixture> = {}): PresenceInfoFixture {
  return {
    user_id: '@alice:matrix.test',
    presence: 'online',
    status_msg: undefined,
    ...overrides
  }
}

/** 服务层订阅响应的返回类型（`{ presences }`，SDK 侧声明为 void，实际后端有响应体）。 */
export type PresenceListFixture = Awaited<ReturnType<typeof matrixPresenceService.subscribeToPresence>>

/** 生成订阅响应，默认为空列表。 */
export function makePresenceList(presences: PresenceListFixture['presences'] = []): PresenceListFixture {
  return { presences }
}
