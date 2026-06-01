import { createLogger } from '@/utils/Logger'

const logger = createLogger('ApplicationService')

export interface ApplicationServiceAdmin {
  listApplicationServices(params: { limit: number; from?: string }): Promise<{
    services: Array<Record<string, unknown>>
    next_token?: string
  }>
  registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>>
  getApplicationService(serviceId: string): Promise<Record<string, unknown>>
  updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void>
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
    limit = 50,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }> {
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

  async registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
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

  async getApplicationService(serviceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getApplicationService(serviceId)) ?? null
    } catch (err) {
      logger.error(`[AdminApplication] 获取应用服务详情失败: ${err}`)
      return null
    }
  }

  async updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void> {
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

  async pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number }> {
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
