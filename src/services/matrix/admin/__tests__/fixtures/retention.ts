/**
 * admin 保留策略（retention）域测试夹具。
 *
 * 响应形状来自两处真实契约：
 * - `AdminManager`（`matrix-js-sdk/admin`）的 `RetentionPolicy` / `RoomRetentionPolicy`：
 *   `{max_lifetime: number|null, min_lifetime: number|null, is_expire_on_clients: boolean}`
 *   三键必填（`admin-config-types.d.ts:110-117`）；
 * - `MatrixClient` 的 `sendStateEvent()` 返回 `ISendEventResponse`（`{event_id}`），
 *   原先 mock 的 `{}` 不是真实响应。
 *
 * `m.room.retention` 状态事件 content 与 `getServerRetention()` 的返回是宽泛类型
 * （`IContent` / `unknown`），这里按 Matrix spec / `RetentionManager` 的语义类型声明。
 */
import type { MatrixClient } from 'matrix-js-sdk'
import type { RetentionPolicy, RoomRetentionPolicy } from 'matrix-js-sdk/admin'

/** `GET /_synapse/admin/v1/retention/policy` 的响应（服务器保留策略） */
export function makeRetentionPolicy(overrides: Partial<RetentionPolicy> = {}): RetentionPolicy {
  return { max_lifetime: null, min_lifetime: null, is_expire_on_clients: false, ...overrides }
}

/** 房间级保留策略（`setRoomRetentionPolicy()` 的响应，比服务器策略多 `room_id`） */
export function makeRoomRetentionPolicy(overrides: Partial<RoomRetentionPolicy> = {}): RoomRetentionPolicy {
  return {
    room_id: '!r:hs',
    max_lifetime: null,
    min_lifetime: null,
    is_expire_on_clients: false,
    ...overrides
  }
}

/** `client.sendStateEvent()` 的响应（`Promise<ISendEventResponse>`，由方法签名推导） */
export type SendStateEventResponse = Awaited<ReturnType<MatrixClient['sendStateEvent']>>

export function makeSendStateEventResponse(overrides: Partial<SendStateEventResponse> = {}): SendStateEventResponse {
  return { event_id: '$state-evt:hs', ...overrides }
}

/**
 * `m.room.retention` 状态事件 content（Matrix spec：两个生命周期键均可选）。
 * `client.getStateEvent()` 的返回类型是宽泛的 `IContent`，真实键集由该状态事件定义。
 */
export interface RoomRetentionStateContent {
  max_lifetime?: number
  min_lifetime?: number
}

export function makeRoomRetentionStateContent(overrides: RoomRetentionStateContent = {}): RoomRetentionStateContent {
  return { ...overrides }
}

/**
 * `client.getServerRetention()` 的 SDK 声明是 `Promise<unknown>`（`client.d.ts:3760`），
 * 实际委托 `RetentionManager.getServerRetentionPolicy(): Promise<RetentionPolicy>`
 * （`lib/retention/index.d.ts:18`，4 键均可选）。该子路径不在 package exports 中，
 * 故按同形在此声明并注明来源。
 */
export interface ServerRetentionPolicy {
  max_lifetime?: number
  min_lifetime?: number
  expire_on_clients?: boolean
  is_expire_on_clients?: boolean
}

export function makeServerRetentionPolicy(overrides: ServerRetentionPolicy = {}): ServerRetentionPolicy {
  return { ...overrides }
}
