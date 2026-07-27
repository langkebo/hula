/**
 * Direct Message (DM) 路径组（L3 路径常量）
 *
 * P-032: 用于文档化 synapse-rust `friend_room` 模块下的 DM 路由。
 * 实际业务调用走 `matrixClientService` → SDK 的 `m.direct` account_data，
 * 不需要拼接 URL，本常量仅作为路由契约登记，便于前端审计/契约测试对齐。
 *
 * 后端路由（synapse-rust/src/web/routes/friend_room.rs）：
 *   GET  /_matrix/client/v1/friends/dm/{user_id}
 *   POST /_matrix/client/v1/friends/dm/{user_id}
 *
 * 注意：FRIENDS.DM 已包含此路径，本组保留以与 SDK 的 DirectMessageManager
 * 对齐，作为路径契约独立模块的"文档化"出口。
 *
 * r0 兼容路径已移除（前端不使用 r0 路由，后端 r0 路由仅用于旧客户端兼容）。
 */
import { PREFIX_V1 } from './prefixes'

export const DM = {
  /** 获取/创建与指定用户的 DM 房间（v1）。 */
  GET_DM: (userId: string) => `${PREFIX_V1}/friends/dm/${encodeURIComponent(userId)}`,
  /** 显式发起 DM 创建请求（v1）。 */
  CREATE_DM: (userId: string) => `${PREFIX_V1}/friends/dm/${encodeURIComponent(userId)}`
} as const
