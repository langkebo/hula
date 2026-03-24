/**
 * 注册令牌服务
 * 管理和使用注册邀请令牌
 */
import { matrixClientService } from './MatrixClientService'

export interface RegistrationToken {
  token: string
  uses_allowed: number
  uses_redeemed: number
  expires_at?: number
  pending: number
}

export interface GenerateTokenParams {
  uses_allowed: number
  expires_at?: number
  duration?: number
}

class MatrixRegistrationTokenService {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 生成注册令牌
   */
  async generate(params: GenerateTokenParams): Promise<RegistrationToken | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'POST',
        '/_matrix/client/v1/admin/registration_tokens',
        undefined,
        { body: JSON.stringify(params) }
      )) as any
      return this.mapToken(response)
    } catch (error) {
      console.error('[RegistrationToken] 生成失败:', error)
      return null
    }
  }

  /**
   * 获取令牌详情
   */
  async get(token: string): Promise<RegistrationToken | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v1/admin/registration_tokens/${encodeURIComponent(token)}`,
        undefined
      )) as any
      return this.mapToken(response)
    } catch (error) {
      console.error('[RegistrationToken] 获取失败:', error)
      return null
    }
  }

  /**
   * 获取所有令牌
   */
  async list(): Promise<RegistrationToken[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/admin/registration_tokens',
        undefined
      )) as any
      return (response.tokens || []).map(this.mapToken)
    } catch (error) {
      console.error('[RegistrationToken] 列表失败:', error)
      return []
    }
  }

  /**
   * 删除令牌
   */
  async delete(token: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'DELETE',
        `/_matrix/client/v1/admin/registration_tokens/${encodeURIComponent(token)}`,
        undefined
      )
      return true
    } catch (error) {
      console.error('[RegistrationToken] 删除失败:', error)
      return false
    }
  }

  /**
   * 使用令牌注册
   */
  async register(
    username: string,
    password: string,
    token: string
  ): Promise<{ user_id: string; access_token: string } | null> {
    try {
      const response = (await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v1/register', undefined, {
        body: JSON.stringify({
          auth: { type: 'm.login.registration_token', token },
          username,
          password
        })
      })) as any

      return {
        user_id: response.user_id,
        access_token: response.access_token
      }
    } catch (error) {
      console.error('[RegistrationToken] 注册失败:', error)
      return null
    }
  }

  private mapToken(data: any): RegistrationToken {
    return {
      token: data.token,
      uses_allowed: data.uses_allowed,
      uses_redeemed: data.uses_redeemed,
      expires_at: data.expires_at,
      pending: data.pending || 0
    }
  }
}

export const matrixRegistrationTokenService = new MatrixRegistrationTokenService()
