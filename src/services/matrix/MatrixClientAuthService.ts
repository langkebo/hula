import type { LoginResponse, MatrixClient } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import { logoutExpiredSession, persistRefreshedToken } from '@/services/matrix/matrixClientPlatform'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { createLogger } from '@/utils/Logger'
import type { ConnectionState, LoginResult, MatrixClientConfig } from './MatrixClientService.types'

const logger = createLogger('MatrixClientAuth')

interface MatrixClientAuthServiceDeps {
  getClient: () => MatrixClient | null
  getConfig: () => MatrixClientConfig | null
  initialize: (config: MatrixClientConfig) => Promise<void>
  stopClient: () => Promise<void>
  setClient: (client: MatrixClient | null) => void
  setConnectionState: (state: ConnectionState) => void
}

export class MatrixClientAuthService {
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private isRefreshingToken = false

  constructor(private readonly deps: MatrixClientAuthServiceDeps) {}

  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    const client = this.deps.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.deps.setConnectionState('CONNECTING')
      let loginResponse: LoginResponse

      try {
        loginResponse = await client.login('m.login.password', {
          user: username,
          password,
          initial_device_display_name: deviceName || 'HuLa Client'
        })
      } catch (error) {
        // 登录场景始终尝试 HTTP fallback——SDK 登录可能因请求格式差异、
        // 中间件干扰等原因失败，而 HTTP fallback 等同于 curl 直接请求
        const errInfo = error instanceof Error ? error.message : String(error)
        const httpStatus = (error as { httpStatus?: number })?.httpStatus
        const errcode = (error as { errcode?: string })?.errcode
        logger.warn(`SDK 密码登录失败 (status=${httpStatus}, errcode=${errcode}): ${errInfo}，尝试 HTTP 回退`)
        loginResponse = await this.loginByHttpFallback(username, password, deviceName)
      }

      logger.info(`登录成功: ${loginResponse.user_id}`)

      await this.deps.initialize({
        ...this.deps.getConfig()!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.deps.setConnectionState('CONNECTED')
      this.scheduleTokenRefresh(loginResponse.refresh_token, loginResponse.expires_in)

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.deps.setConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '登录失败'
      logger.error(`登录失败: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async getSSOLoginUrl(identityProviderId?: string): Promise<string> {
    const client = this.deps.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const loginFlow = await client.loginFlows()
      const ssoFlow = loginFlow.flows.find((flow: Record<string, unknown>) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_not_supported'))
      }

      const ssoUrl = client.getSsoLoginUrl(window.location.href, 'HuLa Client', identityProviderId)
      logger.info('获取 SSO 登录 URL 成功')
      return ssoUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取 SSO 登录 URL 失败'
      logger.error(errorMessage)
      throw err
    }
  }

  async completeSSOLogin(loginToken: string): Promise<LoginResult> {
    const client = this.deps.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.deps.setConnectionState('CONNECTING')
      let loginResponse: LoginResponse

      try {
        loginResponse = await client.login('m.login.token', {
          token: loginToken
        })
      } catch (error) {
        const errInfo = error instanceof Error ? error.message : String(error)
        const httpStatus = (error as { httpStatus?: number })?.httpStatus
        logger.warn(`SDK SSO 登录失败 (status=${httpStatus}): ${errInfo}，尝试 HTTP 回退`)
        loginResponse = await this.tokenLoginByHttpFallback(loginToken)
      }

      logger.info(`SSO 登录成功: ${loginResponse.user_id}`)

      await this.deps.initialize({
        ...this.deps.getConfig()!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.deps.setConnectionState('CONNECTED')
      this.scheduleTokenRefresh(loginResponse.refresh_token, loginResponse.expires_in)

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.deps.setConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : 'SSO 登录失败'
      logger.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async loginWithToken(token: string, userId: string): Promise<LoginResult> {
    const config = this.deps.getConfig()
    if (!config) {
      return { success: false, error: '配置未初始化' }
    }

    try {
      await this.deps.initialize({
        ...config,
        accessToken: token,
        userId
      })

      this.deps.setConnectionState('CONNECTED')
      this.scheduleTokenRefresh(undefined, undefined)

      return {
        success: true,
        userId,
        accessToken: token
      }
    } catch (err) {
      this.deps.setConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : 'Token 登录失败'
      logger.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async logout(): Promise<void> {
    const client = this.deps.getClient()
    if (!client) {
      return
    }

    this.clearTokenRefreshTimer()

    try {
      await client.logout()
      await this.deps.stopClient()
      logger.info('登出成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败'
      logger.error(errorMessage)
    } finally {
      this.deps.setClient(null)
      this.deps.setConnectionState('DISCONNECTED')
    }
  }

  clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }
  }

  private async loginByHttpFallback(username: string, password: string, deviceName?: string): Promise<LoginResponse> {
    const config = this.deps.getConfig()
    if (!config?.homeserverUrl) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
    }

    const url = `${config.homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`
    const body = JSON.stringify({
      type: 'm.login.password',
      user: username,
      password,
      initial_device_display_name: deviceName || 'HuLa Client'
    })

    return this.loginRequestWithRetry(url, body)
  }

  private async tokenLoginByHttpFallback(loginToken: string): Promise<LoginResponse> {
    const config = this.deps.getConfig()
    if (!config?.homeserverUrl) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
    }

    const url = `${config.homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`
    const body = JSON.stringify({
      type: 'm.login.token',
      token: loginToken
    })

    return this.loginRequestWithRetry(url, body)
  }

  private async loginRequestWithRetry(url: string, body: string, maxRetries = 2): Promise<LoginResponse> {
    const runtimeFetch = getRuntimeAwareFetch()

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await runtimeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      })

      if (response.ok) {
        return (await response.json()) as LoginResponse
      }

      // 429 限流：等待 retry_after_ms 后重试
      if (response.status === 429 && attempt < maxRetries) {
        let retryAfterMs = 5000
        try {
          const errorBody = await response.clone().json()
          retryAfterMs = errorBody.retry_after_ms || 5000
        } catch {
          /* ignore */
        }
        logger.warn(`登录请求被限流 (429)，${retryAfterMs}ms 后重试 (${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
        continue
      }

      const text = await response.text().catch(() => '')
      throw new Error(
        text || useI18nGlobal().t('matrix_error.auth.login_failed_with_status', { status: response.status })
      )
    }

    throw new Error('登录请求被限流，请稍后重试')
  }

  private scheduleTokenRefresh(refreshToken?: string, expiresInMs?: number): void {
    this.clearTokenRefreshTimer()
    if (!refreshToken || !expiresInMs || expiresInMs <= 0) {
      return
    }

    const refreshAt = Math.max(expiresInMs - 60000, 30000)
    logger.info(`[TokenRefresh] 已调度 Token 刷新: ${refreshAt}ms 后`)
    this.tokenRefreshTimer = setTimeout(() => {
      void this.tryRefreshToken(refreshToken)
    }, refreshAt)
  }

  private async tryRefreshToken(refreshToken: string): Promise<void> {
    const client = this.deps.getClient()
    if (this.isRefreshingToken || !client) {
      return
    }

    this.isRefreshingToken = true

    try {
      logger.info('[TokenRefresh] 开始刷新访问令牌')
      const result = (await client.http.authedRequest('POST', '/_matrix/client/v3/refresh', undefined, {
        refresh_token: refreshToken
      })) as Record<string, unknown>

      const newAccessToken = result.access_token as string | undefined
      const newRefreshToken = result.refresh_token as string | undefined
      const newExpiresInMs = result.expires_in_ms as number | undefined

      if (newAccessToken) {
        const uid = client.getUserId()
        if (uid) {
          await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? '')
        }
        logger.info('[TokenRefresh] 访问令牌刷新成功')
        this.scheduleTokenRefresh(newRefreshToken, newExpiresInMs)
      }
    } catch (err) {
      logger.error(`[TokenRefresh] 刷新访问令牌失败: ${err}`)
      logger.warn('[TokenRefresh] Session expired, clearing stored session')
      try {
        await logoutExpiredSession()
      } catch (cleanupErr) {
        logger.warn('[TokenRefresh] Failed to clear expired session', cleanupErr)
      }
    } finally {
      this.isRefreshingToken = false
    }
  }
}
