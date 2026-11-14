/**
 * SDK 类型守卫：`createRoom` 不接受 `room_types`。
 *
 * ## 为什么需要这个文件
 *
 * synapse-rust 的 `POST /createRoom` 是**严格 schema**：带 `room_types` 会直接
 * `400 M_BAD_JSON`（2026-11-14 实测）。建 space 必须走
 * `creation_content: { type: "m.space" }`。
 *
 * 当前 SDK 的 `ICreateRoomOpts` 里**没有** `room_types`，所以类型层天然拦住——
 * 但这只是「恰好如此」，不是被守护的约定：一旦某次 SDK 升级把它加进
 * `ICreateRoomOpts`（MSC 草稿或上游同步都可能带进来），类型就不再报错，
 * 而运行时会在建房时炸 400，且**升级的人不会收到任何提示**。
 *
 * 下面这行 `@ts-expect-error` 就是把这个前提钉住：
 * - 现在：SDK 类型不认该字段 ⇒ 错误存在 ⇒ 指令被「用掉」 ⇒ 编译通过；
 * - 将来：SDK 类型认了该字段 ⇒ 不再有错误 ⇒ 指令变成 TS2578（未使用）⇒
 *   `pnpm typecheck` 直接红，强制升级者确认「后端是否也支持了」，
 *   而不是等到线上建房失败。
 *
 * 删除本文件前请先确认：`POST /createRoom` 是否已接受 `room_types`。
 */
import type { MatrixClient } from '@/services/matrix/sdk'

declare const client: MatrixClient

// @ts-expect-error room_types 不在 ICreateRoomOpts 中；后端严格 schema 会 400 M_BAD_JSON
export const mustStayRejectedByTypeSystem = client.createRoom({ name: 'type-guard', room_types: ['m.space'] })
