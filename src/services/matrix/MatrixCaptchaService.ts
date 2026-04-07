/**
 * Captcha 验证服务
 * 图形验证码功能
 */
import { matrixClientService } from './MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Captcha')

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

class MatrixCaptchaService {
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
      const response = (await this.client.http.authedRequest({}, 'GET', '/_matrix/client/v1/captcha', undefined)) as any

      return {
        captchaId: response.captcha_id,
        type: response.type || 'image',
        data: response.data,
        expiresAt: Date.now() + (response.expires_in || 300) * 1000
      }
    } catch (error) {
      logger.error('获取验证码失败:', error)
      return null
    }
  }

  /**
   * 发送验证码到邮箱/手机
   */
  async sendCaptcha(destination: string, type: 'email' | 'phone'): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v1/captcha/send', undefined, {
        body: JSON.stringify({ destination, type })
      })
      return true
    } catch (error) {
      logger.error('发送验证码失败:', error)
      return false
    }
  }

  /**
   * 验证验证码
   */
  async verify(params: VerifyCaptchaParams): Promise<boolean> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'POST',
        '/_matrix/client/v1/captcha/verify',
        undefined,
        {
          body: JSON.stringify(params)
        }
      )) as any

      return response.valid || false
    } catch (error) {
      logger.error('验证失败:', error)
      return false
    }
  }

  /**
   * 使验证码失效
   */
  async invalidate(captchaId: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'DELETE', `/_matrix/client/v1/captcha/${captchaId}`, undefined)
      return true
    } catch (error) {
      logger.error('使失效失败:', error)
      return false
    }
  }

  /**
   * 检查是否需要验证码
   */
  async isRequired(): Promise<boolean> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/captcha/required',
        undefined
      )) as any
      return response.required || false
    } catch {
      return false
    }
  }
}

export const matrixCaptchaService = new MatrixCaptchaService()
