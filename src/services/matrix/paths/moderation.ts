/**
 * Moderation 路径组（L3 路径常量）
 *
 * P-034: 文档化 synapse-rust `moderation` 模块的 report 路由。
 * 仅保留被 L2 服务（ReportService）实际引用的路径常量（FT-120）。
 *
 * 已移除的死常量（FT-120）：
 *   - REPORT_EVENT  — ReportService.reportEvent 走 SDK 的 client.reportEvent()，不拼接 URL
 *   - REPORT_USER   — ReportService.reportUser 遍历事件调用 reportEvent，不走 user-report 端点
 *   - SCANNER_INFO   — ReportService.getScannerInfo 使用 MATRIX_PATHS.ROOM.REPORT_SCANNER_INFO
 *
 * 后端路由（synapse-rust/src/web/routes/moderation.rs）：
 *   v3（含 MSC4260 room report）
 *     PUT  /_matrix/client/v3/rooms/{room_id}/report/{event_id}/score
 *     POST /_matrix/client/v3/rooms/{room_id}/report
 */
const PREFIX_V3 = '/_matrix/client/v3'

export const MODERATION = {
  /** 更新举报事件的评分（v1/v3 两版本兼容）。 */
  REPORT_EVENT_SCORE: (version: 'v1' | 'v3', roomId: string, eventId: string) => {
    const prefix = version === 'v1' ? '/_matrix/client/v1' : PREFIX_V3
    return `${prefix}/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/score`
  },
  /** MSC4260：举报整个房间（v3 only）。 */
  REPORT_ROOM: (roomId: string) => `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/report`
} as const
