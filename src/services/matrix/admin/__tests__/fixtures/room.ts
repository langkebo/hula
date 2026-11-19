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
import type { AdminRoomTokenSync, AdminRoomTokenSyncEntry } from '@/services/matrix/admin/AdminTypes'

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
