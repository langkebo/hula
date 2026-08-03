import * as sdk from 'matrix-js-sdk'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { MATRIX_PATHS, PREFIX_V3 } from '../paths'

const logger = createLogger('MatrixAuth')

interface MatrixLoginResult {
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

interface MatrixEmailTokenResult {
  sid: string
  submit_url?: string
  expires_in?: number
}

export interface MatrixRequestedEmailTokenResult extends MatrixEmailTokenResult {
  client_secret: string
}

interface MatrixCaptchaResult {
  session: string
  api_path: string
  mxc_url: string
}

type MatrixAuthPayload = Record<string, unknown>
type MatrixEmailTokenPurpose = 'register' | 'password_reset'

function buildRegisterAuth(
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

  return undefined
}

function buildResetPasswordAuth(
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

function withClientSecret(result: MatrixEmailTokenResult, clientSecret: string): MatrixRequestedEmailTokenResult {
  return {
    ...result,
    client_secret: clientSecret
  }
}

function generateClientSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(43)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(array[i] % chars.length)
  }
  return result
}

function resolveMatrixClientUrl(path: string): string {
  const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
  const normalizedHomeserverUrl = homeserverUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedHomeserverUrl}${normalizedPath}`
}

function createTemporaryMatrixClient() {
  const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
  return sdk.createClient({
    baseUrl: homeserverUrl,
    allowInsecureHttp: homeserverUrl.startsWith('http://'),
    fetchFn: getRuntimeAwareFetchFn()
  })
}

function getMatrixErrorHint(errcode: string): string {
  switch (errcode) {
    case 'M_FORBIDDEN':
      return '认证信息无效或当前操作无权限'
    case 'M_USER_IN_USE':
      return '用户名已被占用'
    case 'M_INVALID_USERNAME':
      return '用户名格式无效'
    case 'M_THREEPID_IN_USE':
      return '邮箱已被使用'
    case 'M_THREEPID_NOT_FOUND':
      return '邮箱未绑定账号'
    case 'M_MISSING_PARAM':
      return '请求缺少必要参数'
    case 'M_INVALID_PARAM':
      return '请求参数无效'
    case 'M_INVALID_EMAIL':
      return '邮箱格式无效'
    case 'M_BAD_JSON':
      return '请求体格式无效'
    case 'M_LIMIT_EXCEEDED':
      return '请求过于频繁，请稍后重试'
    case 'M_SESSION_NOT_FOUND':
      return '验证会话不存在或已失效'
    case 'M_TOKEN_EXPIRED':
      return '验证码已过期'
    case 'M_TOKEN_ALREADY_USED':
      return '验证码已被使用'
    default:
      return ''
  }
}

function formatMatrixErrorDetail(text: string): string {
  if (!text) {
    return ''
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: unknown
      errcode?: unknown
    }
    const errorMessage = typeof parsed.error === 'string' ? parsed.error : ''
    const errorCode = typeof parsed.errcode === 'string' ? parsed.errcode : ''
    const errorHint = errorCode ? getMatrixErrorHint(errorCode) : ''

    if (errorMessage && errorCode && errorHint) {
      return `${errorMessage} [${errorCode}] (${errorHint})`
    }
    if (errorMessage && errorCode) {
      return `${errorMessage} [${errorCode}]`
    }
    if (errorMessage) {
      return errorMessage
    }
    if (errorCode && errorHint) {
      return `[${errorCode}] (${errorHint})`
    }
    if (errorCode) {
      return `[${errorCode}]`
    }
  } catch {
    // Fall back to the raw response body when the homeserver does not return Matrix JSON.
  }

  return text
}

function normalizeSdkMatrixError(error: unknown, failureLabel: string): Error {
  if (!(error instanceof Error)) {
    return new Error(failureLabel)
  }

  const matrixError = error as Error & {
    errcode?: unknown
    error?: unknown
    httpStatus?: unknown
  }

  const errorCode = typeof matrixError.errcode === 'string' ? matrixError.errcode : ''
  const errorMessage = typeof matrixError.error === 'string' ? matrixError.error : error.message
  const status = typeof matrixError.httpStatus === 'number' ? matrixError.httpStatus : undefined
  const detail = formatMatrixErrorDetail(
    JSON.stringify({
      errcode: errorCode || undefined,
      error: errorMessage || undefined
    })
  )

  if (status) {
    return new Error(`${failureLabel} (${status}): ${detail}`)
  }

  return new Error(`${failureLabel}: ${detail}`)
}

async function runSdkFirst<T>(
  sdkRequest: () => Promise<T>,
  fallbackRequest: () => Promise<T>,
  failureLabel: string
): Promise<T> {
  try {
    return await sdkRequest()
  } catch (error) {
    // Matrix 标准错误（带 errcode）是用户可操作的错误，直接抛出而不回退
    const errcode = (error as { errcode?: string })?.errcode
    if (errcode) {
      throw normalizeSdkMatrixError(error, failureLabel)
    }

    // 登录/注册场景 SDK 内部错误时尝试 fallback
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

async function postMatrixJson<T>(path: string, body: Record<string, unknown>, failureLabel: string): Promise<T> {
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

async function matrixLogin(
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

async function matrixRegister(
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
      initial_device_display_name: 'HuLa Desktop',
      auth
    },
    '注册失败'
  )
}

async function matrixRequestEmailToken(
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

async function matrixRequestPasswordEmailToken(
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

function resolveSubmitEmailTokenPath(purpose: MatrixEmailTokenPurpose): string {
  return purpose === 'password_reset'
    ? `${PREFIX_V3}/account/password/email/submitToken`
    : `${PREFIX_V3}/register/email/submitToken`
}

async function matrixSubmitEmailToken(
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

async function matrixGetCaptcha(options?: {
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

async function matrixResetPassword(
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

export class MatrixAuthService {
  private static generateClientSecret(): string {
    return generateClientSecret()
  }

  /**
   * @throws {MatrixError} M_FORBIDDEN — invalid credentials
   * @throws {MatrixError} M_USER_DEACTIVATED — account deactivated
   * @throws {MatrixError} M_LIMIT_EXCEEDED — rate limited, retry after `retry_after_ms`
   */
  static async login(
    username: string,
    password: string,
    deviceId?: string,
    deviceName?: string
  ): Promise<MatrixLoginResult> {
    if (matrixClientService.getClient()) {
      return matrixLogin(username, password, deviceId, deviceName)
    }

    return runSdkFirst(
      () =>
        createTemporaryMatrixClient().loginRequest({
          type: 'm.login.password',
          user: username,
          password,
          device_id: deviceId,
          initial_display_name: deviceName
        }),
      () => matrixLogin(username, password, deviceId, deviceName),
      '登录失败'
    )
  }

  static async register(
    username: string,
    password: string,
    session?: string,
    authType?: string,
    authToken?: string,
    clientSecret?: string
  ): Promise<MatrixRegisterResult> {
    const auth = buildRegisterAuth(session, authType, authToken, clientSecret)
    return runSdkFirst(
      () =>
        createTemporaryMatrixClient().registerRequest({
          type: 'm.login.dummy',
          session,
          username,
          password,
          initial_device_display_name: 'HuLa Desktop',
          auth
        }),
      () => matrixRegister(username, password, session, authType, authToken, clientSecret),
      '注册失败'
    )
  }

  static async requestEmailToken(
    email: string,
    sendAttempt: number = 1,
    clientSecret?: string
  ): Promise<MatrixRequestedEmailTokenResult> {
    const resolvedClientSecret = clientSecret || MatrixAuthService.generateClientSecret()
    return runSdkFirst(
      async () => {
        const result = await createTemporaryMatrixClient().requestRegisterEmailToken(
          email,
          resolvedClientSecret,
          sendAttempt
        )
        return withClientSecret(result, resolvedClientSecret)
      },
      async () => {
        const result = await matrixRequestEmailToken(email, resolvedClientSecret, sendAttempt)
        return withClientSecret(result, resolvedClientSecret)
      },
      '请求邮箱令牌失败'
    )
  }

  static async submitEmailToken(
    token: string,
    clientSecret: string,
    sid: string,
    purpose: MatrixEmailTokenPurpose = 'register'
  ): Promise<Record<string, unknown>> {
    if (purpose === 'password_reset') {
      return matrixSubmitEmailToken(token, clientSecret, sid, purpose)
    }

    return runSdkFirst(
      () => createTemporaryMatrixClient().getAccountManager().submitEmailToken(sid, clientSecret, token),
      () => matrixSubmitEmailToken(token, clientSecret, sid, purpose),
      '提交邮箱令牌失败'
    )
  }

  static async requestPasswordEmailToken(
    email: string,
    sendAttempt: number = 1,
    clientSecret?: string
  ): Promise<MatrixRequestedEmailTokenResult> {
    const resolvedClientSecret = clientSecret || MatrixAuthService.generateClientSecret()
    return runSdkFirst(
      async () => {
        const result = await createTemporaryMatrixClient().requestPasswordEmailToken(
          email,
          resolvedClientSecret,
          sendAttempt
        )
        return withClientSecret(result, resolvedClientSecret)
      },
      async () => {
        const result = await matrixRequestPasswordEmailToken(email, resolvedClientSecret, sendAttempt)
        return withClientSecret(result, resolvedClientSecret)
      },
      '请求找回密码邮箱令牌失败'
    )
  }

  static async getCaptcha(options?: {
    session?: string
    captchaType?: string
    length?: number
  }): Promise<MatrixCaptchaResult> {
    return matrixGetCaptcha(options)
  }

  static async startRegistrationSession(): Promise<{
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

  static async verifyCaptcha(session: string, response: string): Promise<{ success: boolean }> {
    return postMatrixJson<{ success: boolean }>(
      `${PREFIX_V3}/register/captcha/verify`,
      { session, response },
      '验证验证码失败'
    )
  }

  static async getCaptchaStatus(session: string): Promise<{ verified: boolean }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }
    try {
      const result = await client.http.authedRequest('GET', '/register/captcha/status', { session })
      return result as { verified: boolean }
    } catch (_err) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.query_code_status_failed'))
    }
  }

  /**
   * @throws {MatrixError} M_FORBIDDEN — invalid credentials
   * @throws {MatrixError} M_USER_DEACTIVATED — account deactivated
   * @throws {MatrixError} M_LIMIT_EXCEEDED — rate limited, retry after `retry_after_ms`
   */
  static async whoami(): Promise<{ userId: string; deviceId?: string }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const result = await client.http.authedRequest('GET', '/account/whoami')
      const r = result as Record<string, unknown>
      return {
        userId: (r.user_id as string) ?? '',
        deviceId: r.device_id as string | undefined
      }
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取账户信息失败')
    }
  }

  static async cleanupExpiredCaptchas(): Promise<{ cleaned: number }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const result = await client.http.authedRequest('DELETE', '/register/captcha/clean', undefined, {})
      const r = result as Record<string, unknown>
      return { cleaned: (r.cleaned as number) ?? 0 }
    } catch (err) {
      throw normalizeSdkMatrixError(err, '清理过期验证码失败')
    }
  }

  static async forgetPassword(
    email: string,
    sendAttempt: number = 1,
    clientSecret?: string
  ): Promise<MatrixRequestedEmailTokenResult> {
    return MatrixAuthService.requestPasswordEmailToken(email, sendAttempt, clientSecret)
  }

  static async resetPassword(
    newPassword: string,
    authSession?: string,
    authType?: string,
    authToken?: string,
    clientSecret?: string
  ): Promise<Record<string, unknown>> {
    const auth = buildResetPasswordAuth(authSession, authType, authToken, clientSecret)

    if (!auth) {
      return matrixResetPassword(newPassword, authSession, authType, authToken, clientSecret)
    }

    return runSdkFirst(
      () => createTemporaryMatrixClient().setPassword(auth, newPassword),
      () => matrixResetPassword(newPassword, authSession, authType, authToken, clientSecret),
      '重置密码失败'
    )
  }

  static async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const result = await createTemporaryMatrixClient().isUsernameAvailable(username)
      return result.available ?? false
    } catch (err) {
      const matrixErr = err as { errcode?: string }
      if (matrixErr.errcode === 'M_USER_IN_USE') {
        return false
      }
      throw normalizeSdkMatrixError(err, '检查用户名可用性失败')
    }
  }

  static async getLoginFlows(): Promise<Array<{ type: string; [key: string]: unknown }>> {
    if (matrixWorkerHost.isStarted) {
      try {
        const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
        const result = await matrixWorkerHost.getLoginFlows(homeserverUrl)
        return result.flows ?? []
      } catch (err) {
        // Worker 中浏览器 fetch 对自签名 HTTPS 可能失败，回退到主线程
        logger.info(`[MatrixAuth] Worker 获取登录流失败，回退到主线程: ${err}`)
      }
    }
    // 确保 SDK Manager 扩展已加载（尤其是 getAccountManager），避免临时客户端缺少原型方法
    try {
      await sdk.initializeManagerExtensions()
    } catch {
      // 初始化失败时忽略，loginFlows 可能仍可用
    }
    try {
      const result = await createTemporaryMatrixClient().loginFlows()
      return (result.flows ?? []) as Array<{ type: string; [key: string]: unknown }>
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取登录流程失败')
    }
  }

  static async getRegisterFlows(): Promise<Array<{ type: string; stages?: string[]; [key: string]: unknown }>> {
    try {
      const result = await createTemporaryMatrixClient().registerRequest({})
      return (
        (result as unknown as { flows?: Array<{ type: string; stages?: string[]; [key: string]: unknown }> }).flows ??
        []
      )
    } catch (err) {
      const matrixErr = err as {
        errcode?: string
        flows?: Array<{ type: string; stages?: string[]; [key: string]: unknown }>
      }
      if (matrixErr.flows) {
        return matrixErr.flows
      }
      throw normalizeSdkMatrixError(err, '获取注册流程失败')
    }
  }

  /**
   * @throws {MatrixError} M_FORBIDDEN — invalid credentials
   * @throws {MatrixError} M_USER_DEACTIVATED — account deactivated
   * @throws {MatrixError} M_LIMIT_EXCEEDED — rate limited, retry after `retry_after_ms`
   */
  static async logout(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.getAuthManager().logout()
    } catch (err) {
      throw normalizeSdkMatrixError(err, '登出失败')
    }
  }

  static async logoutAll(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      // logoutAll not available in SDK AuthManager, use direct HTTP
      await client.http.authedRequest('POST', '/logout/all')
    } catch (err) {
      throw normalizeSdkMatrixError(err, '全局登出失败')
    }
  }

  static async getCapabilities(): Promise<Record<string, unknown>> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const result = await client.http.authedRequest('GET', '/capabilities')
      return result as Record<string, unknown>
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取能力声明失败')
    }
  }

  static async getSamlRedirect(idpId?: string, redirectUrl?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const queryParams: Record<string, string> = {}
      if (idpId) queryParams.idp_id = idpId
      if (redirectUrl) queryParams.redirectUrl = redirectUrl
      const result = await client.http.authedRequest(
        'GET',
        '/login/saml/redirect',
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return (result as { redirect_url?: string }).redirect_url ?? ''
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取 SAML 重定向失败')
    }
  }

  static async handleSamlCallback(
    samlResponse: string,
    relayState?: string,
    sessionId?: string
  ): Promise<MatrixLoginResult> {
    const body: Record<string, unknown> = { saml_response: samlResponse }
    if (relayState) body.relay_state = relayState
    if (sessionId) body.session_id = sessionId

    return postMatrixJson<MatrixLoginResult>(`${PREFIX_V3}/login/saml/callback`, body, 'SAML 回调处理失败')
  }

  static async samlLogout(redirectUrl?: string): Promise<string | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const queryParams = redirectUrl ? { redirectUrl } : undefined
      const result = await client.http.authedRequest('POST', '/login/saml/logout', queryParams)
      return (result as { redirect_url?: string }).redirect_url ?? null
    } catch (err) {
      throw normalizeSdkMatrixError(err, 'SAML 登出失败')
    }
  }

  static async getSamlMetadata(): Promise<Record<string, unknown>> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const result = await client.http.authedRequest('GET', '/login/saml/metadata')
      return result as Record<string, unknown>
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取 SAML 元数据失败')
    }
  }

  static async getVersions(): Promise<{
    versions: string[]
    unstableFeatures: Record<string, boolean>
  }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    if (matrixWorkerHost.isStarted) {
      try {
        const baseUrl = client.getHomeserverUrl()
        const accessToken = client.getAccessToken() ?? undefined
        const result = await matrixWorkerHost.getServerVersions(baseUrl, accessToken)
        return {
          versions: result.versions ?? [],
          unstableFeatures: result.unstable_features ?? {}
        }
      } catch (err) {
        throw normalizeSdkMatrixError(err, '获取服务器版本失败')
      }
    }

    try {
      const result = await client.http.authedRequest('GET', '/versions', undefined, undefined, {
        prefix: '/_matrix/client'
      })
      const r = result as Record<string, unknown>
      return {
        versions: (r.versions as string[]) ?? [],
        unstableFeatures: (r.unstable_features as Record<string, boolean>) ?? {}
      }
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取服务器版本失败')
    }
  }

  static async getWellKnown(): Promise<Record<string, unknown>> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const homeserverUrl = client.getHomeserverUrl()
      const baseUrl = homeserverUrl.replace(/\/_matrix\/client\/?$/, '').replace(/\/$/, '')
      const response = await getRuntimeAwareFetch()(`${baseUrl}${MATRIX_PATHS.WELL_KNOWN.CLIENT}`)
      if (!response.ok) {
        return {}
      }
      return (await response.json()) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  static async getSsoLoginUrl(idpId?: string, redirectUrl?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const queryParams: Record<string, string> = {}
      if (idpId) queryParams.idp_id = idpId
      if (redirectUrl) queryParams.redirectUrl = redirectUrl
      const result = await client.http.authedRequest(
        'GET',
        '/login/sso/redirect',
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return (result as { redirect_url?: string }).redirect_url ?? ''
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取 SSO 登录URL失败')
    }
  }
}

const _matrixAuthService = MatrixAuthService
