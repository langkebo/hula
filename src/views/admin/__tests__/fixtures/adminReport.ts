/**
 * 事件举报管理页签测试夹具。
 *
 * 类型来自 `AdminReportService['getAdminReports']` 的真实返回：
 * `{ reports: AdminReport[]; next_batch?: string }`。
 */
import type { AdminReportService } from '@/services/matrix/admin/ReportService'

/** `getAdminReports()` 的响应 */
type AdminReportPage = Awaited<ReturnType<AdminReportService['getAdminReports']>>

/** 生成举报分页响应。 */
export function makeAdminReportPage(reports: AdminReportPage['reports'] = [], nextBatch?: string): AdminReportPage {
  return nextBatch === undefined ? { reports } : { reports, next_batch: nextBatch }
}
