import { createLogger } from '@/utils/Logger'
import { PREFIX_V3 } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseCaptchaService')

/**
 * synapse-rust 注册验证码扩展。
 * 从 SynapseRustExtensionsService 拆分而来。
 */
class SynapseCaptchaService extends SynapseExtensionHttpBase {
  async sendCaptcha(mobile: string, captchaType: string): Promise<{ success: boolean; captchaId?: string }> {
    try {
      const response = await this.request<
        { captcha_id: string; expires_in: number } | { data?: { captcha_id: string; expires_in: number } }
      >(`${PREFIX_V3}/register/captcha/send`, {
        method: 'POST',
        body: JSON.stringify({ target: mobile, captcha_type: captchaType })
      })
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 发送验证码成功: ${mobile}`)
      return {
        success: !!data?.captcha_id,
        captchaId: data?.captcha_id
      }
    } catch (err) {
      logger.error(`[SynapseRust] 发送验证码失败: ${err}`)
      throw err
    }
  }

  async verifyCaptcha(captchaId: string, code: string): Promise<boolean> {
    try {
      const response = await this.request<{ verified: boolean } | { data?: { verified: boolean } }>(
        `${PREFIX_V3}/register/captcha/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ captcha_id: captchaId, code })
        }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 验证码校验成功: ${captchaId}`)
      return data?.verified ?? false
    } catch (err) {
      logger.error(`[SynapseRust] 验证码校验失败: ${err}`)
      return false
    }
  }

  async getCaptchaStatus(captchaId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown> | { data?: Record<string, unknown> }>(
        `${PREFIX_V3}/register/captcha/status?captcha_id=${encodeURIComponent(captchaId)}`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取验证码状态成功: ${captchaId}`)
      return data || {}
    } catch (err) {
      logger.error(`[SynapseRust] 获取验证码状态失败: ${err}`)
      return {}
    }
  }
}

export const synapseCaptchaService = new SynapseCaptchaService()
