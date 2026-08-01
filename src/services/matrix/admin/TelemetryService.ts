/**
 * 遥测监控管理服务（Admin）
 *
 * 对应 synapse-rust 的 `/_synapse/admin/v1/telemetry/*` 路由，
 * 提供运行时遥测配置、Prometheus 指标摘要、告警同步与确认能力。
 *
 * 路由清单：
 *   GET  /telemetry/status                          遥测配置与启用状态
 *   GET  /telemetry/attributes                      资源属性
 *   GET  /telemetry/metrics                         指标摘要（总数 / counter / gauge / histogram）
 *   GET  /telemetry/alerts?status&severity&refresh  告警列表（可触发同步）
 *   POST /telemetry/alerts/{alert_id}/ack           确认告警
 *   GET  /telemetry/health                          健康检查（含数据库与告警快照）
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminTelemetry')

type GetClientGetter = () => MatrixClient

/** 遥测严重程度。 */
export type TelemetryAlertSeverity = 'info' | 'warning' | 'high' | 'critical'

/** 遥测告警状态。 */
export type TelemetryAlertStatus = 'firing' | 'acknowledged' | 'recovered' | 'closed'

/** 遥测导出配置。 */
export interface TelemetryExportConfig {
  otlp_endpoint: string | null
  prometheus_port: number | null
  prometheus_path: string | null
  batch_export: boolean
}

/** 遥测状态响应（GET /telemetry/status）。 */
export interface TelemetryStatus {
  enabled: boolean
  trace_enabled: boolean
  metrics_enabled: boolean
  service_name: string
  service_version: string
  sampling_ratio: number
  export_config: TelemetryExportConfig
}

/** 资源属性响应（GET /telemetry/attributes）。 */
export interface TelemetryResourceAttributes {
  attributes: Record<string, string>
}

/** Appservice 调度器遥测摘要。 */
export interface AppserviceSchedulerTelemetrySummary {
  total_services: number
  scheduler_available_services: number
  services_in_backoff: number
  services_capacity_limited: number
  services_with_pending_transactions: number
  total_pending_events: number
  total_pending_transactions: number
  total_success_count: number
  total_failure_count: number
  total_backoff_count: number
  total_capacity_limited_count: number
  total_in_flight_count: number
}

/** 指标摘要响应（GET /telemetry/metrics）。 */
export interface TelemetryMetricsSummary {
  total_metrics: number
  total_counters: number
  total_gauges: number
  total_histograms: number
  rendered_bytes: number
  snapshot_ts: number
  appservice_scheduler: AppserviceSchedulerTelemetrySummary
}

/** 单条遥测告警。 */
export interface TelemetryAlert {
  alert_id: string
  alert_key: string
  rule_name: string
  severity: TelemetryAlertSeverity
  status: TelemetryAlertStatus
  owner: string
  message: string
  trigger_count: number
  triggered_at: number
  last_seen_ts: number
  acknowledged_at: number | null
  acknowledged_by: string | null
  recovered_at: number | null
  closed_at: number | null
  metrics: unknown
}

/** 告警列表响应。 */
export interface TelemetryAlertsResponse {
  alerts: TelemetryAlert[]
}

/** 告警查询参数。 */
export interface TelemetryAlertQueryParams {
  status?: TelemetryAlertStatus
  severity?: TelemetryAlertSeverity
  /** 是否在查询前同步最新健康状态。默认 true。 */
  refresh?: boolean
}

/** 健康检查响应（GET /telemetry/health）。 */
export interface TelemetryHealthCheck {
  status: string
  service: string
  trace_enabled: boolean
  metrics_enabled: boolean
  checks: Record<string, unknown>
  database: Record<string, unknown>
  alerts: TelemetryAlert[]
}

export class AdminTelemetryService {
  constructor(private readonly getClient: GetClientGetter) {}

  /**
   * 获取遥测状态（启用情况、采样率、导出配置）。
   */
  async getStatus(): Promise<TelemetryStatus | null> {
    try {
      const client = this.getClient()
      const result = await client.getTelemetryManager().getServerStatus()
      return (result as TelemetryStatus) ?? null
    } catch (err) {
      logger.error(`[AdminTelemetry] getStatus 失败: ${err}`)
      return null
    }
  }

  /**
   * 获取资源属性（用于 Prometheus 标签等）。
   */
  async getResourceAttributes(): Promise<TelemetryResourceAttributes> {
    try {
      const client = this.getClient()
      const result = await client.getTelemetryManager().getServerAttributes()
      return (result as TelemetryResourceAttributes) ?? { attributes: {} }
    } catch (err) {
      logger.error(`[AdminTelemetry] getResourceAttributes 失败: ${err}`)
      return { attributes: {} }
    }
  }

  /**
   * 获取指标摘要（counter / gauge / histogram 总数 + appservice 调度器摘要）。
   */
  async getMetricsSummary(): Promise<TelemetryMetricsSummary | null> {
    try {
      const client = this.getClient()
      const result = await client.getTelemetryManager().getServerMetricsSummary()
      return (result as TelemetryMetricsSummary) ?? null
    } catch (err) {
      logger.error(`[AdminTelemetry] getMetricsSummary 失败: ${err}`)
      return null
    }
  }

  /**
   * 列出告警。默认会触发一次健康同步，refresh=false 可跳过。
   */
  async listAlerts(params: TelemetryAlertQueryParams = {}): Promise<TelemetryAlert[]> {
    try {
      const client = this.getClient()
      const result = await client.getTelemetryManager().getServerAlerts({
        status: params.status,
        severity: params.severity,
        refresh: params.refresh ?? true
      })
      return (result?.alerts as TelemetryAlert[]) ?? []
    } catch (err) {
      logger.error(`[AdminTelemetry] listAlerts 失败: ${err}`)
      return []
    }
  }

  /**
   * 确认单条告警。
   */
  async acknowledgeAlert(alertId: string): Promise<TelemetryAlert> {
    const client = this.getClient()
    const result = await client.getTelemetryManager().acknowledgeServerAlert(alertId)
    logger.info(`[AdminTelemetry] 已确认告警: ${alertId}`)
    return result as TelemetryAlert
  }

  /**
   * 健康检查（包含 readiness / database / alerts 快照）。
   */
  async getHealth(): Promise<TelemetryHealthCheck | null> {
    try {
      const client = this.getClient()
      const result = await client.getTelemetryManager().getServerHealth()
      return (result as TelemetryHealthCheck) ?? null
    } catch (err) {
      logger.error(`[AdminTelemetry] getHealth 失败: ${err}`)
      return null
    }
  }
}
