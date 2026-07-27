/**
 * Moderation 路径组（L3 路径常量）
 *
 * P-034: 文档化 synapse-rust `moderation` 模块的 report/scanner_info 路由。
 * 实际业务调用通过 SDK 的 `ModerationManager` 完成，前端不直接拼接 URL；
 * 本常量作为后端路由契约的登记出口，便于审计对齐。
 *
 * 后端路由（synapse-rust/src/web/routes/moderation.rs）：
 *   v1（含 MSC4284 scanner_info）
 *     POST /_matrix/client/v1/rooms/{room_id}/report/{event_id}
 *     PUT  /_matrix/client/v1/rooms/{room_id}/report/{event_id}/score
 *     GET  /_matrix/client/v1/rooms/{room_id}/report/{event_id}/scanner_info
 *   v3（含 MSC4260 user report / room report）
 *     POST /_matrix/client/v3/rooms/{room_id}/report/{event_id}
 *     PUT  /_matrix/client/v3/rooms/{room_id}/report/{event_id}/score
 *     POST /_matrix/client/v3/rooms/{room_id}/report
 *     POST /_matrix/client/v3/users/{user_id}/report
 *
 * r0 兼容路径已移除（前端不使用 r0 路由，后端 r0 路由仅用于旧客户端兼容）。
 */
const PREFIX_V1 = '/_matrix/client/v1'
const PREFIX_V3 = '/_matrix/client/v3'

export const MODERATION = {
  /** 举报指定房间中的事件（v1/v3 两版本兼容）。 */
  REPORT_EVENT: (version: 'v1' | 'v3', roomId: string, eventId: string) => {
    const prefix = version === 'v1' ? PREFIX_V1 : PREFIX_V3
    return `${prefix}/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}`
  },
  /** 更新举报事件的评分（v1/v3 两版本兼容）。 */
  REPORT_EVENT_SCORE: (version: 'v1' | 'v3', roomId: string, eventId: string) => {
    const prefix = version === 'v1' ? PREFIX_V1 : PREFIX_V3
    return `${prefix}/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/score`
  },
  /** MSC4284：获取举报事件的扫描器信息（v1 only）。 */
  SCANNER_INFO: (roomId: string, eventId: string) =>
    `${PREFIX_V1}/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/scanner_info`,
  /** MSC4260：举报整个房间（v3 only）。 */
  REPORT_ROOM: (roomId: string) => `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/report`,
  /** MSC4260：举报用户（v3 only）。 */
  REPORT_USER: (userId: string) => `${PREFIX_V3}/users/${encodeURIComponent(userId)}/report`
} as const
