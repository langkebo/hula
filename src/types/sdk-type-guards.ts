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
 * ## 守卫方式
 *
 * 用**条件类型 + 赋值**把这个前提钉住，而不是在真实调用上挂抑制指令：
 * - 现在：`'room_types'` 不是 `ICreateRoomOpts` 的键 ⇒ `SdkAcceptsRoomTypes` 为 `false`
 *   ⇒ 下面这行赋 `true` 通过编译；
 * - 将来：SDK 认了该字段 ⇒ 该别名变 `true` ⇒ 赋值类型不匹配 ⇒
 *   `pnpm typecheck` 直接红（`TS2322`），强制升级者确认「后端是否也支持了」。
 *
 * 为什么不用抑制指令（TS 的 expect-error 注释）：它只在**真有错误**时才算「用掉」，
 * 而且会占掉 `check:ratchet` 的 `ts_expect_error` 配额（基线一旦抬高就降不下来）；
 * 条件类型写法的失败信息也更好读（`boolean` 不能赋给 `never`）。
 *
 * 删除本文件前请先确认：`POST /createRoom` 是否已接受 `room_types`。
 */
import type { ICreateRoomOpts } from '@/services/matrix/sdk'

/** SDK 是否已放开 `room_types` —— 期望恒为 `false` */
type SdkAcceptsRoomTypes = 'room_types' extends keyof ICreateRoomOpts ? true : false

/** SDK 一旦放开该字段，这行赋值会让 `pnpm typecheck` 变红 */
export const mustStayRejectedByTypeSystem: SdkAcceptsRoomTypes extends false ? true : never = true
