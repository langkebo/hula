import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { PREFIX_V3 } from '../paths'
import { normalizeSdkMatrixError } from './authErrors'
import { createTemporaryMatrixClient, type MatrixCaptchaResult, matrixGetCaptcha, postMatrixJson } from './authHelpers'

/** 获取验证码
 */
export async function getCaptcha(options?: {
  session?: string
  captchaType?: string
  length?: number
}): Promise<MatrixCaptchaResult> {
  return matrixGetCaptcha(options)
}

/** 启动注册验证码会话
 */
export async function startRegistrationSession(): Promise<{
  session: string
  flows: Array<{ type: string; stages?: string[] }>
}> {
  try {
    const result = await createTemporaryMatrixClient().registerRequest({})
    const r = result as unknown as {
      session?: string
      flows?: Array<{ type: string; stages?: string[] }>
    }
    if (!r.session) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.register_no_session'))
    }
    return { session: r.session, flows: r.flows ?? [] }
  } catch (err) {
    const matrixErr = err as {
      errcode?: string
      session?: string
      flows?: Array<{ type: string; stages?: string[] }>
    }
    if (matrixErr.session && matrixErr.flows) {
      return { session: matrixErr.session, flows: matrixErr.flows }
    }
    throw normalizeSdkMatrixError(err, '启动注册会话失败')
  }
}

/** 验证验证码
 */
export async function verifyCaptcha(session: string, response: string): Promise<{ success: boolean }> {
  return postMatrixJson<{ success: boolean }>(
    `${PREFIX_V3}/register/captcha/verify`,
    { session, response },
    '验证验证码失败'
  )
}

/** 获取验证码状态
 */
export async function getCaptchaStatus(session: string): Promise<{ verified: boolean }> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }
  try {
    const result = await authedRequestWithPath<{ verified: boolean }>(client, 'GET', '/register/captcha/status', {
      session
    })
    return result
  } catch (_err) {
    throw new Error(useI18nGlobal().t('matrix_error.auth.query_code_status_failed'))
  }
}

/** 清理过期的验证码会话
 */
export async function cleanupExpiredCaptchas(): Promise<{ cleaned: number }> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    const result = await authedRequestWithPath<{ cleaned?: number }>(
      client,
      'DELETE',
      '/register/captcha/clean',
      undefined,
      {}
    )
    return { cleaned: result.cleaned ?? 0 }
  } catch (err) {
    throw normalizeSdkMatrixError(err, '清理过期验证码失败')
  }
}
