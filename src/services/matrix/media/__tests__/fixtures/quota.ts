/**
 * 媒体配额测试夹具。
 *
 * 契约来源：`mediaConfigOps.MediaQuotaStatsResult`
 * （`fetchQuotaStats()` 的判别联合：成功带 `MediaQuotaStats`，失败带可判定原因）。
 */
import type {
  MediaQuotaAlertsResult,
  MediaQuotaStats,
  MediaQuotaStatsResult,
  MediaQuotaUnavailableReason
} from '@/services/matrix/media/mediaConfigOps'

export function makeQuotaStats(overrides: Partial<MediaQuotaStats> = {}): MediaQuotaStats {
  return { storageBytes: 0, mediaCount: 0, limitBytes: 0, ...overrides }
}

export function makeQuotaStatsOk(stats = makeQuotaStats()): MediaQuotaStatsResult {
  return { ok: true, stats }
}

export function makeQuotaStatsUnavailable(reason: MediaQuotaUnavailableReason = 'unavailable'): MediaQuotaStatsResult {
  return { ok: false, reason }
}

export function makeQuotaAlertsUnavailable(
  reason: MediaQuotaUnavailableReason = 'unavailable'
): MediaQuotaAlertsResult {
  return { ok: false, reason }
}
