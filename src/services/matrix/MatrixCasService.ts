/**
 * CAS (Central Authentication Service) 单点登录
 * 企业 SSO 集成
 */
import type {
  CasServiceResponse,
  CasServiceListResponse,
  CasValidateResponse,
  CasTicketResponse,
  CasUserAttributesResponse
} from '@/types/matrix-api'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
export interface CasService {
  serviceId: string
  name: string
  url: string
  enabled: boolean
}

export interface CasTicket {
  ticket: string
  service: string
  expiresAt: number
}

class MatrixCasService extends BaseManager {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 注册 CAS 服务
   */
  async registerService(service: { name: string; url: string }): Promise<CasService | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/cas/services',
        undefined,
        JSON.stringify(service),
        { prefix: '' }
      )) as CasServiceResponse

      return {
        serviceId: response.service_id,
        name: response.name,
        url: response.url,
        enabled: true
      }
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取服务列表
   */
  async listServices(): Promise<CasService[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/cas/services',
        undefined,
        undefined,
        { prefix: '' }
      )) as CasServiceListResponse

      return (response.services || []).map((s) => ({
        serviceId: s.service_id,
        name: s.name,
        url: s.url,
        enabled: s.enabled
      }))
    } catch (_error) {
      return []
    }
  }

  /**
   * 删除 CAS 服务
   */
  async deleteService(serviceId: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'DELETE',
        `/_matrix/client/v1/cas/services/${serviceId}`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 验证 CAS 票据
   */
  async validateTicket(ticket: string, service: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/cas/validate',
        undefined,
        JSON.stringify({ ticket, service }),
        { prefix: '' }
      )) as CasValidateResponse

      return { valid: response.valid, userId: response.user_id }
    } catch (_error) {
      return { valid: false }
    }
  }

  /**
   * 创建服务票据
   */
  async createServiceTicket(serviceUrl: string): Promise<CasTicket | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/cas/tickets',
        undefined,
        JSON.stringify({ service: serviceUrl }),
        { prefix: '' }
      )) as CasTicketResponse
      return {
        ticket: response.ticket,
        service: serviceUrl,
        expiresAt: response.expires_at
      }
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取用户属性
   */
  async getUserAttributes(userId: string): Promise<Record<string, string>> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/cas/users/${userId}/attributes`,
        undefined,
        undefined,
        { prefix: '' }
      )) as CasUserAttributesResponse
      return response.attributes || {}
    } catch (_error) {
      return {}
    }
  }
}
export const matrixCasService = new MatrixCasService()
