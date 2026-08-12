import { TauriCommand } from '@/enums'
import { resolveMatrixSessionEndpointConfig, saveMatrixSessionEndpointConfig } from '@/services/backend/config'
import { switchUserDatabase } from '@/services/backend/tauriCommand'
import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { patchMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import type { MatrixPasswordLoginOptions, MatrixSsoLoginOptions, SessionRuntimeHost } from './sessionRuntimeInternal'

const logger = createLogger('SessionLoginService')

/**
 * Login logic: authenticate with password or SSO token, persist tokens/user info,
 * then delegate to SessionBootstrapService via the host.
 */
export class SessionLoginService {
  constructor(private readonly host: SessionRuntimeHost) {}

  /**
   * Authenticate with password credentials and bootstrap the session.
   *
   * @throws {Error} if login fails or session info is incomplete.
   */
  async loginWithPassword(options: MatrixPasswordLoginOptions): Promise<{ uid: string; accessToken: string }> {
    const port = this.host.port
    try {
      const {
        username,
        password,
        homeserverUrl,
        identityServerUrl,
        deviceName,
        account,
        displayName,
        avatar,
        client,
        persistTokens = true,
        persistUserInfo = true,
        switchDatabase = true
      } = options

      await ensureAppStateReady()
      saveMatrixSessionEndpointConfig({ homeserverUrl, identityServerUrl: identityServerUrl || '' })
      await port.matrix.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await port.matrix.login(username, password, deviceName)
      if (!success) {
        throw new Error(port.matrix.getLastError() || useI18nGlobal().t('matrix_error.auth.login_failed_check_network'))
      }

      const uid = port.matrix.getUserId()
      const accessToken = port.matrix.getAccessToken()
      if (!uid || !accessToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.session_info_incomplete'))
      }

      const refreshToken = port.matrix.getRefreshToken() ?? ''
      patchMatrixSessionSnapshot({
        userId: uid,
        deviceId: this.host.getCurrentClientDeviceId(),
        accessToken,
        homeserverUrl
      })

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken
          }
        })
      }

      if (persistUserInfo && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.SAVE_USER_INFO, {
          userInfo: {
            uid
          }
        })
      }

      await this.host.bootstrapPostLoginState({
        account: account || username,
        displayName,
        avatar,
        client
      })

      return {
        uid,
        accessToken
      }
    } catch (err) {
      logger.error(`密码登录失败: ${err}`)
      // 清理已启动的 client：若 matrix.login() 成功但 bootstrapPostLoginState 失败，
      // client 仍在运行 sync，资源泄漏 + 重试时可能产生重复登录/设备。
      // stopClient 是幂等的，可安全调用。
      try {
        await matrixClientService.stopClient()
      } catch (cleanupErr) {
        logger.warn('登录失败后清理 client 异常:', cleanupErr)
      }
      throw err
    }
  }

  /**
   * Authenticate with an SSO login token and bootstrap the session.
   *
   * @throws {Error} if loginToken is empty.
   * @throws {Error} if SSO login fails or session info is incomplete.
   */
  async loginWithSsoToken(options: MatrixSsoLoginOptions): Promise<{ uid: string; accessToken: string }> {
    const port = this.host.port
    try {
      const {
        loginToken,
        account,
        displayName,
        avatar,
        client,
        persistTokens = true,
        persistUserInfo = true,
        switchDatabase = true
      } = options

      if (!loginToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_token_missing'))
      }

      const { homeserverUrl, identityServerUrl } = resolveMatrixSessionEndpointConfig()

      await ensureAppStateReady()
      await port.matrix.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await port.matrix.completeSSOLogin(loginToken)
      if (!success) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_login_failed'))
      }

      const uid = port.matrix.getUserId()
      const accessToken = port.matrix.getAccessToken()
      if (!uid || !accessToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_session_incomplete'))
      }

      const refreshToken = port.matrix.getRefreshToken() ?? ''
      patchMatrixSessionSnapshot({
        userId: uid,
        deviceId: this.host.getCurrentClientDeviceId(),
        accessToken,
        homeserverUrl
      })

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken
          }
        })
      }

      if (persistUserInfo && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.SAVE_USER_INFO, {
          userInfo: {
            uid
          }
        })
      }

      await this.host.bootstrapPostLoginState({
        account,
        displayName,
        avatar,
        client
      })

      return {
        uid,
        accessToken
      }
    } catch (err) {
      logger.error(`SSO 登录失败: ${err}`)
      throw err
    }
  }
}
