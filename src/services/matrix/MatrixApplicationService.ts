/**
 * 应用服务 (Application Service)
 * 第三方应用服务集成
 */
import { matrixClientService } from './MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ApplicationService')

export interface ApplicationService {
  id: string
  url: string
  asToken: string
  sender: string
  namespacedUsers: string[]
  enabled: boolean
}

export interface AsRegistration {
  url: string
  as_token: string
  sender: string
  namespaces?: {
    users?: { exclusive: boolean; pattern: string }[]
    rooms?: { exclusive: boolean; pattern: string }[]
    aliases?: { exclusive: boolean; pattern: string }[]
  }
  protocols?: string[]
  rate_limited?: boolean
}

class MatrixApplicationService {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 注册应用服务
   */
  async register(asInfo: AsRegistration): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v3/applicationservice/register', undefined, {
        body: JSON.stringify(asInfo)
      })
      return true
    } catch (error) {
      logger.error('注册失败:', error)
      return false
    }
  }

  /**
   * 获取应用服务列表
   */
  async list(): Promise<ApplicationService[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v3/applicationservice/services',
        undefined
      )) as any
      return response.services || []
    } catch (error) {
      logger.error('获取列表失败:', error)
      return []
    }
  }

  /**
   * 禁用/启用应用服务
   */
  async setEnabled(serviceId: string, enabled: boolean): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'PUT',
        `/_matrix/client/v3/applicationservice/services/${serviceId}/enabled`,
        undefined,
        { body: JSON.stringify({ enabled }) }
      )
      return true
    } catch (error) {
      logger.error('设置启用状态失败:', error)
      return false
    }
  }

  /**
   * 获取应用服务用户命名空间
   */
  async getUsersNamespace(serviceId: string): Promise<{ exclusive: boolean; pattern: string }[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v3/applicationservice/services/${serviceId}/users`,
        undefined
      )) as any
      return response.namespaces?.users || []
    } catch {
      return []
    }
  }

  /**
   * 获取应用服务房间命名空间
   */
  async getRoomsNamespace(serviceId: string): Promise<{ exclusive: boolean; pattern: string }[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v3/applicationservice/services/${serviceId}/rooms`,
        undefined
      )) as any
      return response.namespaces?.rooms || []
    } catch {
      return []
    }
  }
}

export const matrixApplicationService = new MatrixApplicationService()
