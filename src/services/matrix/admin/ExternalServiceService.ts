/**
 * 外部服务管理服务（Admin）
 *
 * 对应 synapse-rust 的 `/_synapse/admin/v1/external_services/*` 路由，
 * 提供外部服务（TrendRadar / OpenClaw / Generic Webhook / IRC / Slack / Discord / Custom）
 * 的注册、查询、更新、删除与健康检查能力。
 *
 * 路由清单：
 *   GET    /external_services                          列表（可按 service_type 过滤）
 *   POST   /external_services                          注册
 *   GET    /external_services/health                   全部健康状态
 *   GET    /external_services/{as_id}/health           单个健康状态
 *   POST   /external_services/{as_id}/health/check     触发健康检查
 *   PUT    /external_services/{as_id}                  更新
 *   DELETE /external_services/{as_id}                  注销
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('AdminExternalService')

type GetClientGetter = () => MatrixClient

/** 外部服务类型（与后端 ExternalServiceType 对齐）。 */
export type ExternalServiceType =
  | 'trendradar'
  | 'openclaw'
  | 'generic_webhook'
  | 'webhook'
  | 'irc_bridge'
  | 'irc'
  | 'slack_bridge'
  | 'slack'
  | 'discord_bridge'
  | 'discord'
  | 'custom'

/** 外部服务实体（对应后端 ExternalServiceResponse）。 */
export interface ExternalService {
  as_id: string
  service_type: string
  service_id: string
  display_name: string
  is_enabled: boolean
  is_healthy: boolean
  created_ts: number
}

/** 单条外部服务健康状态。 */
export interface ExternalServiceHealth {
  service_id: string
  service_type: string
  is_healthy: boolean
  last_check_ts: number | null
  last_success_ts: number | null
  last_error: string | null
  consecutive_failures: number
}

/** 注册外部服务的请求体。 */
export interface RegisterExternalServiceRequest {
  service_type: string
  service_id: string
  display_name: string
  webhook_url?: string
  api_key?: string
  config?: Record<string, unknown>
}

/** 更新外部服务的请求体（所有字段可选）。 */
export interface UpdateExternalServiceRequest {
  webhook_url?: string
  api_key?: string
  config?: Record<string, unknown>
  is_enabled?: boolean
}

/** 列表查询参数。 */
export interface ListServicesParams {
  /** 按服务类型过滤；传 'all' 或不传表示全部。 */
  serviceType?: string
}

/** 健康检查触发结果。 */
export interface HealthCheckResult {
  as_id: string
  is_healthy: boolean
}

const SYNAPSE_ADMIN_BASE = MATRIX_PATHS.ADMIN.SYNAPSE_ADMIN_BASE

export class AdminExternalServiceService {
  constructor(private readonly getClient: GetClientGetter) {}

  private async adminRequest<TResponse>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    queryParams?: Record<string, string | number | boolean | string[] | undefined>,
    body?: Record<string, unknown>
  ): Promise<TResponse> {
    // Not migrated to client.getExternalServiceManager():
    // SDK ExternalServiceManager uses field names { id, type, url, enabled, status }
    // and listServices() returns { services: [...] } with no service_type filter,
    // but the backend ExternalServiceResponse (external_service.rs) returns
    // { as_id, service_type, service_id, display_name, is_enabled, is_healthy, created_ts }
    // and accepts a service_type query filter. The service interface matches the
    // backend; the SDK contract does not. Contract mismatch — left as direct HTTP.
    const client = this.getClient()
    return client.http.authedRequest(
      method,
      path,
      queryParams,
      method === 'GET' || method === 'DELETE' ? undefined : body,
      { prefix: SYNAPSE_ADMIN_BASE }
    ) as Promise<TResponse>
  }

  /**
   * 列出外部服务。可按 service_type 过滤。
   */
  async listServices(params: ListServicesParams = {}): Promise<ExternalService[]> {
    try {
      let queryParams: Record<string, string | number | boolean | string[] | undefined> | undefined
      if (params.serviceType && params.serviceType !== 'all') {
        queryParams = { service_type: params.serviceType }
      }
      const result = await this.adminRequest<ExternalService[]>('GET', '/external_services', queryParams)
      return result ?? []
    } catch (err) {
      logger.error(`[AdminExternalService] listServices 失败: ${err}`)
      return []
    }
  }

  /**
   * 注册外部服务。
   */
  async registerService(request: RegisterExternalServiceRequest): Promise<ExternalService> {
    const body: Record<string, unknown> = {
      service_type: request.service_type,
      service_id: request.service_id,
      display_name: request.display_name
    }
    if (request.webhook_url !== undefined) body.webhook_url = request.webhook_url
    if (request.api_key !== undefined) body.api_key = request.api_key
    if (request.config !== undefined) body.config = request.config

    const result = await this.adminRequest<ExternalService>('POST', '/external_services', undefined, body)
    logger.info(`[AdminExternalService] 注册外部服务成功: ${result?.as_id}`)
    return result
  }

  /**
   * 更新外部服务配置。
   */
  async updateService(asId: string, request: UpdateExternalServiceRequest): Promise<ExternalService> {
    const body: Record<string, unknown> = {}
    if (request.webhook_url !== undefined) body.webhook_url = request.webhook_url
    if (request.api_key !== undefined) body.api_key = request.api_key
    if (request.config !== undefined) body.config = request.config
    if (request.is_enabled !== undefined) body.is_enabled = request.is_enabled

    const result = await this.adminRequest<ExternalService>(
      'PUT',
      `/external_services/${encodeURIComponent(asId)}`,
      undefined,
      body
    )
    logger.info(`[AdminExternalService] 更新外部服务成功: ${asId}`)
    return result
  }

  /**
   * 注销外部服务。
   */
  async deleteService(asId: string): Promise<void> {
    await this.adminRequest<void>('DELETE', `/external_services/${encodeURIComponent(asId)}`)
    logger.info(`[AdminExternalService] 注销外部服务成功: ${asId}`)
  }

  /**
   * 获取所有外部服务的健康状态。
   */
  async getAllHealth(): Promise<ExternalServiceHealth[]> {
    try {
      const result = await this.adminRequest<ExternalServiceHealth[]>('GET', '/external_services/health')
      return result ?? []
    } catch (err) {
      logger.error(`[AdminExternalService] getAllHealth 失败: ${err}`)
      return []
    }
  }

  /**
   * 获取单个外部服务的健康状态。404 时返回 null。
   */
  async getServiceHealth(asId: string): Promise<ExternalServiceHealth | null> {
    try {
      return await this.adminRequest<ExternalServiceHealth>(
        'GET',
        `/external_services/${encodeURIComponent(asId)}/health`
      )
    } catch (err) {
      const status = (err as { httpStatus?: number }).httpStatus
      if (status === 404) {
        return null
      }
      logger.error(`[AdminExternalService] getServiceHealth 失败: ${err}`)
      return null
    }
  }

  /**
   * 触发一次健康检查并返回最新状态。
   */
  async checkServiceHealth(asId: string): Promise<HealthCheckResult> {
    const result = await this.adminRequest<HealthCheckResult>(
      'POST',
      `/external_services/${encodeURIComponent(asId)}/health/check`
    )
    logger.info(`[AdminExternalService] 健康检查完成: ${asId} healthy=${result?.is_healthy}`)
    return result
  }
}
