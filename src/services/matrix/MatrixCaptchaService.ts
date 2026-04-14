/**
 * Captcha 验证服务
 * 图形验证码功能
 */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import type { CaptchaResponse, CaptchaVerifyResponse, CaptchaRequiredResponse } from '@/types/matrix-api'
export interface Captcha {
  captchaId: string
  type: 'image' | 'audio'
  data: string
  expiresAt: number
}

export interface VerifyCaptchaParams {
  captchaId: string
  solution: string
}

class MatrixCaptchaService extends BaseManager {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 获取新的验证码
   */
  async getCaptcha(): Promise<Captcha | null> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/captcha',
        undefined,
        undefined,
        { prefix: '' }
      )) as CaptchaResponse

      return {
        captchaId: response.captcha_id,
        type: response.type || 'image',
        data: response.data,
        expiresAt: Date.now() + (response.expires_in || 300) * 1000
      }
    } catch (_error) {
      return null
    }
  }

  /**
   * 发送验证码到邮箱/手机
   */
  async sendCaptcha(destination: string, type: 'email' | 'phone'): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/captcha/send',
        undefined,
        JSON.stringify({ destination, type }),
        { prefix: '' }
      )
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 验证验证码
   */
  async verify(params: VerifyCaptchaParams): Promise<boolean> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/captcha/verify',
        undefined,
        JSON.stringify(params),
        { prefix: '' }
      )) as CaptchaVerifyResponse

      return response.valid || false
    } catch (_error) {
      return false
    }
  }

  /**
   * 使验证码失效
   */
  async invalidate(captchaId: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest('DELETE', `/_matrix/client/v1/captcha/${captchaId}`, undefined, undefined, {
        prefix: ''
      })
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * 检查是否需要验证码
   */
  async isRequired(): Promise<boolean> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/captcha/required',
        undefined,
        undefined,
        { prefix: '' }
      )) as CaptchaRequiredResponse
      return response.required || false
    } catch {
      return false
    }
  }
}

export const matrixCaptchaService = new MatrixCaptchaService()
