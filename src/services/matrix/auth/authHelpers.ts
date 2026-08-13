import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { useI18nGlobal } from '@/services/i18n'
import { getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'
import { createClient } from '@/services/matrix/sdk'
import { matrixClientService } from '../MatrixClientService'
import { PREFIX_V3 } from '../paths'
import { formatMatrixErrorDetail, logger, normalizeSdkMatrixError } from './authErrors'

export interface MatrixLoginResult {
  user_id: string
  access_token: string
  device_id: string
  home_server?: string
  refresh_token?: string
  expires_in?: number
}

export interface MatrixRegisterResult {
  user_id: string
  access_token?: string
  device_id?: string
  refresh_token?: string
  expires_in?: number
}

export interface MatrixEmailTokenResult {
  sid: string
  submit_url?: string
  expires_in?: number
}

export interface MatrixRequestedEmailTokenResult extends MatrixEmailTokenResult {
  client_secret: string
}

export interface MatrixCaptchaResult {
  session: string
  api_path: string
  mxc_url: string
}

export type MatrixAuthPayload = Record<string, unknown>
export type MatrixEmailTokenPurpose = 'register' | 'password_reset'

/** 构建注册认证参数
 */
export function buildRegisterAuth(
  session?: string,
  authType?: string,
  authToken?: string,
  clientSecret?: string
): MatrixAuthPayload | undefined {
  if (session && authType === 'm.login.email.identity') {
    return {
      type: authType,
      threepid_creds: {
        sid: session,
        client_secret: clientSecret || authToken
      }
    }
  }

  if (session && authType) {
    return {
      session,
      type: authType,
      token: authToken
    }
  }

  // 无 session 的单步注册：synapse-rust 要求 auth 字段标识注册流程类型，
  // 否则返回 401 要求完成 auth flow。发送 { type: 'm.login.dummy' } 即可单步注册。
  return { type: 'm.login.dummy' }
}

/** 构建重置密码认证参数
 */
export function buildResetPasswordAuth(
  authSession?: string,
  authType?: string,
  authToken?: string,
  clientSecret?: string
): MatrixAuthPayload | undefined {
  if (authSession && authType === 'm.login.email.identity') {
    return {
      type: authType,
      threepid_creds: {
        sid: authSession,
        client_secret: clientSecret || authToken
      }
    }
  }

  if (authSession && authType) {
    return {
      session: authSession,
      type: authType,
      token: authToken
    }
  }

  return undefined
}

/** 使用客户端密钥执行操作
 */
export function withClientSecret(
  result: MatrixEmailTokenResult,
  clientSecret: string
): MatrixRequestedEmailTokenResult {
  return {
    ...result,
    client_secret: clientSecret
  }
}

/** 生成客户端密钥
 */
export function generateClientSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(43)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(array[i] % chars.length)
  }
  return result
}

/** 解析 Matrix 客户端 URL
 */
export function resolveMatrixClientUrl(path: string): string {
  const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
  const normalizedHomeserverUrl = homeserverUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedHomeserverUrl}${normalizedPath}`
}

/** 创建临时 Matrix 客户端
 */
export function createTemporaryMatrixClient() {
  const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
  return createClient({
    baseUrl: homeserverUrl,
    allowInsecureHttp: homeserverUrl.startsWith('http://'),
    fetchFn: getRuntimeAwareFetchFn()
  })
}

/**
 * 优先尝试 SDK 路径，仅在 SDK 抛出非 Matrix 标准错误（无 errcode）时回退到 HTTP。
 * Matrix 标准错误（带 errcode）是用户可操作的错误，直接抛出而不回退。
 */
export async function runSdkFirst<T>(
  sdkRequest: () => Promise<T>,
  fallbackRequest: () => Promise<T>,
  failureLabel: string
): Promise<T> {
  try {
    return await sdkRequest()
  } catch (error) {
    const errcode = (error as { errcode?: string })?.errcode
    if (errcode) {
      throw normalizeSdkMatrixError(error, failureLabel)
    }

    const errInfo = error instanceof Error ? error.message : String(error)
    const httpStatus = (error as { httpStatus?: number })?.httpStatus
    logger.warn(`SDK 请求失败 (status=${httpStatus}, errcode=${errcode}): ${errInfo}，尝试 HTTP 回退`)
    try {
      return await fallbackRequest()
    } catch (fallbackError) {
      throw normalizeSdkMatrixError(fallbackError, failureLabel)
    }
  }
}

/** 发送 Matrix JSON 请求
 */
export async function postMatrixJson<T>(path: string, body: Record<string, unknown>, failureLabel: string): Promise<T> {
  const url = resolveMatrixClientUrl(path)
  let response: Response

  try {
    response = await getRuntimeAwareFetch()(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch (error) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : ''
    throw new Error(`${failureLabel}: 无法连接 Matrix homeserver (${url})，请检查网络、服务地址或 CORS 配置${detail}`)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`${failureLabel} (${response.status}): ${formatMatrixErrorDetail(text)}`)
  }

  const text = await response.text()
  if (!text) {
    return {} as T
  }

  return JSON.parse(text) as T
}

/** Matrix 密码登录
 */
export async function matrixLogin(
  username: string,
  password: string,
  deviceId?: string,
  deviceName?: string
): Promise<MatrixLoginResult> {
  if (matrixClientService.getClient()) {
    const result = await matrixClientService.login(username, password, deviceName)
    if (!result.success || !result.userId || !result.accessToken) {
      throw new Error(result.error || 'Matrix 登录失败')
    }

    return {
      user_id: result.userId,
      access_token: result.accessToken,
      device_id: result.deviceId || deviceId || ''
    }
  }

  return postMatrixJson<MatrixLoginResult>(
    `${PREFIX_V3}/login`,
    {
      type: 'm.login.password',
      user: username,
      password,
      device_id: deviceId,
      initial_display_name: deviceName
    },
    '登录失败'
  )
}

/** Matrix 注册
 */
export async function matrixRegister(
  username: string,
  password: string,
  session?: string,
  authType?: string,
  authToken?: string,
  clientSecret?: string
): Promise<MatrixRegisterResult> {
  const auth = buildRegisterAuth(session, authType, authToken, clientSecret)

  return postMatrixJson<MatrixRegisterResult>(
    `${PREFIX_V3}/register`,
    {
      type: 'm.login.dummy',
      session,
      username,
      password,
      initial_device_display_name: 'Tjg Desktop',
      auth
    },
    '注册失败'
  )
}

/** 请求邮箱验证令牌
 */
export async function matrixRequestEmailToken(
  email: string,
  clientSecret: string,
  sendAttempt: number
): Promise<MatrixEmailTokenResult> {
  return postMatrixJson<MatrixEmailTokenResult>(
    `${PREFIX_V3}/register/email/requestToken`,
    {
      email,
      client_secret: clientSecret,
      send_attempt: sendAttempt
    },
    '请求邮箱令牌失败'
  )
}

/** 请求密码重置邮箱令牌
 */
export async function matrixRequestPasswordEmailToken(
  email: string,
  clientSecret: string,
  sendAttempt: number
): Promise<MatrixEmailTokenResult> {
  return postMatrixJson<MatrixEmailTokenResult>(
    `${PREFIX_V3}/account/password/email/requestToken`,
    {
      email,
      client_secret: clientSecret,
      send_attempt: sendAttempt
    },
    '请求找回密码邮箱令牌失败'
  )
}

/** 解析邮箱令牌提交路径
 */
export function resolveSubmitEmailTokenPath(purpose: MatrixEmailTokenPurpose): string {
  return purpose === 'password_reset'
    ? `${PREFIX_V3}/account/password/email/submitToken`
    : `${PREFIX_V3}/register/email/submitToken`
}

/** 提交邮箱验证令牌
 */
export async function matrixSubmitEmailToken(
  token: string,
  clientSecret: string,
  sid: string,
  purpose: MatrixEmailTokenPurpose = 'register'
): Promise<Record<string, unknown>> {
  return postMatrixJson(
    resolveSubmitEmailTokenPath(purpose),
    {
      token,
      client_secret: clientSecret,
      sid
    },
    '提交邮箱令牌失败'
  )
}

/** 获取 Matrix 验证码
 */
export async function matrixGetCaptcha(options?: {
  session?: string
  captchaType?: string
  length?: number
}): Promise<MatrixCaptchaResult> {
  const resolvedSession = options?.session
  const captchaType = options?.captchaType || 'sms'
  const length = options?.length || 4

  if (resolvedSession) {
    return postMatrixJson<MatrixCaptchaResult>(
      `${PREFIX_V3}/register/captcha/send`,
      { captcha_type: captchaType, length, session: resolvedSession },
      '获取验证码失败'
    )
  }

  try {
    const initResult = await postMatrixJson<{
      session?: string
      flows?: Array<{ type: string; stages?: string[] }>
    }>(`${PREFIX_V3}/register`, { type: 'm.login.dummy' }, '获取注册会话失败')
    const session = initResult.session
    if (!session) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.register_no_valid_session'))
    }
    return postMatrixJson<MatrixCaptchaResult>(
      `${PREFIX_V3}/register/captcha/send`,
      { captcha_type: captchaType, length, session },
      '获取验证码失败'
    )
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('422') || errMsg.includes('M_UNKNOWN')) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.verification_service_unavailable'))
    }
    throw err
  }
}

/** 重置 Matrix 密码
 */
export async function matrixResetPassword(
  newPassword: string,
  authSession?: string,
  authType?: string,
  authToken?: string,
  clientSecret?: string
): Promise<Record<string, unknown>> {
  const auth = buildResetPasswordAuth(authSession, authType, authToken, clientSecret)

  return postMatrixJson(
    `${PREFIX_V3}/account/password`,
    {
      new_password: newPassword,
      auth
    },
    '重置密码失败'
  )
}
