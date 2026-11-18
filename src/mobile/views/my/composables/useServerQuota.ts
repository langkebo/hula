import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { formatBytes } from '@/utils/Formatting'

export type ServerQuotaState = 'loading' | 'available' | 'unavailable'
export type ServerQuotaAlert = Extract<
  Awaited<ReturnType<typeof matrixMediaService.getQuotaAlerts>>,
  { ok: true }
>['alerts'][number]

/**
 * 服务端媒体配额（与浏览器存储用量是两套数据）。
 *
 * 数据全部来自 `matrixMediaService`（R1：复用既有服务层，不新建 HTTP 客户端）：
 * - `checkQuota()`：上限 / 已用 / 剩余；
 * - `getQuotaStats()`：媒体数量（服务端无该接口时拿 `ok: false`，此时不谎报 0 个）；
 * - `getQuotaAlerts()`：配额告警（含 `is_read` / `alert_type` / `current_usage_bytes`）。
 * 配额读取失败时整块显示「暂不可用 + 重试」，不用 0 B 冒充真实占用。
 */
export function useServerQuota() {
  const { t } = useI18n()

  const state = ref<ServerQuotaState>('loading')
  const used = ref(0)
  const limit = ref(0)
  const remaining = ref(0)
  /** null 表示本次拿不到媒体数量（接口不支持或失败），UI 不显示成 0 */
  const mediaCount = ref<number | null>(null)
  const alerts = ref<ServerQuotaAlert[]>([])
  /** 告警读取失败：UI 显示「暂不可用」，不能画成「暂无告警」 */
  const alertsUnavailable = ref(false)

  const exceeded = computed(() => limit.value > 0 && remaining.value <= 0)

  /** 告警副行：类型 + 阈值 + 当次用量，避免只显示一条 message 无法判断严重程度 */
  function alertMeta(alert: ServerQuotaAlert): string {
    const type =
      alert.alert_type === 'quota_exceeded'
        ? t('mobile_storage.server_quota_alert_type_exceeded')
        : t('mobile_storage.server_quota_alert_type_warning')
    return t('mobile_storage.server_quota_alert_meta', {
      type,
      threshold: alert.threshold_percent,
      used: formatBytes(alert.current_usage_bytes),
      limit: formatBytes(alert.quota_limit_bytes)
    })
  }

  async function load(): Promise<void> {
    state.value = 'loading'
    const [usageResult, statsResult] = await Promise.all([
      matrixMediaService.checkQuota(),
      matrixMediaService.getQuotaStats()
    ])

    if (!usageResult) {
      state.value = 'unavailable'
      return
    }

    used.value = usageResult.used
    limit.value = usageResult.limit
    remaining.value = usageResult.remaining
    mediaCount.value = statsResult.ok ? statsResult.stats.mediaCount : null
    const alertsResult = await matrixMediaService.getQuotaAlerts()
    alertsUnavailable.value = !alertsResult.ok
    alerts.value = alertsResult.ok ? alertsResult.alerts : []
    state.value = 'available'
  }

  return { state, used, limit, remaining, mediaCount, alerts, alertsUnavailable, exceeded, alertMeta, load }
}
