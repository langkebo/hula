import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from './BaseMatrixService'
import { MATRIX_PATHS } from './paths'

const logger = createLogger('MatrixApplicationService')

interface ApplicationServiceNamespace {
  exclusive: boolean
  pattern: string
}

interface ApplicationServiceRegistration {
  id?: string
  url: string
  as_token: string
  sender: string
  namespaces?: {
    users?: ApplicationServiceNamespace[]
    rooms?: ApplicationServiceNamespace[]
    aliases?: ApplicationServiceNamespace[]
  }
}

interface RegisteredApplicationService {
  id: string
  url: string
}

/**
 * SDK AdminManager 上与应用服务相关的子集。
 *
 * 与 admin/ApplicationService.ts 中的 ApplicationServiceAdmin 接口保持一致，
 * 由 MatrixClient.getAdminManager() 返回的 AdminManager（或其 Proxy）提供实现。
 */
interface ApplicationServiceAdmin {
  listApplicationServices(params?: { limit?: number; from?: string }): Promise<{
    services?: RegisteredApplicationService[]
    next_token?: string
  }>
  registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>>
  getApplicationService(serviceId: string): Promise<Record<string, unknown> | null>
  updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void>
  deleteApplicationService(serviceId: string): Promise<void>
}

class MatrixApplicationService extends BaseMatrixService {
  /**
   * 获取 SDK AdminManager（如果可用）。
   *
   * 遵循 MatrixPushService 的模式：通过 client.getAdminManager?.() 取得 SDK 管理器，
   * 若 SDK 未注册则返回 undefined，调用方据此回退到直接 HTTP 调用。
   * SDK AdminManager 自身会在服务端进行管理员权限校验（403 拒绝非管理员）。
   *
   * SDK AdminManager 通过 ES Proxy 在运行时转发应用服务方法（见
   * matrix-js-sdk/src/admin/index.ts），但 TypeScript 接口未声明这些方法，
   * 因此需要 unknown 中转 cast（与 admin/ApplicationService.ts 同模式）。
   */
  private resolveAdminManager(): ApplicationServiceAdmin | undefined {
    const client = this.getClient() as unknown as { getAdminManager?: () => ApplicationServiceAdmin }
    return client.getAdminManager?.()
  }

  async register(payload: ApplicationServiceRegistration): Promise<void> {
    try {
      const admin = this.resolveAdminManager()
      if (admin) {
        await admin.registerApplicationService(payload.as_token, payload as unknown as Record<string, unknown>)
        logger.info('[MatrixApplicationService] 注册应用服务成功 (SDK)')
        return
      }
      await this.getClient().http.authedRequest('POST', MATRIX_PATHS.ADMIN.APPSERVICES, undefined, payload)
      logger.info('[MatrixApplicationService] 注册应用服务成功 (REST)')
    } catch (err) {
      logger.error(`[MatrixApplicationService] 注册失败: ${err}`)
      throw err
    }
  }

  async list(): Promise<RegisteredApplicationService[]> {
    try {
      const admin = this.resolveAdminManager()
      if (admin) {
        const result = await admin.listApplicationServices()
        return Array.isArray(result?.services) ? (result.services as RegisteredApplicationService[]) : []
      }
      const response = (await this.getClient().http.authedRequest('GET', MATRIX_PATHS.ADMIN.APPSERVICES)) as {
        services?: unknown
      }
      return Array.isArray(response.services) ? (response.services as RegisteredApplicationService[]) : []
    } catch (err) {
      logger.error(`[MatrixApplicationService] 获取列表失败: ${err}`)
      throw err
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    try {
      const admin = this.resolveAdminManager()
      if (admin) {
        await admin.updateApplicationService(id, { enabled })
        logger.info(`[MatrixApplicationService] 设置启用状态成功 (SDK): ${id} -> ${enabled}`)
        return
      }
      await this.getClient().http.authedRequest('PUT', MATRIX_PATHS.ADMIN.APPSERVICE_BY_ID(id), undefined, {
        enabled
      })
      logger.info(`[MatrixApplicationService] 设置启用状态成功 (REST): ${id} -> ${enabled}`)
    } catch (err) {
      logger.error(`[MatrixApplicationService] 设置启用状态失败: ${err}`)
      throw err
    }
  }

  async getUsersNamespace(id: string): Promise<ApplicationServiceNamespace[]> {
    return this.getNamespace(id, 'users')
  }

  async getRoomsNamespace(id: string): Promise<ApplicationServiceNamespace[]> {
    return this.getNamespace(id, 'rooms')
  }

  private async getNamespace(id: string, key: 'users' | 'rooms'): Promise<ApplicationServiceNamespace[]> {
    try {
      const admin = this.resolveAdminManager()
      if (admin) {
        const service = await admin.getApplicationService(id)
        const value = (service as { namespaces?: { users?: unknown; rooms?: unknown } } | null)?.namespaces?.[key]
        return Array.isArray(value) ? (value as ApplicationServiceNamespace[]) : []
      }
      const response = (await this.getClient().http.authedRequest('GET', MATRIX_PATHS.ADMIN.APPSERVICE_BY_ID(id))) as {
        namespaces?: {
          users?: unknown
          rooms?: unknown
        }
      }
      const value = response.namespaces?.[key]
      return Array.isArray(value) ? (value as ApplicationServiceNamespace[]) : []
    } catch (err) {
      logger.error(`[MatrixApplicationService] 获取 namespace 失败: ${err}`)
      throw err
    }
  }
}

export const matrixApplicationService = new MatrixApplicationService()
export default matrixApplicationService
