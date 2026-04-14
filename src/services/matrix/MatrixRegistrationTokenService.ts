/**
 * 注册令牌服务
 * 管理和使用注册邀请令牌
 */
import type { RegistrationTokenResponse, RegistrationTokenListResponse, RegistrationResponse } from '@/types/matrix-api'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
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

class MatrixRegistrationTokenService extends BaseManager {
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
        'POST',
        '/_matrix/client/v1/admin/registration_tokens',
        undefined,
        JSON.stringify(params),
        { prefix: '' }
      )) as RegistrationTokenResponse
      return this.mapToken(response)
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取令牌详情
   */
  async get(token: string): Promise<RegistrationToken | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/admin/registration_tokens/${encodeURIComponent(token)}`,
        undefined,
        undefined,
        { prefix: '' }
      )) as RegistrationTokenResponse
      return this.mapToken(response)
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取所有令牌
   */
  async list(): Promise<RegistrationToken[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/admin/registration_tokens',
        undefined,
        undefined,
        { prefix: '' }
      )) as RegistrationTokenListResponse
      return (response.tokens || []).map(this.mapToken)
    } catch (_error) {
      return []
    }
  }

  /**
   * 删除令牌
   */
  async delete(token: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'DELETE',
        `/_matrix/client/v1/admin/registration_tokens/${encodeURIComponent(token)}`,
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
   * 使用令牌注册
   */
  async register(
    username: string,
    password: string,
    token: string
  ): Promise<{ user_id: string; access_token: string } | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/register',
        undefined,
        JSON.stringify({
          auth: { type: 'm.login.registration_token', token },
          username,
          password
        }),
        { prefix: '' }
      )) as RegistrationResponse

      return {
        user_id: response.user_id,
        access_token: response.access_token
      }
    } catch (_error) {
      return null
    }
  }

  private mapToken(data: RegistrationTokenResponse): RegistrationToken {
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
