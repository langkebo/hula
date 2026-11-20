/**
 * 事件举报统计测试夹具。
 *
 * 类型来自 `matrixEventReportService.getStatusCount()` 的真实返回（SDK `StatusCountResponse`）：
 * `{ status: string; count: number }`。
 */
import type { matrixEventReportService } from '@/services/matrix/moderation/MatrixEventReportService'

/** `getStatusCount()` 的响应 */
type StatusCountResponse = Awaited<ReturnType<typeof matrixEventReportService.getStatusCount>>

/** 生成举报状态计数。 */
export function makeStatusCount(status: StatusCountResponse['status'] = 'open', count = 0): StatusCountResponse {
  return { status, count }
}
