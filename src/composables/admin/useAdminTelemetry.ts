import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type {
  TelemetryAlert,
  TelemetryHealthCheck,
  TelemetryMetricsSummary,
  TelemetryStatus
} from '@/services/matrix/admin/TelemetryService'

interface UseAdminTelemetryResult {
  status: Ref<TelemetryStatus | null>
  health: Ref<TelemetryHealthCheck | null>
  metrics: Ref<TelemetryMetricsSummary | null>
  alerts: Ref<TelemetryAlert[]>
  attributes: Ref<Record<string, string>>
  loading: Ref<boolean>
  ackLoading: Ref<boolean>
  unsupported: Ref<boolean>

  loadAll: () => Promise<void>
  acknowledge: (alertId: string) => Promise<void>
}

function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

/**
 * Admin telemetry composable.
 *
 * `AdminTelemetryService` 把网络错误吞成 null/空值，因此这里用「加载完成后
 * status 与 metrics 同时为 null」判定遥测能力未启用/不可达，交由视图降级为
 * 「能力未启用」提示，而不是渲染一堆必然失败的操作。
 */
export function useAdminTelemetry(): UseAdminTelemetryResult {
  const status = ref<TelemetryStatus | null>(null)
  const health = ref<TelemetryHealthCheck | null>(null)
  const metrics = ref<TelemetryMetricsSummary | null>(null)
  const alerts = ref<TelemetryAlert[]>([])
  const attributes = ref<Record<string, string>>({})
  const loading = ref(false)
  const ackLoading = ref(false)
  const unsupported = ref(false)

  async function loadAll() {
    loading.value = true
    try {
      const [statusRes, healthRes, metricsRes, alertsRes, attributesRes] = await Promise.allSettled([
        adminService.telemetry.getStatus(),
        adminService.telemetry.getHealth(),
        adminService.telemetry.getMetricsSummary(),
        adminService.telemetry.listAlerts(),
        adminService.telemetry.getResourceAttributes()
      ])

      status.value = unwrap(statusRes, null)
      health.value = unwrap(healthRes, null)
      metrics.value = unwrap(metricsRes, null)
      alerts.value = unwrap(alertsRes, [])
      attributes.value = unwrap(attributesRes, { attributes: {} }).attributes
      unsupported.value = status.value === null && metrics.value === null
    } finally {
      loading.value = false
    }
  }

  async function acknowledge(alertId: string) {
    ackLoading.value = true
    try {
      await adminService.telemetry.acknowledgeAlert(alertId)
      alerts.value = await adminService.telemetry.listAlerts({ refresh: false })
    } finally {
      ackLoading.value = false
    }
  }

  return {
    status,
    health,
    metrics,
    alerts,
    attributes,
    loading,
    ackLoading,
    unsupported,
    loadAll,
    acknowledge
  }
}
