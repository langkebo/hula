/**
 * admin 用户通知域测试夹具。
 *
 * 类型来自 SDK `AdminManager['getUserPushers']` 的真实签名：
 * `{ pushers: UserPusher[]; total: number }`，`UserPusher` 必填 `pushkey` 与 `app_id`。
 * 旧测试 mock `{ pushers: [{ pushkey: 'pk1' }] }` 既漏了 `total`，条目也漏了 `app_id`。
 */
import type { AdminManager, UserPusher } from '@/services/matrix/sdk'

/** `getUserPushers()` 的响应 */
type UserPushersResponse = Awaited<ReturnType<AdminManager['getUserPushers']>>

/** 生成单条 pusher（必填 `pushkey` / `app_id`）。 */
export function makeUserPusher(overrides: Partial<UserPusher> = {}): UserPusher {
  return { pushkey: 'pk1', app_id: 'im.tjg.app', ...overrides }
}

/** 生成 `getUserPushers()` 响应，`total` 由 pushers 长度推导。 */
export function makeUserPushersResponse(
  pushers: UserPusher[] = [],
  overrides: Partial<UserPushersResponse> = {}
): UserPushersResponse {
  return { pushers, total: pushers.length, ...overrides }
}
