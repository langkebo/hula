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
import type { AdminManager } from 'matrix-js-sdk/admin'
import type { adminService } from '@/services/matrix/admin'
import type { AdminUserStatsOverview, UserInfo } from '@/services/matrix/admin/AdminTypes'
import type { AdminAccountDetails } from '@/services/matrix/sdk'

/** `getUsers` 分页返回（`nextToken` / `failed` 由服务层定义，不手抄） */
type UserListPage = Awaited<ReturnType<typeof adminService.getUsers>>
/** `getUserStatsList` 返回 */
type UserStatsListPage = Awaited<ReturnType<typeof adminService.getUserStatsList>>
/** `loginUserAs` 返回的模拟会话令牌 */
type ImpersonationTokens = NonNullable<Awaited<ReturnType<typeof adminService.loginUserAs>>>
/** `batchCreateUsers` 单条结果 */
type BatchCreateUserResult = Awaited<ReturnType<typeof adminService.batchCreateUsers>>[number]

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

/** 用户列表条目（前端 `UserInfo` 模型） */
export function makeUserInfo(userId: string, overrides: Partial<UserInfo> = {}): UserInfo {
  return { userId, ...overrides }
}

/** `getUsers` / `loadMoreUsers` 的分页返回 */
export function makeUserListPage(users: UserInfo[], extra: Omit<UserListPage, 'users'> = {}): UserListPage {
  return { users, ...extra }
}

/** `getUserStatsList` 的返回 */
export function makeUserStatsListPage(stats: AdminUserStatsOverview[], nextToken?: string): UserStatsListPage {
  return nextToken === undefined ? { stats } : { stats, nextToken }
}

/** `loginUserAs` 的模拟会话令牌 */
export function makeImpersonationTokens(accessToken = 'access-token', deviceId = 'DEVICE'): ImpersonationTokens {
  return { accessToken, deviceId }
}

/** `batchCreateUsers` 单条结果 */
export function makeBatchCreateUserResult(userId: string, success: boolean): BatchCreateUserResult {
  return { userId, success }
}

/** `getUsersPaginated` 的线格式（`items` + `nextToken`） */
type UsersPageWire = Awaited<ReturnType<AdminManager['getUsersPaginated']>>
/** `getUserRooms` 的线格式（`joined_rooms` 元素是 room id 字符串） */
type UserRoomsWire = NonNullable<Awaited<ReturnType<AdminManager['getUserRooms']>>>
/** `batchCreateUsers` 的线格式（`created` / `failed` 都是 string[]） */
type BatchCreateUsersWire = Awaited<ReturnType<AdminManager['batchCreateUsers']>>
/** `getRateLimitOverride` 的线格式 */
type RateLimitWire = NonNullable<Awaited<ReturnType<AdminManager['getRateLimitOverride']>>>
/** `loginAsUser` 的线格式（`user_id` 必填） */
type LoginAsUserWire = Awaited<ReturnType<AdminManager['loginAsUser']>>

/** 生成 `AdminAccountDetails`（`getUsersPaginated` / `createUser` 的返回条目） */
export function makeAdminAccountDetails(
  name: string,
  overrides: Partial<AdminAccountDetails> = {}
): AdminAccountDetails {
  return { name, ...overrides }
}

/** 生成 `getUsersPaginated` 分页返回 */
export function makeUsersPage(items: AdminAccountDetails[], nextToken?: string): UsersPageWire {
  return nextToken === undefined ? { items } : { items, nextToken }
}

/** 生成 `getUserRooms` 返回：后端只给 room id 字符串与 total */
export function makeUserRoomsResponse(joinedRooms: string[]): UserRoomsWire {
  return { joined_rooms: joinedRooms, total: joinedRooms.length }
}

/** 生成 `batchCreateUsers` 返回；`total` 由两个数组长度推导 */
export function makeBatchCreateUsersResponse(created: string[], failed: string[]): BatchCreateUsersWire {
  return { created, failed, total: created.length + failed.length }
}

/** 生成 `RateLimitConfig` 线格式 */
export function makeRateLimitConfig(messagesPerSecond: number, burstCount: number): RateLimitWire {
  return { messages_per_second: messagesPerSecond, burst_count: burstCount }
}

/** 生成 `AdminLoginAsUserResponse`（`user_id` 是必填字段，旧 mock 漏了它） */
export function makeAdminLoginAsUserResponse(
  accessToken = 'access-token',
  deviceId = 'DEVICE',
  userId = '@alice:server.com'
): LoginAsUserWire {
  return { access_token: accessToken, device_id: deviceId, user_id: userId }
}
