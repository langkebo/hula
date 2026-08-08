import type { ICreateRoomOpts, LoginResponse, MatrixClient, Room, SlidingSync, User } from 'matrix-js-sdk'
import type { TelemetryManager } from 'matrix-js-sdk/telemetry'
import { useI18nGlobal } from '@/services/i18n'
import { persistRefreshedToken, setupSystemResumeListener } from '@/services/matrix/matrixClientPlatform'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { PendingEventOrdering } from '@/types/matrix-js-sdk'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { type ConnectionState, type MatrixClientConfig, MatrixConnectionManager } from './MatrixConnectionManager'
import {
  type EventDecryptedDebugState,
  MatrixCryptoStateTracker,
  type RustCryptoDebugState
} from './MatrixCryptoStateTracker'
import { MatrixEventRouter } from './MatrixEventRouter'
import { MatrixSyncManager } from './MatrixSyncManager'
import { MatrixTokenManager } from './MatrixTokenManager'

export type { ConnectionState, MatrixClientConfig } from './MatrixConnectionManager'
export type { EventDecryptedDebugState, RustCryptoDebugState } from './MatrixCryptoStateTracker'

const logger = createLogger('MatrixClient')

type StartClientOptions = Parameters<MatrixClient['startClient']>[0]
type WhoamiCapableClient = MatrixClient & {
  whoami?: () => Promise<{ device_id?: string | null; user_id?: string | null }>
}

/**
 * 登录结果接口
 */
export interface LoginResult {
  /** 是否成功 */
  success: boolean
  /** 用户 ID */
  userId?: string
  /** 设备 ID */
  deviceId?: string
  /** 访问令牌 */
  accessToken?: string
  /** 错误信息 */
  error?: string
}

/**
 * Matrix 客户端服务（facade）
 *
 * 编排 Matrix 客户端的初始化、登录、登出和生命周期管理。内部委托给：
 * - MatrixConnectionManager — 连接生命周期 + 状态机
 * - MatrixEventRouter — 事件路由 + room 监听器
 * - MatrixCryptoStateTracker — crypto 调试状态
 * - MatrixTokenManager — token 刷新
 * - MatrixSyncManager — Sliding Sync
 *
 * @example
 * ```typescript
 * const service = matrixClientService;
 *
 * // 初始化
 * await service.initialize({
 *   homeserverUrl: 'https://matrix.example.org'
 * });
 *
 * // 登录
 * const result = await service.login('username', 'password');
 * if (result.success) {
 *   await service.startClient();
 * }
 * ```
 */
class MatrixClientService {
  private readonly connectionManager = new MatrixConnectionManager()
  private readonly eventRouter = new MatrixEventRouter()
  private readonly cryptoTracker = new MatrixCryptoStateTracker()
  private readonly tokenManager = new MatrixTokenManager()
  private readonly syncManager = new MatrixSyncManager()
  private telemetryManager: TelemetryManager | null = null

  constructor() {
    logger.info?.('Matrix 客户端服务初始化')
    // ConnectionManager 拥有连接状态机；将其状态变更桥接到外部事件订阅者，
    // 保持原先 updateConnectionState 触发 'connectionState' 事件的行为。
    this.connectionManager.onStateChange((state) => {
      this.eventRouter.emit('connectionState', { state })
    })
  }

  // ---- HTTP fallback login helpers --------------------------------------------

  private async loginByHttpFallback(username: string, password: string, deviceName?: string): Promise<LoginResponse> {
    const config = this.connectionManager.getConfig()
    if (!config?.homeserverUrl) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
    }

    const url = `${config.homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`
    const body = JSON.stringify({
      type: 'm.login.password',
      user: username,
      password,
      initial_device_display_name: deviceName || 'Tjg Client'
    })
    return this.loginRequestWithRetry(url, body)
  }

  private async tokenLoginByHttpFallback(loginToken: string): Promise<LoginResponse> {
    const config = this.connectionManager.getConfig()
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

      if (response.status === 429 && attempt < maxRetries) {
        let retryAfterMs = 5000
        try {
          const errorBody = await response.clone().json()
          retryAfterMs = errorBody.retry_after_ms || 5000
        } catch {
          /* ignore */
        }
        // 限流时间过长（>60s）时不再阻塞重试，立即抛错让 UI 显示"登录过于频繁，请X分钟后重试"
        // 否则 setTimeout(900000) 会阻塞 15 分钟，useLoginFlow 30s 超时后状态混乱
        if (retryAfterMs > 60_000) {
          const err = new Error(
            JSON.stringify({ errcode: 'M_LIMIT_EXCEEDED', error: 'Rate limited', retry_after_ms: retryAfterMs })
          ) as Error & { errcode?: string; retry_after_ms?: number }
          err.errcode = 'M_LIMIT_EXCEEDED'
          err.retry_after_ms = retryAfterMs
          logger.warn(`登录请求被限流 (429)，retry_after_ms=${retryAfterMs} 过长，不再重试，直接抛错`)
          throw err
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

  // ---- Public API -------------------------------------------------------------

  getTelemetry(): TelemetryManager | null {
    return this.telemetryManager
  }

  /**
   * Initialize the Matrix client with the provided config.
   *
   * Detaches old event listeners, resets crypto debug state, and delegates
   * client creation + accessor setup to MatrixConnectionManager.
   *
   * @throws {Error} if client creation fails.
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    const observed = this.eventRouter.getObservedClient()
    if (observed) {
      this.eventRouter.detach(observed, this.syncManager)
    }
    this.syncManager.stop()
    this.cryptoTracker.resetState()
    await this.connectionManager.initialize(config)

    // Register mxc:// resolver so AvatarUtils can convert Matrix media URIs.
    // Use client.mxcUrlToHttp() directly to avoid circular dependency with MatrixMediaService.
    const client = this.connectionManager.getClient()
    if (client) {
      AvatarUtils.setMxcResolver((mxcUrl, width, height) => {
        // 防护：登录失败或 client 未完全初始化时 mxcUrlToHttp 可能不存在
        const resolver = client.mxcUrlToHttp
        if (typeof resolver !== 'function') return null
        try {
          if (width && height) {
            return resolver.call(client, mxcUrl, width, height, 'scale')
          }
          return resolver.call(client, mxcUrl)
        } catch {
          return null
        }
      })
    }
  }

  // ---- Auth / Login -----------------------------------------------------------

  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    const client = this.connectionManager.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.connectionManager.updateConnectionState('CONNECTING')
      let loginResponse: LoginResponse

      try {
        loginResponse = await client.loginRequest({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: username },
          password,
          initial_device_display_name: deviceName || 'Tjg Client'
        })
      } catch (error) {
        const errInfo = error instanceof Error ? error.message : String(error)
        const httpStatus = (error as { httpStatus?: number })?.httpStatus
        const errcode = (error as { errcode?: string })?.errcode
        logger.warn(`SDK 密码登录失败 (status=${httpStatus}, errcode=${errcode}): ${errInfo}，尝试 HTTP 回退`)
        loginResponse = await this.loginByHttpFallback(username, password, deviceName)
      }

      await this.initialize({
        ...this.connectionManager.getConfig()!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.connectionManager.updateConnectionState('CONNECTED')
      const expiresInMs = loginResponse.expires_in_ms ?? 0
      if (loginResponse.refresh_token && expiresInMs > 0) {
        this.tokenManager.schedule(this.connectionManager.getClient()!, loginResponse.refresh_token, expiresInMs)
      }

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '登录失败'
      logger.error(`登录失败: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async getSSOLoginUrl(identityProviderId?: string): Promise<string> {
    const client = this.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const loginFlow = await client.loginFlows()
      const ssoFlow = loginFlow.flows.find((flow: Record<string, unknown>) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_not_supported'))
      }

      const ssoUrl = client.getSsoLoginUrl(window.location.href, 'Tjg Client', identityProviderId)

      logger.info('获取 SSO 登录 URL 成功')
      return ssoUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取 SSO 登录 URL 失败'
      logger.error(errorMessage)
      throw err
    }
  }

  async completeSSOLogin(loginToken: string): Promise<LoginResult> {
    const client = this.connectionManager.getClient()
    if (!client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.connectionManager.updateConnectionState('CONNECTING')
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

      await this.initialize({
        ...this.connectionManager.getConfig()!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.connectionManager.updateConnectionState('CONNECTED')
      const expiresInMs = loginResponse.expires_in_ms ?? 0
      if (loginResponse.refresh_token && expiresInMs > 0) {
        this.tokenManager.schedule(this.connectionManager.getClient()!, loginResponse.refresh_token, expiresInMs)
      }

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.connectionManager.updateConnectionState('ERROR')
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
    const config = this.connectionManager.getConfig()
    if (!config) {
      return { success: false, error: '配置未初始化' }
    }

    try {
      // P0-#2：复用配置中已持久化的 deviceId 初始化客户端，避免每次 token 登录
      // 生成新设备，导致 Rust Crypto 存储「账号不匹配」而降级为非加密模式。
      await this.initialize({
        ...config,
        accessToken: token,
        userId: userId,
        deviceId: config.deviceId ?? undefined
      })

      // 优先复用持久化 deviceId；仅当其缺失时再尝试 whoami 回填。
      let resolvedDeviceId = resolveStableDeviceId(
        config,
        this.connectionManager.getClient()?.getDeviceId?.() ?? undefined
      )
      if (!resolvedDeviceId) {
        resolvedDeviceId = await this.resolveTokenLoginDeviceId(userId)
        if (resolvedDeviceId) {
          await this.initialize({
            ...this.connectionManager.getConfig()!,
            accessToken: token,
            userId,
            deviceId: resolvedDeviceId
          })
        }
      }

      this.connectionManager.updateConnectionState('CONNECTED')

      let activeAccessToken = token
      if (refreshToken) {
        try {
          const client = this.connectionManager.getClient()
          if (client) {
            const refreshResult = await client.refreshToken(refreshToken)

            const newAccessToken = refreshResult.access_token
            const newRefreshToken = refreshResult.refresh_token
            let newExpiresInMs = refreshResult.expires_in_ms
            // 防御性处理：部分后端实现返回 expires_in (秒) 而非 expires_in_ms (毫秒)
            const expiresInSec = (refreshResult as unknown as Record<string, unknown>).expires_in as number | undefined
            if (!newExpiresInMs && expiresInSec) {
              newExpiresInMs = expiresInSec * 1000
            }

            if (newAccessToken && newExpiresInMs && newExpiresInMs > 0) {
              client.setAccessToken(newAccessToken)
              activeAccessToken = newAccessToken
              const uid = client.getUserId()
              if (uid) {
                await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? refreshToken)
              }
              this.tokenManager.schedule(client, newRefreshToken ?? refreshToken, newExpiresInMs)
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
    } catch (err) {
      this.connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : 'Token 登录失败'
      logger.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async logout(): Promise<void> {
    const client = this.connectionManager.getClient()
    if (!client) {
      return
    }

    this.tokenManager.clear()

    try {
      await client.logout()
      await this.stopClient()
      logger.info('登出成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败'
      logger.error(errorMessage)
    } finally {
      this.syncManager.stop()
      AvatarUtils.setMxcResolver(null)
      this.connectionManager.setClient(null)
      this.connectionManager.updateConnectionState('DISCONNECTED')
    }
  }

  // ---- Lifecycle --------------------------------------------------------------

  private async resolveTokenLoginDeviceId(userId: string): Promise<string | undefined> {
    const client = this.connectionManager.getClient()
    if (!client) {
      return undefined
    }

    const currentDeviceId = client.getDeviceId?.() ?? undefined
    if (currentDeviceId) {
      return currentDeviceId
    }

    const whoamiCapableClient = client as WhoamiCapableClient
    if (typeof whoamiCapableClient.whoami !== 'function') {
      return undefined
    }

    try {
      const response = await whoamiCapableClient.whoami()
      const resolvedDeviceId = response.device_id ?? undefined
      if (resolvedDeviceId) {
        logger.info(`Token 登录通过 whoami 回填 deviceId: ${userId}/${resolvedDeviceId}`)
      } else {
        logger.warn(`Token 登录 whoami 未返回 deviceId: ${userId}`)
      }
      return resolvedDeviceId
    } catch (err) {
      logger.warn(`Token 登录回填 deviceId 失败: ${userId}`, err)
      return undefined
    }
  }

  async startClient(): Promise<void> {
    const client = this.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    // setupSystemResumeListener 返回 void（不提供取消订阅 API），
    // 用 wrapper 适配 ConnectionManager.setupResumeListener 要求的 `() => () => void` 契约。
    this.connectionManager.setupResumeListener(
      () => {
        const currentClient = this.connectionManager.getClient()
        if (currentClient && this.connectionManager.getConnectionState() === 'CONNECTED') {
          this.forceReconnect()
        }
      },
      (cb: () => void) => {
        setupSystemResumeListener(cb)
        return () => {}
      }
    )

    try {
      const startOpts: StartClientOptions = {
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      const config = this.connectionManager.getConfig()
      if (config?.accessToken) {
        if (!this.syncManager.get()) {
          this.syncManager.create(client, config)
        }
        this.syncManager.resetReady()
        startOpts.slidingSync = this.syncManager.get()!
      } else {
        this.syncManager.stop()
      }

      await this.cryptoTracker.ensureCrypto(client, !!config?.accessToken)

      this.eventRouter.setSyncStateHandler((state, prevState, data) => {
        const result = this.connectionManager.mapSyncState(state, prevState, data)
        if (result.connectionState) {
          this.connectionManager.updateConnectionState(result.connectionState)
        }
        if (result.isReady) {
          this.syncManager.markReady()
        }
      })
      this.eventRouter.setLifecycleErrorHandler((err) => {
        this.connectionManager.handleSyncLifecycleError(err)
      })
      this.eventRouter.setLifecycleResetHandler(() => {
        this.connectionManager.resetSyncErrorCount()
      })
      this.eventRouter.setEventDecryptedHandler((event, err) => {
        this.cryptoTracker.handleEventDecrypted(event, err)
      })

      this.eventRouter.setup(client, this.syncManager)
      await client.startClient(startOpts)

      logger.info('客户端启动成功')
    } catch (err) {
      this.connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      logger.error(errorMessage, err)
      throw err
    }
  }

  async stopClient(): Promise<void> {
    try {
      this.tokenManager.clear()
      const client = this.connectionManager.getClient()
      if (client) {
        this.eventRouter.detach(client, this.syncManager)
        this.syncManager.stop()
        client.stopClient()
        AvatarUtils.setMxcResolver(null)
        this.connectionManager.updateConnectionState('DISCONNECTED')
        logger.info('客户端已停止')
      }
    } catch (err) {
      logger.error('停止客户端失败:', err)
      throw err
    }
  }

  private async forceReconnect(): Promise<void> {
    const client = this.connectionManager.getClient()
    if (!client) return

    try {
      logger.info('[LIFECYCLE] Stopping current sync for reconnect')
      client.stopClient()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      this.connectionManager.updateConnectionState('RECONNECTING')

      const startOpts: StartClientOptions = {
        initialSyncLimit: 10,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      const config = this.connectionManager.getConfig()
      if (config?.accessToken) {
        if (!this.syncManager.get()) {
          this.syncManager.create(client, config)
        }
        this.syncManager.resetReady()
        startOpts.slidingSync = this.syncManager.get()!
      }

      client.startClient(startOpts)
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      this.connectionManager.updateConnectionState('ERROR')
    }
  }

  // ---- Connection state -------------------------------------------------------

  updateConnectionState(state: ConnectionState): void {
    this.connectionManager.updateConnectionState(state)
  }

  // ---- Accessors --------------------------------------------------------------

  getClient(): MatrixClient | null {
    return this.connectionManager.getClient()
  }

  async waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
    return this.connectionManager.waitForClientReady(opts)
  }

  getSlidingSync(): SlidingSync | null {
    return this.syncManager.get()
  }

  getRustCryptoDebugState(): RustCryptoDebugState {
    return this.cryptoTracker.getRustCryptoDebugState()
  }

  /**
   * 检查 Rust Crypto 是否已成功初始化。
   * 用于在登录后判断加密功能是否可用，若不可用则在加密房间无法发送消息。
   */
  isCryptoReady(): boolean {
    return this.cryptoTracker.getRustCryptoDebugState().initialized
  }

  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return this.cryptoTracker.getEventDecryptedDebugState()
  }

  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    return this.syncManager.waitForReady(timeoutMs)
  }

  getConnectionState(): ConnectionState {
    return this.connectionManager.getConnectionState()
  }

  getUserId(): string | null {
    return this.connectionManager.getClient()?.getUserId() ?? null
  }

  getAccessToken(): string | null {
    const client = this.connectionManager.getClient()
    return client?.getAccessToken?.() ?? this.connectionManager.getConfig()?.accessToken ?? null
  }

  getHomeserverUrl(): string | null {
    const client = this.connectionManager.getClient()
    return client?.getHomeserverUrl?.() ?? this.connectionManager.getConfig()?.homeserverUrl ?? null
  }

  getDeviceId(): string | null {
    return this.connectionManager.getClient()?.getDeviceId() ?? null
  }

  getUser(userId: string): User | null {
    return this.connectionManager.getClient()?.getUser(userId) ?? null
  }

  isRoomEncrypted(roomId: string): boolean {
    return this.connectionManager.getClient()?.isRoomEncrypted?.(roomId) ?? false
  }

  // ---- Space management -------------------------------------------------------

  private static readonly DEFAULT_MODERATOR_POWER_LEVEL = 50

  canManageSpace(spaceId: string): boolean {
    const client = this.connectionManager.getClient()
    if (!client || !spaceId) return false

    const userId = client.getUserId()
    const room = client.getRoom(spaceId)
    if (!userId || !room || room.getMyMembership?.() !== 'join') {
      return false
    }

    const member = room.getMember(userId) ?? room.currentState?.getMember?.(userId)
    const powerLevel =
      member?.powerLevel ?? (member as { getPowerLevel?: () => number } | undefined)?.getPowerLevel?.() ?? 0
    return powerLevel >= MatrixClientService.DEFAULT_MODERATOR_POWER_LEVEL
  }

  // ---- Manager stats ----------------------------------------------------------

  getManagerStatsList(): Array<{
    name: string
    stats: { total: number; successful: number; failed: number; retried: number }
  }> {
    const client = this.connectionManager.getClient()
    if (!client) return []

    const results: Array<{
      name: string
      stats: { total: number; successful: number; failed: number; retried: number }
    }> = []
    const getterNames = this.extractManagerGetterNames(client)

    for (const getterName of getterNames) {
      const getter: unknown = (client as unknown as Record<string, unknown>)[getterName]
      if (typeof getter !== 'function') continue
      try {
        const manager = (getter as () => unknown).call(client)
        if (
          manager &&
          typeof (
            manager as {
              getRequestStats?: () => { total: number; successful: number; failed: number; retried: number }
            }
          ).getRequestStats === 'function'
        ) {
          const stats = (
            manager as { getRequestStats: () => { total: number; successful: number; failed: number; retried: number } }
          ).getRequestStats()
          const managerName = this.toManagerMetricName(getterName)
          results.push({ name: managerName, stats })
        }
      } catch {
        // ignore individual manager access errors
      }
    }

    return results
  }

  private extractManagerGetterNames(client: object): string[] {
    const getterNames = new Set<string>()
    let prototype = Object.getPrototypeOf(client)

    while (prototype && prototype !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name !== 'constructor' && /^get[A-Z].*Manager$/.test(name)) {
          getterNames.add(name)
        }
      }
      prototype = Object.getPrototypeOf(prototype)
    }

    return [...getterNames]
  }

  private toManagerMetricName(getterName: string): string {
    const baseName = getterName.replace(/^get/, '').replace(/Manager$/, '')
    return baseName ? baseName.charAt(0).toLowerCase() + baseName.slice(1) : getterName
  }

  // ---- Room operations --------------------------------------------------------

  getRooms(): Room[] {
    return this.connectionManager.getClient()?.getRooms() ?? []
  }

  getRoom(roomId: string): Room | null {
    return this.connectionManager.getClient()?.getRoom(roomId) ?? null
  }

  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    const client = this.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await client.createRoom(options)
      logger.info(`创建房间成功: ${response.room_id}`)
      const room = client.getRoom(response.room_id)
      if (!room) {
        throw new Error(useI18nGlobal().t('matrix_error.client.room_instance_failed_after_create'))
      }
      return room
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error(`创建房间失败: ${errorMessage}`)
      throw err
    }
  }

  async joinRoom(roomId: string): Promise<Room> {
    const client = this.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.joinRoom(roomId)
      logger.info(`加入房间成功: ${roomId}`)
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(useI18nGlobal().t('matrix_error.client.room_instance_failed_after_join'))
      }
      return room
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : useI18nGlobal().t('matrix_error.client.join_room_failed')
      logger.error(errorMessage)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    const client = this.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.leave(roomId)
      logger.info(`离开房间成功: ${roomId}`)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : useI18nGlobal().t('matrix_error.client.leave_room_failed')
      logger.error(errorMessage)
      throw err
    }
  }

  // ---- Event system -----------------------------------------------------------

  on(event: string, callback: (...args: unknown[]) => void): void {
    this.eventRouter.on(event, callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.eventRouter.off(event, callback)
  }
}

export const matrixClientService = new MatrixClientService()
export default matrixClientService

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
