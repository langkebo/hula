/**
 * admin 配额域测试夹具。
 *
 * 类型全部来自真实契约，不手抄：
 * - 用户侧配额：`matrixMediaService.checkQuota` / `getQuotaStats` / `getQuotaAlerts`
 *   （见 `src/services/matrix/media/mediaConfigOps.ts` 的 `MediaQuotaStatsResult` /
 *   `MediaQuotaAlertsResult`）；
 * - 服务端总配额：SDK `AdminManager['media'].getMediaQuota()`。
 *
 * ⚠️ 告警此前在测试里只写 `{ alert_id, alert_type }` 两个字段，而 SDK 的
 * `MediaQuotaAlert` 有 8 个必填字段 —— 夹具按契约补全，暴露了这个假结构。
 */
import type { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type {
  MediaQuotaAlertsResult,
  MediaQuotaStats,
  MediaQuotaStatsResult,
  MediaQuotaUnavailableReason
} from '@/services/matrix/media/mediaConfigOps'
import type { AdminManager, MediaQuotaAlert } from '@/services/matrix/sdk'

/** `checkQuota()` 的成功返回（`null` 表示媒体管理器未就绪，服务层会转成错误） */
type MediaQuotaUsage = NonNullable<Awaited<ReturnType<typeof matrixMediaService.checkQuota>>>
/** `AdminManager['media'].getMediaQuota()` 的返回 */
type ServerMediaQuota = Awaited<ReturnType<AdminManager['media']['getMediaQuota']>>

/** 单条配额告警（SDK `MediaQuotaAlert`，全部字段必填） */
export function makeMediaQuotaAlert(overrides: Partial<MediaQuotaAlert> = {}): MediaQuotaAlert {
  return {
    alert_id: 'alert-1',
    alert_type: 'quota_warning',
    threshold_percent: 80,
    current_usage_bytes: 900,
    quota_limit_bytes: 1000,
    message: '媒体存储用量已超过 80%',
    created_ts: 1795000000000,
    is_read: false,
    ...overrides
  }
}

/** `matrixMediaService.checkQuota()` 的用量结果 */
export function makeMediaQuotaUsage(overrides: Partial<MediaQuotaUsage> = {}): MediaQuotaUsage {
  return { limit: 1024, used: 256, remaining: 768, ...overrides }
}

/** `matrixMediaService.getQuotaStats()` 成功分支 */
export function makeMediaQuotaStats(stats: Partial<MediaQuotaStats> = {}): MediaQuotaStatsResult {
  return { ok: true, stats: { storageBytes: 2048, mediaCount: 3, limitBytes: 4096, ...stats } }
}

/** `matrixMediaService.getQuotaStats()` 失败分支 */
export function makeMediaQuotaStatsUnavailable(reason: MediaQuotaUnavailableReason): MediaQuotaStatsResult {
  return { ok: false, reason }
}

/** `matrixMediaService.getQuotaAlerts()` 成功分支 */
export function makeMediaQuotaAlerts(alerts: MediaQuotaAlert[]): MediaQuotaAlertsResult {
  return { ok: true, alerts }
}

/** `matrixMediaService.getQuotaAlerts()` 失败分支 */
export function makeMediaQuotaAlertsUnavailable(reason: MediaQuotaUnavailableReason): MediaQuotaAlertsResult {
  return { ok: false, reason }
}

/** `AdminManager['media'].getMediaQuota()` 的服务端总配额 */
export function makeServerMediaQuota(overrides: Partial<ServerMediaQuota> = {}): ServerMediaQuota {
  return { total_size: 1000, total_count: 5, default_size_limit: 100, default_count_limit: 10, ...overrides }
}
