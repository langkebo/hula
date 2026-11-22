import { DEFAULT_PAGE_LIMIT } from '@/common/constants'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ApplicationService')

/** 应用服务命名空间条目（Matrix Application Service API：正则 + 是否独占）。 */
interface ApplicationServiceNamespace {
  regex: string
  exclusive: boolean
}

/** 应用服务命名空间集合。 */
export interface ApplicationServiceNamespaces {
  users?: ApplicationServiceNamespace[]
  rooms?: ApplicationServiceNamespace[]
  aliases?: ApplicationServiceNamespace[]
}

/** 应用服务注册 / 更新请求体（Matrix Application Service API 注册配置）。 */
export interface ApplicationServiceConfig {
  id?: string
  as_token?: string
  hs_token?: string
  url?: string | null
  sender_localpart?: string
  namespaces?: ApplicationServiceNamespaces
  rate_limited?: boolean
  protocols?: string[]
  is_enabled?: boolean
}

/**
 * 应用服务（Application Service）响应。
 *
 * 列表、详情与注册三个端点共用同一实体；后端同时存在 `id`（DB 行 ID，数字）
 * 与 `as_id`（业务 ID，字符串）两套主键命名，界面做兼容读取，故全部按可选建模。
 */
export interface ApplicationServiceResponse {
  id?: number | string
  as_id?: string
  url?: string | null
  sender?: string
  sender_localpart?: string
  as_token?: string
  hs_token?: string
  description?: string
  rate_limited?: boolean
  is_enabled?: boolean
  enabled?: boolean
  protocols?: string[]
  namespaces?: ApplicationServiceNamespaces
  created_ts?: number
  /** 后端版本的扩展字段，界面按动态键读取。 */
  [key: string]: unknown
}

export interface ApplicationServiceAdmin {
  listApplicationServices(params: { limit: number; from?: string | undefined }): Promise<{
    services: ApplicationServiceResponse[]
    next_token?: string
  }>
  registerApplicationService(asToken: string, config: ApplicationServiceConfig): Promise<ApplicationServiceResponse>
  getApplicationService(serviceId: string): Promise<ApplicationServiceResponse>
  updateApplicationService(serviceId: string, config: ApplicationServiceConfig): Promise<void>
  deleteApplicationService(serviceId: string): Promise<void>
  pingApplicationService(serviceId: string): Promise<{
    ok: boolean
    duration_ms?: number
  }>
}

type ApplicationDomainSdkGetter = () => Promise<ApplicationServiceAdmin>

export class AdminApplicationService {
  constructor(private readonly sdkAdmin: ApplicationDomainSdkGetter) {}

  async getApplicationServices(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{ services: ApplicationServiceResponse[]; nextToken?: string | undefined }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listApplicationServices({ limit, from })
      return {
        services: result?.services ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[AdminApplication] 获取应用服务列表失败: ${err}`)
      return { services: [] }
    }
  }

  async registerApplicationService(
    asToken: string,
    config: ApplicationServiceConfig
  ): Promise<ApplicationServiceResponse> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.registerApplicationService(asToken, config)
      logger.info('[AdminApplication] 注册应用服务成功')
      return result
    } catch (err) {
      logger.error(`[AdminApplication] 注册应用服务失败: ${err}`)
      throw err
    }
  }

  async getApplicationService(serviceId: string): Promise<ApplicationServiceResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getApplicationService(serviceId)) ?? null
    } catch (err) {
      logger.error(`[AdminApplication] 获取应用服务详情失败: ${err}`)
      return null
    }
  }

  async updateApplicationService(serviceId: string, config: ApplicationServiceConfig): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateApplicationService(serviceId, config)
      logger.info(`[AdminApplication] 更新应用服务: ${serviceId}`)
    } catch (err) {
      logger.error(`[AdminApplication] 更新应用服务失败: ${err}`)
      throw err
    }
  }

  async deleteApplicationService(serviceId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteApplicationService(serviceId)
      logger.info(`[AdminApplication] 删除应用服务: ${serviceId}`)
    } catch (err) {
      logger.error(`[AdminApplication] 删除应用服务失败: ${err}`)
      throw err
    }
  }

  async pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number | undefined }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.pingApplicationService(serviceId)
      logger.info(`[AdminApplication] Ping应用服务: ${serviceId}`)
      return { ok: result?.ok ?? false, durationMs: result?.duration_ms }
    } catch (err) {
      logger.error(`[AdminApplication] Ping应用服务失败: ${err}`)
      return { ok: false }
    }
  }
}
