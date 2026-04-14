/**
 * 应用服务 (Application Service)
 * 第三方应用服务集成
 */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import type { ApplicationServiceListResponse, ApplicationServiceNamespaceResponse } from '@/types/matrix-api'
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

class MatrixApplicationService extends BaseManager {
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
      await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v3/applicationservice/register',
        undefined,
        JSON.stringify(asInfo),
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 获取应用服务列表
   */
  async list(): Promise<ApplicationService[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v3/applicationservice/services',
        undefined,
        undefined,
        { prefix: '' }
      )) as ApplicationServiceListResponse
      return response.services || []
    } catch (_error) {
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
    } catch (_error) {
      return false
    }
  }

  /**
   * 获取应用服务用户命名空间
   */
  async getUsersNamespace(serviceId: string): Promise<{ exclusive: boolean; pattern: string }[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/applicationservice/services/${serviceId}/users`,
        undefined,
        undefined,
        { prefix: '' }
      )) as ApplicationServiceNamespaceResponse
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
        'GET',
        `/_matrix/client/v3/applicationservice/services/${serviceId}/rooms`,
        undefined,
        undefined,
        { prefix: '' }
      )) as ApplicationServiceNamespaceResponse
      return response.namespaces?.rooms || []
    } catch {
      return []
    }
  }
}

export const matrixApplicationService = new MatrixApplicationService()
