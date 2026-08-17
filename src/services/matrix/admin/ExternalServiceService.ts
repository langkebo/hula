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

export class AdminExternalServiceService {
  constructor(private readonly getClient: GetClientGetter) {}

  private getManager() {
    return this.getClient().getAdminManager().externalService
  }

  /**
   * 列出外部服务。可按 service_type 过滤。
   */
  async listServices(params: ListServicesParams = {}): Promise<ExternalService[]> {
    try {
      const serviceType = params.serviceType && params.serviceType !== 'all' ? params.serviceType : undefined
      const result = await this.getManager().listServices(serviceType)
      return (result ?? []) as ExternalService[]
    } catch (err) {
      logger.error(`[AdminExternalService] listServices 失败: ${err}`)
      return []
    }
  }

  /**
   * 注册外部服务。
   */
  async registerService(request: RegisterExternalServiceRequest): Promise<ExternalService> {
    const result = await this.getManager().registerService(request)
    logger.info(`[AdminExternalService] 注册外部服务成功: ${result?.as_id}`)
    return result as ExternalService
  }

  /**
   * 更新外部服务配置。
   */
  async updateService(asId: string, request: UpdateExternalServiceRequest): Promise<ExternalService> {
    const result = await this.getManager().updateService(asId, request)
    logger.info(`[AdminExternalService] 更新外部服务成功: ${asId}`)
    return result as ExternalService
  }

  /**
   * 注销外部服务。
   */
  async deleteService(asId: string): Promise<void> {
    await this.getManager().deleteService(asId)
    logger.info(`[AdminExternalService] 注销外部服务成功: ${asId}`)
  }

  /**
   * 获取所有外部服务的健康状态。
   */
  async getAllHealth(): Promise<ExternalServiceHealth[]> {
    try {
      const result = await this.getManager().getAllHealth()
      return (result ?? []) as ExternalServiceHealth[]
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
      return (await this.getManager().getServiceHealth(asId)) as ExternalServiceHealth | null
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
    const result = await this.getManager().checkServiceHealth(asId)
    logger.info(`[AdminExternalService] 健康检查完成: ${asId} healthy=${result?.is_healthy}`)
    return result as HealthCheckResult
  }
}
