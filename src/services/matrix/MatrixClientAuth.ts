/**
 * MatrixClientAuth — 客户端认证协作类
 *
 * 承载 MatrixClientService 的认证相关职责：
 * - login：用户名密码登录（含 HTTP fallback）
 * - getSSOLoginUrl / completeSSOLogin：SSO 登录流程
 * - loginWithToken：基于已有 token 登录（含 refresh token 续期、whoami 预解析）
 * - logout：登出并清理本地状态
 *
 * 通过 deps 注入主类持有的协作模块（connectionManager / tokenManager /
 * cryptoTracker / syncManager / eventRouter / lifecycle），
 * 不再让主类直接承载这些方法的实现细节。
 */

import { useI18nGlobal } from '@/services/i18n'
import { clearSenderDeviceCache } from '@/services/matrix/crypto/messageTrustCache'
import { persistRefreshedToken } from '@/services/matrix/matrixClientPlatform'
import type { LoginResponse } from '@/services/matrix/sdk'
import { clearSecretStorageKeys } from '@/services/matrix/secretStorageKeyVault'
import { clearCryptoStorageKeyCache, deleteCryptoStorageKey } from '@/services/secure/cryptoStorageKey'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import { generateDeviceId, getPersistedDeviceId, persistDeviceId } from './deviceIdPersistence'
import { loginByHttpFallback, tokenLoginByHttpFallback } from './MatrixClientAuthHttp'
import type { MatrixClientLifecycle } from './MatrixClientLifecycle'
import type { MatrixClientConfig, MatrixConnectionManager } from './MatrixConnectionManager'
import type { MatrixCryptoStateTracker } from './MatrixCryptoStateTracker'
import type { MatrixEventRouter } from './MatrixEventRouter'
import type { MatrixSyncManager } from './MatrixSyncManager'
import { type MatrixTokenManager, resolveTokenExpiryMs } from './MatrixTokenManager'

const logger = createLogger('MatrixClient')

/** 登录结果接口 */
export interface LoginResult {
  /** 是否成功 */
  success: boolean
  /** 用户 ID */
  userId?: string | undefined
  /** 设备 ID */
  deviceId?: string | undefined
  /** 访问令牌 */
  accessToken?: string | undefined
  /** 刷新令牌（用于自动续期） */
  refreshToken?: string | undefined
  /** 错误信息 */
  error?: string | undefined
}

/** Auth 子服务依赖的主类协作模块集合 */
export interface MatrixClientAuthDeps {
  readonly connectionManager: MatrixConnectionManager
  readonly eventRouter: MatrixEventRouter
  readonly syncManager: MatrixSyncManager
  readonly cryptoTracker: MatrixCryptoStateTracker
  readonly tokenManager: MatrixTokenManager
  readonly lifecycle: MatrixClientLifecycle
  readonly startClientGuard: IdempotencyGuard
}

/**
 * P0-#2：解析 token 登录应使用的 deviceId。
 * 优先复用配置中已持久化的 deviceId，避免每次 token 登录都生成新设备，
 * 否则 Rust Crypto 存储会因「账号不匹配」而清空并降级为非加密模式。
 * 仅当配置中无 deviceId 时，才回退到 sdk 初始化时生成的设备（或 whoami 回填）。
 */
export function resolveStableDeviceId(
  config: MatrixClientConfig,
  clientGeneratedId: string | undefined
): string | undefined {
  return config.deviceId ?? clientGeneratedId
}

/**
 * 客户端认证协作类。
 *
 * 不持有自己的可变状态——所有状态都委托给 deps 中的协作模块，
 * 由 MatrixClientService 单例保证全局唯一性。
 */
export class MatrixClientAuth {
  constructor(private readonly deps: MatrixClientAuthDeps) {}

  // ---- Public Auth API --------------------------------------------------------

  /** 用户名密码登录
   */
  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    const { connectionManager, tokenManager, lifecycle } = this.deps
    const client = connectionManager.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      connectionManager.updateConnectionState('CONNECTING')
      let loginResponse: LoginResponse

      // 复用已有 deviceId，避免每次密码登录在服务器端累积新设备
      const config = connectionManager.getConfig()
      const reusedDeviceId = config?.deviceId ?? getPersistedDeviceId(username)

      try {
        loginResponse = await client.loginRequest({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: username },
          password,
          initial_device_display_name: deviceName || 'Tjg Client',
          ...(reusedDeviceId ? { device_id: reusedDeviceId } : {})
        })
      } catch (error) {
        const errInfo = error instanceof Error ? error.message : String(error)
        const httpStatus = (error as { httpStatus?: number })?.httpStatus
        const errcode = (error as { errcode?: string })?.errcode
        logger.warn(`SDK 密码登录失败 (status=${httpStatus}, errcode=${errcode}): ${errInfo}，尝试 HTTP 回退`)
        if (!config?.homeserverUrl) {
          throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
        }
        loginResponse = await loginByHttpFallback(config.homeserverUrl, username, password, deviceName)
      }

      await lifecycle.initialize({
        ...connectionManager.getConfig()!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? reusedDeviceId ?? generateDeviceId()
      })

      // 登录成功后持久化 deviceId，供下次密码登录复用
      if (loginResponse.user_id && loginResponse.device_id) {
        persistDeviceId(username, loginResponse.device_id)
      }

      connectionManager.updateConnectionState('CONNECTED')
      // 规范字段是 `expires_in`（秒），不能只读 `expires_in_ms`（见 resolveTokenExpiryMs）。
      const expiresInMs = resolveTokenExpiryMs(loginResponse)
      if (loginResponse.refresh_token && expiresInMs > 0) {
        tokenManager.schedule(connectionManager.getClient()!, loginResponse.refresh_token, expiresInMs)
      } else if (loginResponse.refresh_token) {
        logger.warn('[Auth] 响应未提供有效期，本次会话不排期自动续期')
      }

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token,
        refreshToken: loginResponse.refresh_token
      }
    } catch (err) {
      connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '登录失败'
      logger.error(`登录失败: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 注册并登录访客账号（POST /register/guest）。
   *
   * 与密码登录一致：登录成功后重建/复用 client、持久化 deviceId、安排 token 续期。
   * 访客能力是否可用由调用方通过 `MatrixAuthService.getGuestSupport()` 预先探测。
   *
   * @throws Never throws (returns { success: false, error } on failure).
   */
  async registerGuest(deviceName?: string): Promise<LoginResult> {
    const { connectionManager, tokenManager, lifecycle } = this.deps
    const client = connectionManager.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      connectionManager.updateConnectionState('CONNECTING')
      const response = await client.getGuestManager().registerGuestOnServer(undefined, deviceName || 'Tjg Client Guest')

      await lifecycle.initialize({
        ...connectionManager.getConfig()!,
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id ?? generateDeviceId()
      })

      if (response.user_id && response.device_id) {
        persistDeviceId(response.user_id, response.device_id)
      }

      connectionManager.updateConnectionState('CONNECTED')
      const expiresInMs = resolveTokenExpiryMs(response)
      if (response.refresh_token && expiresInMs > 0) {
        tokenManager.schedule(connectionManager.getClient()!, response.refresh_token, expiresInMs)
      }

      return {
        success: true,
        userId: response.user_id,
        deviceId: response.device_id,
        accessToken: response.access_token,
        refreshToken: response.refresh_token
      }
    } catch (err) {
      connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '访客登录失败'
      logger.error(`访客登录失败: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /** 获取 SSO 登录 URL
   *
   * W-06 收口（2026-10-10）：`client.getSsoLoginUrl()` 已删除 `idpId` 形参、且第二参是
   * **`loginType`（会拼进 URL 路径段）**而不是设备名 —— 旧调用传 `'Tjg Client'` 会拼出
   * `/_matrix/client/v3/login/Tjg%20Client/redirect/…` ⇒ **404**（后端只注册
   * `/login/sso/redirect` 与 `/login/sso/redirect/{cas|saml}`）。
   * 本方法只需默认的 `loginType="sso"`，故不再接受任何 IdP 参数
   * （本后端的 IdP 选择靠路径段，无查询参数落点）。
   */
  async getSSOLoginUrl(): Promise<string> {
    const { connectionManager } = this.deps
    const client = connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const loginFlow = await client.loginFlows()
      const ssoFlow = loginFlow.flows.find((flow: Record<string, unknown>) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_not_supported'))
      }

      const ssoUrl = client.getSsoLoginUrl(window.location.href)

      logger.info('获取 SSO 登录 URL 成功')
      return ssoUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取 SSO 登录 URL 失败'
      logger.error(errorMessage)
      throw err
    }
  }

  /** 使用登录令牌完成 SSO 登录
   */
  async completeSSOLogin(loginToken: string): Promise<LoginResult> {
    const { connectionManager, tokenManager, lifecycle } = this.deps
    const client = connectionManager.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      connectionManager.updateConnectionState('CONNECTING')
      let loginResponse: LoginResponse

      try {
        // SDK 真实归属是 `getAccountManager().login(type, params)` ——
        // 它内部调 loginRequest 并**写入 accessToken / userId**（`lib/account/index.js:237-246`）；
        // MatrixClient 本体没有 `login`。
        loginResponse = await client.getAccountManager().login('m.login.token', {
          token: loginToken
        })
      } catch (error) {
        const errInfo = error instanceof Error ? error.message : String(error)
        const httpStatus = (error as { httpStatus?: number })?.httpStatus
        logger.warn(`SDK SSO 登录失败 (status=${httpStatus}): ${errInfo}，尝试 HTTP 回退`)
        const config = connectionManager.getConfig()
        if (!config?.homeserverUrl) {
          throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
        }
        loginResponse = await tokenLoginByHttpFallback(config.homeserverUrl, loginToken)
      }

      logger.info(`SSO 登录成功: ${loginResponse.user_id}`)

      await lifecycle.initialize({
        ...connectionManager.getConfig()!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? generateDeviceId()
      })

      // SSO 登录成功后持久化 deviceId，供后续登录复用
      if (loginResponse.user_id && loginResponse.device_id) {
        persistDeviceId(loginResponse.user_id, loginResponse.device_id)
      }

      connectionManager.updateConnectionState('CONNECTED')
      const expiresInMs = resolveTokenExpiryMs(loginResponse)
      if (loginResponse.refresh_token && expiresInMs > 0) {
        tokenManager.schedule(connectionManager.getClient()!, loginResponse.refresh_token, expiresInMs)
      }

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token,
        refreshToken: loginResponse.refresh_token
      }
    } catch (err) {
      connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : 'SSO 登录失败'
      logger.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Authenticate using a pre-existing access token (e.g. from QR login or session restore).
   * Optionally refreshes the token if a refreshToken is provided.
   *
   * @throws Never throws (returns { success: false, error } on failure).
   */
  async loginWithToken(token: string, userId: string, refreshToken?: string): Promise<LoginResult> {
    const { connectionManager, tokenManager, lifecycle } = this.deps
    const config = connectionManager.getConfig()
    if (!config) {
      return { success: false, error: '配置未初始化' }
    }

    try {
      // P0-#2（优化）：如果客户端已初始化且用户一致，跳过重复 initialize()
      // 避免 SessionRestoreService.restoreWithAccessToken() 已调用 initialize() 后
      // 再次调用导致的重复初始化和不必要的客户端重建
      const existingClient = connectionManager.getClient()
      const reusableDeviceId = existingClient?.getDeviceId?.() ?? config.deviceId
      if (existingClient && reusableDeviceId && connectionManager.shouldReuse({ ...config, userId })) {
        logger.info('[MatrixClientAuth] 客户端已初始化且用户一致，跳过重复 initialize()')
        // 返回当前 token 和设备 ID
        const currentAccessToken = existingClient.getAccessToken() ?? token
        return {
          success: true,
          userId,
          deviceId: reusableDeviceId,
          accessToken: currentAccessToken
        }
      } else {
        // P0-#2（优化）：在首次 initialize 前解析稳定 deviceId，避免「先建 client 再发现
        // deviceId 又重建」的泄漏与重复 E2EE 查询（keys/query 翻倍 / 重复回执）。
        // 优先复用配置中已持久化的 deviceId；缺失时通过 whoami 端点（带 token 直连，无需已初始化的 client）
        // 预解析 access token 绑定的设备，再一次性 initialize。
        // 短路：已持久化 deviceId 时不发 whoami 请求，避免多余往返。
        const whoamiDeviceId = config.deviceId
          ? undefined
          : await lifecycle.resolveDeviceIdByWhoami(token, config.homeserverUrl)
        // 兜底：whoami 也未返回 device_id 时（synapse-rust 的 whoami 端点可能不返回该字段），
        // 本地生成一个稳定 deviceId，避免 createClient 无 deviceId → getDeviceId() 恒为 null
        // → ensureCrypto 因「缺少 userId 或 deviceId」跳过 Rust Crypto 初始化（E2EE 失效）。
        const stableDeviceId = resolveStableDeviceId(config, whoamiDeviceId) ?? generateDeviceId()

        await lifecycle.initialize({
          ...config,
          accessToken: token,
          userId,
          deviceId: stableDeviceId
        })

        // 回退：若 whoami 也未返回 deviceId，则采用 SDK 实际使用的设备（首次 sync 后才落定）。
        const resolvedDeviceId = resolveStableDeviceId(
          { ...config, deviceId: stableDeviceId },
          connectionManager.getClient()?.getDeviceId?.() ?? undefined
        )

        connectionManager.updateConnectionState('CONNECTED')

        let activeAccessToken = token
        if (refreshToken) {
          try {
            const client = connectionManager.getClient()
            if (client) {
              const refreshResult = await client.refreshToken(refreshToken)

              const newAccessToken = refreshResult.access_token
              const newRefreshToken = refreshResult.refresh_token
              // 与登录路径共用同一口径，避免再次出现「只读 expires_in_ms」的分叉。
              const newExpiresInMs = resolveTokenExpiryMs(refreshResult)

              if (newAccessToken && newExpiresInMs && newExpiresInMs > 0) {
                client.setAccessToken(newAccessToken)
                activeAccessToken = newAccessToken
                const uid = client.getUserId()
                if (uid) {
                  await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? refreshToken)
                }
                tokenManager.schedule(client, newRefreshToken ?? refreshToken, newExpiresInMs)
              }
            }
          } catch {
            // 服务器不支持 refresh 或刷新失败，不影响登录
          }
        }

        return {
          success: true,
          userId: userId,
          deviceId: resolvedDeviceId,
          accessToken: activeAccessToken
        }
      }
    } catch (err) {
      connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : 'Token 登录失败'
      logger.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /** 登出并清理本地状态
   */
  async logout(): Promise<void> {
    const { connectionManager, tokenManager, syncManager, cryptoTracker, eventRouter, lifecycle, startClientGuard } =
      this.deps
    const client = connectionManager.getClient()
    if (!client) {
      return
    }

    // 在 client.logout() 销毁会话前提取 userId/deviceId，用于清理 keychain 中的 storagePassword
    const userId = client.getUserId?.() ?? null
    const deviceId = client.getDeviceId?.() ?? null

    tokenManager.clear()

    try {
      await client.logout()
      await lifecycle.stopClient()
      logger.info('登出成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败'
      logger.error(errorMessage)
    } finally {
      syncManager.stop()
      AvatarUtils.setMxcResolver(null)
      connectionManager.setClient(null)
      connectionManager.updateConnectionState('DISCONNECTED')
      startClientGuard.reset() // 重置启动守卫，保证登出后下次登录能 startClient
      // ISSUE-08：清理 keychain 中的 crypto storageKey，避免残留
      if (userId && deviceId) {
        void deleteCryptoStorageKey(userId, deviceId)
      }
      // 全量清理内存缓存中的 crypto storageKey，防止切换账号时复用旧密钥
      clearCryptoStorageKeyCache()
      // 清空 SSSS 私钥内存保险箱，避免登出后残留（历史缺陷：sessionStorage 缓存从不清理）
      clearSecretStorageKeys()
      // 清空消息信任缓存（key 含账号维度，登出仍须释放，避免重登首帧沿用旧判定）
      clearSenderDeviceCache()
      // 清除 IndexedDB crypto store 与 localStorage 记录，确保下次登录从干净状态开始
      if (userId) {
        cryptoTracker.clearCryptoStoreForLogout(userId).catch((err) => {
          logger.warn(`清理 crypto store 失败 (userId=${userId}):`, err)
        })
      }
      void eventRouter // 保留仅为 deps 形状完整（监听器清理已由 lifecycle.stopClient 完成）
    }
  }
}
