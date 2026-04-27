import { error, info } from '@tauri-apps/plugin-log'

type ApplicationDomainSdkGetter = () => Promise<unknown>

export class AdminApplicationService {
  constructor(private readonly sdkAdmin: ApplicationDomainSdkGetter) {}

  async getApplicationServices(
    limit = 50,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listApplicationServices(params: { limit?: number; from?: string }): Promise<{
          services: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listApplicationServices({ limit, from })
      return {
        services: result?.services ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[AdminApplication] 获取应用服务列表失败: ${err}`)
      return { services: [] }
    }
  }

  async registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>>
      }
      const result = await admin.registerApplicationService(asToken, config)
      info('[AdminApplication] 注册应用服务成功')
      return result
    } catch (err) {
      error(`[AdminApplication] 注册应用服务失败: ${err}`)
      throw err
    }
  }

  async getApplicationService(serviceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getApplicationService(serviceId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getApplicationService(serviceId)) ?? null
    } catch (err) {
      error(`[AdminApplication] 获取应用服务详情失败: ${err}`)
      return null
    }
  }

  async updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void>
      }
      await admin.updateApplicationService(serviceId, config)
      info(`[AdminApplication] 更新应用服务: ${serviceId}`)
    } catch (err) {
      error(`[AdminApplication] 更新应用服务失败: ${err}`)
      throw err
    }
  }

  async deleteApplicationService(serviceId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteApplicationService(serviceId: string): Promise<void>
      }
      await admin.deleteApplicationService(serviceId)
      info(`[AdminApplication] 删除应用服务: ${serviceId}`)
    } catch (err) {
      error(`[AdminApplication] 删除应用服务失败: ${err}`)
      throw err
    }
  }

  async pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        pingApplicationService(serviceId: string): Promise<{ ok?: boolean; duration_ms?: number }>
      }
      const result = await admin.pingApplicationService(serviceId)
      info(`[AdminApplication] Ping应用服务: ${serviceId}`)
      return { ok: result?.ok ?? false, durationMs: result?.duration_ms }
    } catch (err) {
      error(`[AdminApplication] Ping应用服务失败: ${err}`)
      return { ok: false }
    }
  }
}
