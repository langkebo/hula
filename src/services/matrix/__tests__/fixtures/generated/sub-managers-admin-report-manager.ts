// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-report-manager` 的 `EventReport` */
export const EventReportFixture = {
  id: 0,
  room_id: 'x',
  event_id: 'x',
  user_id: 'x',
  reported_user_id: 'x',
  reason: 'x',
  content: 'x',
  status: 'x',
  score: 0,
  received_ts: 0
} satisfies T.EventReport

/** `sub-managers/admin-report-manager` 的 `ReportsListResponse` */
export const ReportsListResponseFixture = {
  reports: [],
  total: 0
} satisfies T.ReportsListResponse

/** `sub-managers/admin-report-manager` 的 `ReportPaginationOptions` */
export const ReportPaginationOptionsFixture = {} satisfies T.ReportPaginationOptions
