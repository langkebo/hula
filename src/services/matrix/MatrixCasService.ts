/**
 * CAS (Central Authentication Service) 单点登录
 * 企业 SSO 集成
 */
import { matrixClientService } from './MatrixClientService'

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

class MatrixCasService {
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
      const response = (await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v1/cas/services', undefined, {
        body: JSON.stringify(service)
      })) as any

      return {
        serviceId: response.service_id,
        name: response.name,
        url: response.url,
        enabled: true
      }
    } catch (error) {
      console.error('[CAS] 注册服务失败:', error)
      return null
    }
  }

  /**
   * 获取服务列表
   */
  async listServices(): Promise<CasService[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/cas/services',
        undefined
      )) as any

      return (response.services || []).map((s: any) => ({
        serviceId: s.service_id,
        name: s.name,
        url: s.url,
        enabled: s.enabled
      }))
    } catch (error) {
      console.error('[CAS] 获取服务列表失败:', error)
      return []
    }
  }

  /**
   * 删除 CAS 服务
   */
  async deleteService(serviceId: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'DELETE', `//_matrix/client/v1/cas/services/${serviceId}`, undefined)
      return true
    } catch (error) {
      console.error('[CAS] 删除服务失败:', error)
      return false
    }
  }

  /**
   * 验证 CAS 票据
   */
  async validateTicket(ticket: string, service: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const response = (await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v1/cas/validate', undefined, {
        body: JSON.stringify({ ticket, service })
      })) as any

      return { valid: response.valid, userId: response.user_id }
    } catch (error) {
      console.error('[CAS] 验证票据失败:', error)
      return { valid: false }
    }
  }

  /**
   * 创建服务票据
   */
  async createServiceTicket(serviceUrl: string): Promise<CasTicket | null> {
    try {
      const response = (await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v1/cas/tickets', undefined, {
        body: JSON.stringify({ service: serviceUrl })
      })) as any

      return {
        ticket: response.ticket,
        service: serviceUrl,
        expiresAt: response.expires_at
      }
    } catch (error) {
      console.error('[CAS] 创建票据失败:', error)
      return null
    }
  }

  /**
   * 获取用户属性
   */
  async getUserAttributes(userId: string): Promise<Record<string, string>> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `//_matrix/client/v1/cas/users/${userId}/attributes`,
        undefined
      )) as any

      return response.attributes || {}
    } catch (error) {
      console.error('[CAS] 获取用户属性失败:', error)
      return {}
    }
  }
}

export const matrixCasService = new MatrixCasService()
