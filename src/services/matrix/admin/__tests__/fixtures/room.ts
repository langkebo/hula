/**
 * admin 房间域测试夹具。
 *
 * ## 为什么要有这个文件
 *
 * 测试里 `mockResolvedValueOnce({ ... })` 直接手写对象时，**没有东西保证它长得像后端**。
 * 实测样本：`getRoomTokenSync` 的夹具曾写成 `{ enabled: true, token: 't' }` —— 后端
 * 根本不返回这两个键，测试却一直是绿的（测的是不存在的响应）。
 *
 * 这里改成：**夹具带类型标注**。`const x: AdminRoomTokenSync = {...}` 时，TS 会检查
 *   - 缺字段 → 报错（漏了后端会返回的键）
 *   - 多字段 → 报错（对象字面量 excess property check，写了后端没有的键）
 * 于是「夹具造假」从「靠人记得」变成「编译期拦下」。
 *
 * ## 真值来源
 *
 * 结构以 `src/services/matrix/admin/AdminTypes.ts` 为准，该文件逐字对照
 * SDK `admin/sub-managers/admin-room-types.d.ts`（其由后端 ledger codegen 产生）。
 * 值可以是构造的（测试不需要真实数据），但**键集、类型、可空性必须与后端一致**。
 *
 * ## 新增夹具的规矩
 *
 * 1. 必须带类型标注，不写 `as any` / `as unknown as`（`check:ratchet` 也禁）；
 * 2. 一个后端响应一个导出，命名 `<域><动作>Fixture`；
 * 3. 若该响应结构后端未定型（如开放的 `checks`），在本文件里用显式别名
 *    `type DynamicXxx = Record<string, unknown>` 并注明「后端未定型」，不要退回裸 Record。
 */

import { MatrixEvent } from 'matrix-js-sdk'
import type {
  AdminPurgeHistoryResult,
  RoomInfo as AdminRoomInfoWire,
  AdminShutdownRoomResult,
  CascadeRedactResponse,
  PaginatedResponse
} from 'matrix-js-sdk/admin'
import type {
  AdminRoomEventContextInfo,
  AdminRoomEventItem,
  AdminRoomForwardExtremitiesInfo,
  AdminRoomListingsInfo,
  AdminRoomTokenSync,
  AdminRoomTokenSyncEntry,
  RoomInfo,
  RoomState,
  ShutdownRoomResult
} from '@/services/matrix/admin/AdminTypes'
import type {
  AdminEventContextEvent,
  AdminRoomForwardExtremities,
  Room,
  RoomStatsOverview
} from '@/services/matrix/sdk'

/** `GET /_synapse/admin/v1/rooms/{room_id}/token_sync` —— 单条 token 记录 */
export const adminRoomTokenSyncEntryFixture: AdminRoomTokenSyncEntry = {
  user_id: '@u:server.test',
  device_id: 'DEVICE1',
  conn_id: null,
  list_key: null,
  pos: 1,
  token_created_ts: 1795000000000,
  token_expires_at: null,
  room_timestamp: 0,
  room_updated_ts: 1795000000000,
  bump_stamp: 0,
  highlight_count: 0,
  notification_count: 0,
  is_dm: false,
  is_encrypted: false,
  is_tombstoned: false,
  invited: false,
  name: null,
  avatar: null,
  is_expired: false
}

/** `GET /_synapse/admin/v1/rooms/{room_id}/token_sync` —— 完整响应（1 条、无分页） */
export const adminRoomTokenSyncFixture: AdminRoomTokenSync = {
  room_id: '!room:server.test',
  results: [adminRoomTokenSyncEntryFixture],
  total: 1,
  next_batch: null,
  summary: {
    active_token_count: 1,
    expired_token_count: 0,
    distinct_users: 1,
    distinct_devices: 1
  }
}

/** 分页场景：`next_batch` 非空、loaded < total（UI 要据此提示「还有更多」） */
export const adminRoomTokenSyncPagedFixture: AdminRoomTokenSync = {
  room_id: '!room:server.test',
  results: [
    adminRoomTokenSyncEntryFixture,
    { ...adminRoomTokenSyncEntryFixture, device_id: 'DEVICE2', is_expired: true }
  ],
  total: 25,
  next_batch: 'batch_2',
  summary: {
    active_token_count: 1,
    expired_token_count: 1,
    distinct_users: 1,
    distinct_devices: 2
  }
}

// ── 房间治理（useAdminRooms 消费的服务层返回）────────────────────────────────

/** 单个房间（`AdminRoomService.getRooms()` 的 `RoomInfo`） */
export function makeRoomInfo(overrides: Partial<RoomInfo> = {}): RoomInfo {
  return {
    roomId: '!room:server.test',
    name: 'Room',
    joinedMembers: 2,
    joinedLocalMembers: 1,
    invitedMembers: 0,
    invitedLocalMembers: 0,
    ...overrides
  }
}

/**
 * `getRooms()` 的一页。
 *
 * `failed` 表示服务层吞掉异常后的降级结果，与「这页确实是空的」语义不同，
 * 测试必须能分别构造。
 */
export function makeRoomsPage(
  rooms: RoomInfo[],
  options: { nextToken?: string; failed?: boolean } = {}
): { rooms: RoomInfo[]; nextToken?: string | undefined; failed?: boolean } {
  return {
    rooms,
    ...(options.nextToken !== undefined ? { nextToken: options.nextToken } : {}),
    ...(options.failed !== undefined ? { failed: options.failed } : {})
  }
}

/** `getRoomState()`：后端无状态事件时服务层给的就是 `{ state: [] }` */
export function makeRoomState(state: RoomState['state'] = []): RoomState {
  return { state }
}

/** `shutdownRoom()`：服务层已把 `kicked_users` / `failed_to_kick_users` 归一为 camelCase */
export function makeShutdownRoomResult(
  kickedUsers: string[] = [],
  failedToKickUsers: string[] = []
): ShutdownRoomResult {
  return { kickedUsers, failedToKickUsers }
}

/**
 * `GET /_synapse/admin/v1/room_stats`（SDK `RoomStatsOverview`）。
 *
 * ⚠️ 旧测试写的是 `{ rooms: 5 } as never` —— 后端从不返回 `rooms` 键，
 * 七个真实字段一个都没覆盖。
 */
export function makeRoomStatsOverview(overrides: Partial<RoomStatsOverview> = {}): RoomStatsOverview {
  return {
    total_rooms: 10,
    encrypted_rooms: 2,
    public_rooms: 1,
    total_messages: 500,
    total_members: 20,
    active_rooms: 3,
    average_messages_per_room: 50,
    ...overrides
  }
}

/**
 * `GET /_synapse/admin/v1/rooms/{room_id}/listings`（SDK `AdminRoomListings`）。
 *
 * ⚠️ 旧测试写的是 `{ room_id: '!x:s' }` —— 缺 `public` / `in_directory`，
 * 于是「不在目录里」这条分支根本没被测到。
 */
export function makeRoomListings(overrides: Partial<AdminRoomListingsInfo> = {}): AdminRoomListingsInfo {
  return { room_id: '!room:server.test', public: true, in_directory: true, ...overrides }
}

/** 事件上下文 / 房间内搜索的单条事件（SDK `AdminEventContextEvent`） */
export function makeRoomEventItem(overrides: Partial<AdminRoomEventItem> = {}): AdminRoomEventItem {
  return {
    event_id: '$event:server.test',
    type: 'm.room.message',
    content: { msgtype: 'm.text', body: 'hello' },
    sender: '@u:server.test',
    origin_server_ts: 1795000000000,
    ...overrides
  }
}

/**
 * 事件上下文里的 `event` / `events_before` 单条。
 *
 * 不能用 `makeRoomEventItem`（那是 Partial）：`AdminEventContextEvent` 要求 `event_id` 必填。
 */
export function makeContextEvent(overrides: Partial<AdminEventContextEvent> = {}): AdminEventContextEvent {
  return {
    event_id: '$event:server.test',
    type: 'm.room.message',
    content: { msgtype: 'm.text', body: 'hello' },
    sender: '@u:server.test',
    origin_server_ts: 1795000000000,
    ...overrides
  }
}

/**
 * `GET /_synapse/admin/v1/rooms/{room_id}/event_context/{event_id}`（SDK `AdminEventContext`）。
 *
 * 后端返回 `{event, events_before, events_after, state}`，`state` 恒为 `[]`；
 * 旧的 `{ events_before: [] }` 缺 `event`，且 `events` / `start` / `end` 早已不存在。
 */
export function makeRoomEventContext(overrides: Partial<AdminRoomEventContextInfo> = {}): AdminRoomEventContextInfo {
  return { event: makeContextEvent(), events_before: [], events_after: [], state: [], ...overrides }
}

/** `POST /_synapse/admin/v1/rooms/search` 的结果页 */
export function makeRoomSearchResults(
  results: AdminRoomEventItem[],
  nextBatch?: string
): { results: AdminRoomEventItem[]; nextBatch?: string | undefined } {
  return { results, ...(nextBatch !== undefined ? { nextBatch } : {}) }
}

/**
 * `GET /_synapse/admin/v1/rooms/{room_id}/forward_extremities`（SDK `AdminRoomForwardExtremities`）。
 *
 * 后端返回的是**极点数（整数）**，服务层归一为 `{roomId, forwardExtremities}`；
 * 服务层读取失败时返回 `null`，与「0 个极点」语义不同，测试必须能分别构造。
 */
export function makeForwardExtremitiesInfo(
  overrides: Partial<AdminRoomForwardExtremitiesInfo> = {}
): AdminRoomForwardExtremitiesInfo {
  return { roomId: '!room:server.test', forwardExtremities: 1, ...overrides }
}

/** SDK 原始响应（snake_case），仅供服务层归一化映射的测试；归一后的形状见上一个夹具 */
export function makeRoomForwardExtremitiesRaw(
  overrides: Partial<AdminRoomForwardExtremities> = {}
): AdminRoomForwardExtremities {
  return { room_id: '!room:server.test', forward_extremities: 1, ...overrides }
}

// ── RoomService.test.ts 的 SDK 原始响应（wire，snake_case）──────────────────

/**
 * `GET /_synapse/admin/v1/rooms` 的单条（SDK `RoomInfo`，列表端点只返回 6 个键）。
 *
 * ⚠️ 旧夹具写的是 `public` / `created_ts` / `invited_members` —— 后端与 SDK 都不返回
 * 这三个键（真实键是 `is_public`），测试却据此断言 `public: true`，把「服务层读错键」
 * 锁成了正确行为。
 */
export function makeAdminRoomWire(overrides: Partial<AdminRoomInfoWire> = {}): AdminRoomInfoWire {
  return {
    room_id: '!room:server.test',
    name: 'Room',
    topic: 'Topic',
    creator: '@alice:server.test',
    joined_members: 5,
    joined_local_members: 3,
    is_public: true,
    ...overrides
  }
}

/** `AdminRoomService.getRooms()` 拿到的 SDK 分页壳（`nextToken` 是 SDK 归一化后的游标） */
export function makeRoomsPaginatedWire(
  rooms: AdminRoomInfoWire[],
  nextToken?: string
): PaginatedResponse<AdminRoomInfoWire> {
  return { items: rooms, ...(nextToken !== undefined ? { nextToken } : {}) }
}

/** `POST /_synapse/admin/v1/shutdown_room/{room_id}` 的 SDK 原始响应（`closed_room` 必填） */
export function makeShutdownRoomRaw(overrides: Partial<AdminShutdownRoomResult> = {}): AdminShutdownRoomResult {
  return {
    closed_room: true,
    kicked_users: ['@u1:server.test'],
    failed_to_kick_users: [],
    ...overrides
  }
}

/** `POST /_synapse/admin/v1/rooms/{room_id}/purge_history` 的 SDK 原始响应（无 `purge_id`） */
export function makePurgeHistoryRaw(overrides: Partial<AdminPurgeHistoryResult> = {}): AdminPurgeHistoryResult {
  return { success: true, deleted_events: 9, dry_run: false, ...overrides }
}

/** `POST /_synapse/admin/v1/rooms/{room_id}/cascade_redact` 的 SDK 原始响应 */
export function makeCascadeRedactRaw(overrides: Partial<CascadeRedactResponse> = {}): CascadeRedactResponse {
  return { event_id: '$event:server.test', redacted_count: 3, max_depth: 5, ...overrides }
}

/**
 * `MatrixClient.getRoom()` 的最小可用桩，只覆盖服务层实际读取的 `timeline`。
 *
 * 用真实 `MatrixEvent` 实例（`getId()` 返回 `event_id`），而不是手写
 * `{ getId: () => '$x' }` —— 后者不是 SDK 的 `MatrixEvent`，类型上不成立。
 */
export function makeRoomWithTimeline(eventIds: string[] = ['$event:server.test']): Pick<Room, 'timeline'> {
  return {
    timeline: eventIds.map((eventId) => new MatrixEvent({ event_id: eventId, type: 'm.room.message' }))
  }
}
