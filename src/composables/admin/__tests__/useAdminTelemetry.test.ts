import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  TelemetryAlert,
  TelemetryHealthCheck,
  TelemetryMetricsSummary,
  TelemetryStatus
} from '@/services/matrix/admin/TelemetryService'
import { useAdminTelemetry } from '../useAdminTelemetry'

const { telemetryMock } = vi.hoisted(() => ({
  telemetryMock: {
    getStatus: vi.fn(),
    getHealth: vi.fn(),
    getMetricsSummary: vi.fn(),
    listAlerts: vi.fn(),
    getResourceAttributes: vi.fn(),
    acknowledgeAlert: vi.fn()
  }
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: { telemetry: telemetryMock }
}))

const STATUS: TelemetryStatus = {
  enabled: true,
  trace_enabled: false,
  metrics_enabled: true,
  service_name: 'synapse-rust',
  service_version: '1.0.0',
  sampling_ratio: 0.25,
  export_config: {
    otlp_endpoint: 'http://collector:4317',
    prometheus_port: 9000,
    prometheus_path: '/metrics',
    batch_export: true
  }
}

const HEALTH: TelemetryHealthCheck = {
  status: 'ok',
  service: 'synapse-rust',
  trace_enabled: false,
  metrics_enabled: true,
  checks: {},
  database: {},
  alerts: []
}

const METRICS: TelemetryMetricsSummary = {
  total_metrics: 12,
  total_counters: 8,
  total_gauges: 3,
  total_histograms: 1,
  rendered_bytes: 2048,
  snapshot_ts: 1_700_000_000,
  appservice_scheduler: {
    total_services: 2,
    scheduler_available_services: 2,
    services_in_backoff: 0,
    services_capacity_limited: 0,
    services_with_pending_transactions: 1,
    total_pending_events: 4,
    total_pending_transactions: 1,
    total_success_count: 10,
    total_failure_count: 1,
    total_backoff_count: 0,
    total_capacity_limited_count: 0,
    total_in_flight_count: 1
  }
}

function alert(overrides: Partial<TelemetryAlert> = {}): TelemetryAlert {
  return {
    alert_id: 'a1',
    alert_key: 'k1',
    rule_name: 'db_down',
    severity: 'critical',
    status: 'firing',
    owner: 'ops',
    message: 'database unavailable',
    trigger_count: 1,
    triggered_at: 1_700_000_000,
    last_seen_ts: 1_700_000_100,
    acknowledged_at: null,
    acknowledged_by: null,
    recovered_at: null,
    closed_at: null,
    metrics: null,
    ...overrides
  }
}

describe('useAdminTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    telemetryMock.getStatus.mockResolvedValue(STATUS)
    telemetryMock.getHealth.mockResolvedValue(HEALTH)
    telemetryMock.getMetricsSummary.mockResolvedValue(METRICS)
    telemetryMock.listAlerts.mockResolvedValue([alert()])
    telemetryMock.getResourceAttributes.mockResolvedValue({ attributes: { service: 'synapse' } })
    telemetryMock.acknowledgeAlert.mockResolvedValue(alert({ status: 'acknowledged' }))
  })

  it('loadAll 汇总状态、健康、指标、告警与资源属性', async () => {
    const c = useAdminTelemetry()
    await c.loadAll()

    expect(c.status.value).toEqual(STATUS)
    expect(c.health.value).toEqual(HEALTH)
    expect(c.metrics.value).toEqual(METRICS)
    expect(c.alerts.value).toHaveLength(1)
    expect(c.attributes.value).toEqual({ service: 'synapse' })
    expect(c.unsupported.value).toBe(false)
    expect(telemetryMock.listAlerts).toHaveBeenCalledWith()
  })

  it('status 与 metrics 同时为空时判定为能力未启用', async () => {
    telemetryMock.getStatus.mockResolvedValue(null)
    telemetryMock.getMetricsSummary.mockResolvedValue(null)
    telemetryMock.listAlerts.mockResolvedValue([])
    telemetryMock.getResourceAttributes.mockResolvedValue({ attributes: {} })

    const c = useAdminTelemetry()
    await c.loadAll()

    expect(c.unsupported.value).toBe(true)
    expect(c.alerts.value).toEqual([])
    expect(c.attributes.value).toEqual({})
  })

  it('部分接口失败时降级为空值但不置为未启用', async () => {
    telemetryMock.getHealth.mockRejectedValue(new Error('boom'))
    telemetryMock.listAlerts.mockRejectedValue(new Error('boom'))
    telemetryMock.getResourceAttributes.mockRejectedValue(new Error('boom'))

    const c = useAdminTelemetry()
    await c.loadAll()

    expect(c.health.value).toBeNull()
    expect(c.alerts.value).toEqual([])
    expect(c.attributes.value).toEqual({})
    expect(c.unsupported.value).toBe(false)
  })

  it('acknowledge 成功后以 refresh=false 重新拉取告警', async () => {
    const c = useAdminTelemetry()
    telemetryMock.listAlerts.mockResolvedValueOnce([alert()]).mockResolvedValueOnce([alert({ status: 'acknowledged' })])

    await c.loadAll()
    await c.acknowledge('a1')

    expect(telemetryMock.acknowledgeAlert).toHaveBeenCalledWith('a1')
    expect(telemetryMock.listAlerts).toHaveBeenLastCalledWith({ refresh: false })
    expect(c.alerts.value[0].status).toBe('acknowledged')
  })

  it('acknowledge 失败时向上抛出且复位 loading 标记', async () => {
    telemetryMock.acknowledgeAlert.mockRejectedValue(new Error('ack failed'))

    const c = useAdminTelemetry()
    await expect(c.acknowledge('a1')).rejects.toThrow('ack failed')
    expect(c.ackLoading.value).toBe(false)
  })

  it('loading 标记在 loadAll 前后翻转', async () => {
    const c = useAdminTelemetry()
    const pending = c.loadAll()
    expect(c.loading.value).toBe(true)
    await pending
    expect(c.loading.value).toBe(false)
  })
})
