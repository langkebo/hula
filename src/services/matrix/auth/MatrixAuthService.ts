import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { initializeManagerExtensions } from '@/services/matrix/sdk'
import { matrixClientService } from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import { logger, normalizeSdkMatrixError } from './authErrors'
import {
  buildRegisterAuth,
  createTemporaryMatrixClient,
  generateClientSecret,
  type MatrixEmailTokenPurpose,
  type MatrixLoginResult,
  type MatrixRegisterResult,
  type MatrixRequestedEmailTokenResult,
  matrixLogin,
  matrixRegister,
  matrixRequestEmailToken,
  matrixSubmitEmailToken,
  runSdkFirst,
  withClientSecret
} from './authHelpers'
import * as captchaApi from './MatrixAuthCaptcha'
import * as passwordApi from './MatrixAuthPassword'
import * as samlApi from './MatrixAuthSaml'

// 类型再导出：保持对外 API 不变（useSessionActions 等仍从此处导入类型）
export type { MatrixLoginResult, MatrixRegisterResult, MatrixRequestedEmailTokenResult } from './authHelpers'

/**
 * Matrix 认证服务（facade）。
 *
 * 主文件仅承载核心登录/注册/会话流程；验证码、密码重置、SAML 子领域
 * 通过类属性委托到 `MatrixAuthCaptcha` / `MatrixAuthPassword` / `MatrixAuthSaml`。
 * 辅助函数与错误归一化分别在 `authHelpers` / `authErrors` 中。
 */
export class MatrixAuthService {
  private static generateClientSecret(): string {
    return generateClientSecret()
  }

  // ===== Captcha / Password / SAML — 委托到拆分模块 =====
  static readonly getCaptcha = captchaApi.getCaptcha
  static readonly startRegistrationSession = captchaApi.startRegistrationSession
  static readonly verifyCaptcha = captchaApi.verifyCaptcha
  static readonly getCaptchaStatus = captchaApi.getCaptchaStatus
  static readonly cleanupExpiredCaptchas = captchaApi.cleanupExpiredCaptchas

  static readonly requestPasswordEmailToken = passwordApi.requestPasswordEmailToken
  static readonly forgetPassword = passwordApi.forgetPassword
  static readonly resetPassword = passwordApi.resetPassword

  static readonly getSamlRedirect = samlApi.getSamlRedirect
  static readonly handleSamlCallback = samlApi.handleSamlCallback
  static readonly samlLogout = samlApi.samlLogout
  static readonly getSamlMetadata = samlApi.getSamlMetadata

  // ===== 核心登录 / 注册 =====

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
          initial_device_display_name: 'Tjg Desktop',
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

  // ===== 会话 / 账户 =====

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
      const result = await client.whoami()
      return {
        userId: result.user_id ?? '',
        deviceId: result.device_id
      }
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取账户信息失败')
    }
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
      await initializeManagerExtensions()
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
      await authedRequestWithPath(client, 'POST', '/logout/all')
    } catch (err) {
      throw normalizeSdkMatrixError(err, '全局登出失败')
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
    } catch (err) {
      // R-20: well-known is optional (相对合理), use warn not error
      logger.warn('fetchWellKnown failed:', err)
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
      const result = await authedRequestWithPath<{ redirect_url?: string }>(
        client,
        'GET',
        '/login/sso/redirect',
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result.redirect_url ?? ''
    } catch (err) {
      throw normalizeSdkMatrixError(err, '获取 SSO 登录URL失败')
    }
  }
}
