import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminTelemetryService } from '../TelemetryService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const telemetryManager = {
  getServerStatus: vi.fn(),
  getServerAttributes: vi.fn(),
  getServerMetricsSummary: vi.fn(),
  getServerAlerts: vi.fn()
}

const makeClient = () => {
  const authedRequest = vi.fn()
  return {
    authedRequest,
    http: { authedRequest },
    getTelemetryManager: () => telemetryManager
  } as unknown as MatrixClient & {
    http: { authedRequest: typeof authedRequest }
  }
}

const makeService = () => {
  const client = makeClient()
  const service = new AdminTelemetryService(() => client)
  return { service, client }
}

describe('AdminTelemetryService — P1-2 遥测监控', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getStatus 委托 TelemetryManager.getServerStatus', async () => {
    const { service } = makeService()
    telemetryManager.getServerStatus.mockResolvedValue({
      enabled: true,
      trace_enabled: false,
      metrics_enabled: true,
      service_name: 'synapse-rust',
      service_version: '0.1.0',
      sampling_ratio: 0.1,
      export_config: {
        otlp_endpoint: null,
        prometheus_port: 9090,
        prometheus_path: '/metrics',
        batch_export: true
      }
    })

    const result = await service.getStatus()
    expect(telemetryManager.getServerStatus).toHaveBeenCalled()
    expect(result?.enabled).toBe(true)
    expect(result?.export_config.prometheus_port).toBe(9090)
  })

  it('getStatus 在出错时降级为 null', async () => {
    const { service } = makeService()
    telemetryManager.getServerStatus.mockRejectedValue(new Error('boom'))
    const result = await service.getStatus()
    expect(result).toBeNull()
  })

  it('getResourceAttributes 委托 getServerAttributes', async () => {
    const { service } = makeService()
    telemetryManager.getServerAttributes.mockResolvedValue({
      attributes: { service: 'synapse-rust', version: '0.1.0' }
    })

    const result = await service.getResourceAttributes()
    expect(telemetryManager.getServerAttributes).toHaveBeenCalled()
    expect(result.attributes.service).toBe('synapse-rust')
  })

  it('getResourceAttributes 在出错时返回空 attributes', async () => {
    const { service } = makeService()
    telemetryManager.getServerAttributes.mockRejectedValue(new Error('boom'))
    const result = await service.getResourceAttributes()
    expect(result).toEqual({ attributes: {} })
  })

  it('getMetricsSummary 委托 getServerMetricsSummary', async () => {
    const { service } = makeService()
    telemetryManager.getServerMetricsSummary.mockResolvedValue({
      total_metrics: 42,
      total_counters: 20,
      total_gauges: 15,
      total_histograms: 7,
      rendered_bytes: 4096,
      snapshot_ts: 1700000000000,
      appservice_scheduler: {
        total_services: 2,
        scheduler_available_services: 2,
        services_in_backoff: 0,
        services_capacity_limited: 0,
        services_with_pending_transactions: 0,
        total_pending_events: 0,
        total_pending_transactions: 0,
        total_success_count: 100,
        total_failure_count: 5,
        total_backoff_count: 0,
        total_capacity_limited_count: 0,
        total_in_flight_count: 0
      }
    })

    const result = await service.getMetricsSummary()
    expect(telemetryManager.getServerMetricsSummary).toHaveBeenCalled()
    expect(result?.total_metrics).toBe(42)
    expect(result?.appservice_scheduler.total_success_count).toBe(100)
  })

  it('listAlerts 默认 refresh=true', async () => {
    const { service } = makeService()
    telemetryManager.getServerAlerts.mockResolvedValue({
      alerts: [{ alert_id: 'a-1', severity: 'critical', status: 'firing' }]
    })

    const result = await service.listAlerts()
    expect(telemetryManager.getServerAlerts).toHaveBeenCalledWith({ refresh: true })
    expect(result).toHaveLength(1)
    expect(result[0].alert_id).toBe('a-1')
  })

  it('listAlerts 透传 status / severity / refresh 参数', async () => {
    const { service } = makeService()
    telemetryManager.getServerAlerts.mockResolvedValue({ alerts: [] })

    await service.listAlerts({ status: 'firing', severity: 'critical', refresh: false })
    expect(telemetryManager.getServerAlerts).toHaveBeenCalledWith({
      refresh: false,
      status: 'firing',
      severity: 'critical'
    })
  })

  it('listAlerts 在出错时降级为空数组', async () => {
    const { service } = makeService()
    telemetryManager.getServerAlerts.mockRejectedValue(new Error('boom'))
    const result = await service.listAlerts()
    expect(result).toEqual([])
  })

  it('acknowledgeAlert 使用 POST /telemetry/alerts/{alert_id}/ack', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({
      alert_id: 'alert-1',
      status: 'acknowledged',
      acknowledged_by: '@admin:matrix.test'
    })

    const result = await service.acknowledgeAlert('alert-1')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/telemetry/alerts/alert-1/ack',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result.status).toBe('acknowledged')
  })

  it('acknowledgeAlert 对 alert_id 进行 URL 编码', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ alert_id: 'a b/c' })
    await service.acknowledgeAlert('a b/c')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/telemetry/alerts/a%20b%2Fc/ack',
      undefined,
      undefined,
      expect.any(Object)
    )
  })

  it('getHealth 使用 GET /telemetry/health', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({
      status: 'ok',
      service: 'synapse-rust',
      trace_enabled: false,
      metrics_enabled: true,
      checks: { database: 'ok' },
      database: { is_healthy: true },
      alerts: []
    })

    const result = await service.getHealth()
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/telemetry/health',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result?.status).toBe('ok')
    expect(result?.database.is_healthy).toBe(true)
  })

  it('getHealth 在出错时降级为 null', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockRejectedValue(new Error('boom'))
    const result = await service.getHealth()
    expect(result).toBeNull()
  })
})
