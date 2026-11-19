/**
 * admin 用户域测试夹具。
 *
 * 类型来自 SDK 的 `AdminAccountDetails`（经 `@/services/matrix/sdk` 边界导入，
 * 不手抄 —— 手抄是 `S-01`/`P2-3` 那类「无单一真源」的根源）。
 *
 * ⚠️ 时间戳字段：后端**两个键名并存**，按 handler 不同——
 * `get_account_details` / `get_users_v2` / `get_single_user_stats` 返回 `creation_ts`，
 * 另外几处返回 `created_ts`。夹具用 `creation_ts`（用户主查询走的那个），
 * 并用 `createdTs` 断言它能被正确映射（此前只读 `created_ts` ⇒ 恒 undefined）。
 */
import type { AdminAccountDetails } from '@/services/matrix/sdk'

/** 用户详情：完整字段（后端 `GET /account/{user_id}` 的形态） */
export const adminAccountDetailsFixture: AdminAccountDetails = {
  user_id: '@bob:server.test',
  name: '@bob:server.test',
  displayname: 'Bob Test',
  avatar_url: 'mxc://server.test/bob-avatar',
  admin: false,
  deactivated: false,
  creation_ts: 1795000000000,
  is_guest: false
}

/** 列表条目：后端只给最小集 */
export const adminAccountDetailsMinimalFixture: AdminAccountDetails = {
  name: '@guest:server.test',
  is_guest: true
}
