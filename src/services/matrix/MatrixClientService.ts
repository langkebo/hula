import {
  createClient,
  type ICreateRoomOpts,
  initializeManagerExtensions,
  type LoginResponse,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type SlidingSync,
  type User
} from 'matrix-js-sdk'
import type { TelemetryManager } from 'matrix-js-sdk/telemetry'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { setMatrixClientAccessor } from '@/services/matrix/matrixClientAccessor'
import { persistRefreshedToken, setupSystemResumeListener } from '@/services/matrix/matrixClientPlatform'
import { getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'
import { type ICreateClientOpts, PendingEventOrdering } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import type { SearchEventDoc } from '@/workers/matrixWorkerTypes'
import { MatrixSyncManager } from './MatrixSyncManager'
import { MatrixTokenManager } from './MatrixTokenManager'

const logger = createLogger('MatrixClient')

/**
 * 连接状态类型
 */
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'

type SyncErrorLike = {
  errcode?: string
  name?: string
}

type StartClientOptions = Parameters<MatrixClient['startClient']>[0]
type RustCryptoCapableClient = MatrixClient & {
  getCrypto?: () => unknown
  initRustCrypto?: (args?: { useIndexedDB?: boolean }) => Promise<void>
}
type WhoamiCapableClient = MatrixClient & {
  whoami?: () => Promise<{ device_id?: string | null; user_id?: string | null }>
}

/**
 * Matrix 客户端配置接口
 */
export interface MatrixClientConfig {
  /** homeserver URL */
  homeserverUrl: string
  /** identity server URL (可选) */
  identityServerUrl?: string
  /** 设备 ID (可选) */
  deviceId?: string
  /** 访问令牌 (可选) */
  accessToken?: string
  /** 用户 ID (可选) */
  userId?: string
  /** 是否允许非安全 HTTP (可选) */
  allowInsecureHttp?: boolean
  /** Sliding Sync 配置 (可选) */
  slidingSync?: {
    /** 初始房间窗口结束索引 (默认 49，即首屏加载 50 个房间) */
    roomRangeEnd?: number
    /** 每个房间的 timeline 事件数 (默认 10) */
    timelineLimit?: number
    /** 轮询超时时间 ms (默认 30000) */
    pollTimeout?: number
  }
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

export interface RustCryptoDebugState {
  attempted: boolean
  initialized: boolean
  skippedReason: string | null
  error: string | null
  usedIndexedDB: boolean | null
}

export interface EventDecryptedDebugState {
  count: number
  lastEventId: string | null
  lastRoomId: string | null
  lastError: string | null
}

/**
 * Matrix 客户端服务
 *
 * 负责 Matrix 客户端的初始化、登录、登出和生命周期管理。
 * 内部委托给 MatrixTokenManager（token 刷新）和 MatrixSyncManager（Sliding Sync）。
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
  private client: MatrixClient | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private config: MatrixClientConfig | null = null
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  private roomListeners: Map<string, { room: Room; handlers: Map<string, (...args: unknown[]) => void> }> = new Map()
  private telemetryManager: TelemetryManager | null = null
  private observedClient: MatrixClient | null = null
  private readonly tokenManager = new MatrixTokenManager()
  private readonly syncManager = new MatrixSyncManager()

  private rustCryptoDebugState: RustCryptoDebugState = {
    attempted: false,
    initialized: false,
    skippedReason: null,
    error: null,
    usedIndexedDB: null
  }
  private eventDecryptedDebugState: EventDecryptedDebugState = {
    count: 0,
    lastEventId: null,
    lastRoomId: null,
    lastError: null
  }

  // ---- Event listeners --------------------------------------------------------

  private readonly syncListener = (state: string, prevState?: string, data?: unknown) => {
    this.emit('sync', { state, prevState, data })

    if (state === 'ERROR') {
      const errorData = data as SyncErrorLike | undefined
      if (errorData?.errcode === 'M_LIMIT_EXCEEDED' || errorData?.name === 'ConnectionError') {
        // 限流/超时是常见暂时性问题，不输出日志避免刷屏
      } else {
        logger.error(`同步错误: ${state}`, {
          prevState,
          errcode: errorData?.errcode,
          errorName: errorData?.name
        })
      }
    } else if (state !== prevState) {
      logger.info(`同步状态: ${state}`)
    }

    const nextConnectionState = this.mapSyncStateToConnectionState(state)
    if (nextConnectionState) {
      this.updateConnectionState(nextConnectionState)
    }

    if (state === 'PREPARED' || state === 'SYNCING') {
      this.syncManager.markReady()
    }
  }

  private readonly roomListener = (room: Room) => {
    this.emit('room', room)

    const homeserverUrl = this.client?.getHomeserverUrl() || ''

    const updateRoom = () => {
      void matrixWorkerHost
        .upsertSearchRooms([
          {
            roomId: room.roomId,
            name: room.name,
            avatarUrl: room.getAvatarUrl(homeserverUrl, 48, 48, 'crop') || undefined,
            memberCount: room.getJoinedMemberCount()
          }
        ])
        .catch(() => {
          // Worker 转发失败不输出日志，避免刷屏
        })
    }

    updateRoom()

    const roomAny = room as unknown as {
      on: (event: string, handler: (...args: unknown[]) => void) => void
      off: (event: string, handler: (...args: unknown[]) => void) => void
    }
    if (typeof roomAny.on === 'function') {
      const roomNameHandler: (...args: unknown[]) => void = () => updateRoom()
      const roomStateEventsHandler: (...args: unknown[]) => void = (event: unknown) => {
        const matrixEvent = event as MatrixEvent
        const type = matrixEvent.getType()
        if (type === 'm.room.avatar' || type === 'm.room.name' || type === 'm.room.member') {
          updateRoom()
        }
      }

      roomAny.on('Room.name', roomNameHandler)
      roomAny.on('RoomState.events', roomStateEventsHandler)

      this.roomListeners.set(room.roomId, {
        room,
        handlers: new Map([
          ['Room.name', roomNameHandler],
          ['RoomState.events', roomStateEventsHandler]
        ])
      })
    }
  }

  private readonly roomTimelineListener = (event: MatrixEvent, room: Room | undefined) => {
    this.emit('timeline', { event, room })

    if (event.getType() === 'm.room.message' && event.getContent().msgtype === 'm.text') {
      const searchEventDoc: SearchEventDoc = {
        eventId: event.getId()!,
        roomId: event.getRoomId()!,
        sender: event.getSender()!,
        timestamp: event.getTs(),
        msgtype: 'm.text',
        body: event.getContent().body as string
      }
      void matrixWorkerHost.upsertSearchEvents([searchEventDoc]).catch(() => {
        // Worker 转发失败不输出日志，避免刷屏
      })
    }
  }

  private readonly redactionListener = (...args: unknown[]) => {
    const event = args[0] as MatrixEvent
    const redactedEventId = event.getAssociatedId()
    if (redactedEventId) {
      void matrixWorkerHost.redactSearchEvent(redactedEventId).catch(() => {
        // Worker 转发失败不输出日志，避免刷屏
      })
    }
  }

  private readonly eventDecryptedListener = (event: MatrixEvent, err?: Error) => {
    const roomId = event.getRoomId()
    const room = roomId ? this.client?.getRoom(roomId) : undefined
    this.eventDecryptedDebugState = {
      count: this.eventDecryptedDebugState.count + 1,
      lastEventId: event.getId() ?? null,
      lastRoomId: roomId ?? null,
      lastError: err?.message ?? null
    }
    this.emit('eventDecrypted', { event, err, room })
  }

  private readonly typingListener = (...args: unknown[]) => {
    const room = args[1] as Room | undefined
    if (room) {
      useMitt.emit(MittEnum.ROOM_TYPING_CHANGED, { roomId: room.roomId })
    }
  }

  private readonly receiptListener = (...args: unknown[]) => {
    const room = args[1] as Room | undefined
    if (room) {
      useMitt.emit(MittEnum.ROOM_RECEIPT_CHANGED, { roomId: room.roomId })
    }
  }

  constructor() {
    logger.info?.('Matrix 客户端服务初始化')
  }

  // ---- HTTP fallback login helpers --------------------------------------------

  private async loginByHttpFallback(username: string, password: string, deviceName?: string): Promise<LoginResponse> {
    if (!this.config?.homeserverUrl) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
    }

    const url = `${this.config.homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`
    const body = JSON.stringify({
      type: 'm.login.password',
      user: username,
      password,
      initial_device_display_name: deviceName || 'HuLa Client'
    })
    return this.loginRequestWithRetry(url, body)
  }

  private async tokenLoginByHttpFallback(loginToken: string): Promise<LoginResponse> {
    if (!this.config?.homeserverUrl) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.client_config_missing'))
    }

    const url = `${this.config.homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`
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
   * Detaches old event listeners, registers manager extensions,
   * creates a MatrixClient, and sets up the accessor.
   *
   * @throws {Error} if client creation fails.
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    try {
      if (this.observedClient) {
        this.detachEventListeners(this.observedClient)
        this.observedClient = null
      }

      this.syncManager.stop()
      this.config = config
      this.connectionState = 'CONNECTING'
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: null,
        error: null,
        usedIndexedDB: null
      }
      this.eventDecryptedDebugState = {
        count: 0,
        lastEventId: null,
        lastRoomId: null,
        lastError: null
      }

      try {
        await initializeManagerExtensions()
        logger.info('Manager 扩展注册完成')
      } catch (extErr) {
        logger.error('Manager 扩展注册失败:', extErr)
      }

      const clientOpts: ICreateClientOpts = {
        baseUrl: config.homeserverUrl,
        deviceId: config.deviceId,
        accessToken: config.accessToken,
        userId: config.userId,
        useAuthorizationHeader: true,
        allowInsecureHttp: config.allowInsecureHttp,
        fetchFn: getRuntimeAwareFetchFn()
      }

      if (config.identityServerUrl) {
        clientOpts.idBaseUrl = config.identityServerUrl
      }

      setMatrixClientAccessor({
        getClient: () => this.client,
        getAccessToken: () => this.client?.getAccessToken() ?? null,
        getHomeserverUrl: () => this.client?.getHomeserverUrl() ?? null,
        waitForClientReady: (opts) => this.waitForClientReady(opts)
      })

      this.client = createClient(clientOpts)
      logger.info(`客户端初始化完成: ${config.homeserverUrl}`)
    } catch (err) {
      this.connectionState = 'ERROR'
      logger.error('客户端初始化失败:', err)
      throw err
    }
  }

  // ---- Auth / Login -----------------------------------------------------------

  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    if (!this.client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.connectionState = 'CONNECTING'
      let loginResponse: LoginResponse

      try {
        loginResponse = await this.client.loginRequest({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: username },
          password,
          initial_device_display_name: deviceName || 'HuLa Client'
        })
      } catch (error) {
        const errInfo = error instanceof Error ? error.message : String(error)
        const httpStatus = (error as { httpStatus?: number })?.httpStatus
        const errcode = (error as { errcode?: string })?.errcode
        logger.warn(`SDK 密码登录失败 (status=${httpStatus}, errcode=${errcode}): ${errInfo}，尝试 HTTP 回退`)
        loginResponse = await this.loginByHttpFallback(username, password, deviceName)
      }

      await this.initialize({
        ...this.config!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.connectionState = 'CONNECTED'
      const expiresInMs = loginResponse.expires_in_ms ?? 0
      if (loginResponse.refresh_token && expiresInMs > 0) {
        this.tokenManager.schedule(this.client!, loginResponse.refresh_token, expiresInMs)
      }

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : '登录失败'
      logger.error(`登录失败: ${errorMessage}`)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async getSSOLoginUrl(identityProviderId?: string): Promise<string> {
    if (!this.client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const loginFlow = await this.client.loginFlows()
      const ssoFlow = loginFlow.flows.find((flow: Record<string, unknown>) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_not_supported'))
      }

      const ssoUrl = this.client.getSsoLoginUrl(window.location.href, 'HuLa Client', identityProviderId)

      logger.info('获取 SSO 登录 URL 成功')
      return ssoUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取 SSO 登录 URL 失败'
      logger.error(errorMessage)
      throw err
    }
  }

  async completeSSOLogin(loginToken: string): Promise<LoginResult> {
    if (!this.client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.connectionState = 'CONNECTING'
      let loginResponse: LoginResponse

      try {
        loginResponse = await this.client.login('m.login.token', {
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
        ...this.config!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.connectionState = 'CONNECTED'
      const expiresInMs = loginResponse.expires_in_ms ?? 0
      if (loginResponse.refresh_token && expiresInMs > 0) {
        this.tokenManager.schedule(this.client!, loginResponse.refresh_token, expiresInMs)
      }

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.connectionState = 'ERROR'
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
    if (!this.config) {
      return { success: false, error: '配置未初始化' }
    }

    try {
      await this.initialize({
        ...this.config,
        accessToken: token,
        userId: userId
      })

      let resolvedDeviceId = this.client?.getDeviceId?.() ?? undefined
      if (!resolvedDeviceId) {
        resolvedDeviceId = await this.resolveTokenLoginDeviceId(userId)
        if (resolvedDeviceId) {
          await this.initialize({
            ...this.config,
            accessToken: token,
            userId,
            deviceId: resolvedDeviceId
          })
        }
      }

      this.connectionState = 'CONNECTED'

      let activeAccessToken = token
      if (refreshToken) {
        try {
          if (this.client) {
            const refreshResult = (await this.client.http.request('POST', '/refresh', undefined, {
              refresh_token: refreshToken
            })) as Record<string, unknown>

            const newAccessToken = refreshResult.access_token as string | undefined
            const newRefreshToken = refreshResult.refresh_token as string | undefined
            let newExpiresInMs = refreshResult.expires_in_ms as number | undefined
            const expiresInSec = refreshResult.expires_in as number | undefined
            if (!newExpiresInMs && expiresInSec) {
              newExpiresInMs = expiresInSec * 1000
            }

            if (newAccessToken && newExpiresInMs && newExpiresInMs > 0) {
              this.client.setAccessToken(newAccessToken)
              activeAccessToken = newAccessToken
              const uid = this.client.getUserId()
              if (uid) {
                await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? refreshToken)
              }
              this.tokenManager.schedule(this.client, newRefreshToken ?? refreshToken, newExpiresInMs)
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
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : 'Token 登录失败'
      logger.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async logout(): Promise<void> {
    if (!this.client) {
      return
    }

    this.tokenManager.clear()

    try {
      await this.client!.logout()
      await this.stopClient()
      logger.info('登出成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败'
      logger.error(errorMessage)
    } finally {
      this.syncManager.stop()
      this.observedClient = null
      this.client = null
      this.connectionState = 'DISCONNECTED'
    }
  }

  // ---- Lifecycle --------------------------------------------------------------

  private async ensureRustCrypto(): Promise<void> {
    if (!this.client || !this.config?.accessToken) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-client-or-access-token',
        error: null,
        usedIndexedDB: null
      }
      return
    }

    const cryptoClient = this.client as RustCryptoCapableClient
    if (typeof cryptoClient.getCrypto === 'function' && cryptoClient.getCrypto()) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: true,
        skippedReason: 'crypto-already-available',
        error: null,
        usedIndexedDB: null
      }
      return
    }

    if (typeof cryptoClient.initRustCrypto !== 'function') {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'init-method-unavailable',
        error: null,
        usedIndexedDB: null
      }
      return
    }

    const userId = cryptoClient.getUserId?.()
    const deviceId = cryptoClient.getDeviceId?.()
    if (!userId || !deviceId) {
      this.rustCryptoDebugState = {
        attempted: false,
        initialized: false,
        skippedReason: 'missing-user-or-device-id',
        error: null,
        usedIndexedDB: null
      }
      logger.warn('缺少 userId 或 deviceId，跳过 Rust Crypto 初始化')
      return
    }

    const useIndexedDB = typeof globalThis.indexedDB !== 'undefined'
    this.rustCryptoDebugState = {
      attempted: true,
      initialized: false,
      skippedReason: null,
      error: null,
      usedIndexedDB: useIndexedDB
    }

    try {
      await cryptoClient.initRustCrypto({
        useIndexedDB
      })
      this.rustCryptoDebugState = {
        attempted: true,
        initialized: true,
        skippedReason: null,
        error: null,
        usedIndexedDB: useIndexedDB
      }
      logger.info(`Rust Crypto 初始化完成: ${userId}/${deviceId}`)
    } catch (err) {
      this.rustCryptoDebugState = {
        attempted: true,
        initialized: false,
        skippedReason: null,
        error: err instanceof Error ? err.message : String(err),
        usedIndexedDB: useIndexedDB
      }
      logger.warn('Rust Crypto 初始化失败，继续以非加密模式启动:', err)
    }
  }

  private async resolveTokenLoginDeviceId(userId: string): Promise<string | undefined> {
    if (!this.client) {
      return undefined
    }

    const currentDeviceId = this.client.getDeviceId?.() ?? undefined
    if (currentDeviceId) {
      return currentDeviceId
    }

    const whoamiCapableClient = this.client as WhoamiCapableClient
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
    if (!this.client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    this.setupResumeListener()

    try {
      const startOpts: StartClientOptions = {
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      if (this.config?.accessToken) {
        if (!this.syncManager.get()) {
          this.syncManager.create(this.client, this.config)
        }
        this.syncManager.resetReady()
        startOpts.slidingSync = this.syncManager.get()!
      } else {
        this.syncManager.stop()
      }

      await this.ensureRustCrypto()
      this.setupEventListeners()
      await this.client!.startClient(startOpts)

      logger.info('客户端启动成功')
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      logger.error(errorMessage, err)
      throw err
    }
  }

  async stopClient(): Promise<void> {
    try {
      this.tokenManager.clear()
      if (this.client) {
        this.detachEventListeners(this.client)
        this.observedClient = null
        this.syncManager.stop()
        this.client.stopClient()
        this.connectionState = 'DISCONNECTED'
        logger.info('客户端已停止')
      }
    } catch (err) {
      logger.error('停止客户端失败:', err)
      throw err
    }
  }

  private setupResumeListener(): void {
    setupSystemResumeListener(() => {
      if (this.client && this.connectionState === 'CONNECTED') {
        this.forceReconnect()
      }
    })
  }

  private async forceReconnect(): Promise<void> {
    if (!this.client) return

    try {
      logger.info('[LIFECYCLE] Stopping current sync for reconnect')
      this.client.stopClient()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      this.connectionState = 'RECONNECTING'

      const startOpts: StartClientOptions = {
        initialSyncLimit: 10,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      if (this.config?.accessToken) {
        if (!this.syncManager.get()) {
          this.syncManager.create(this.client, this.config)
        }
        this.syncManager.resetReady()
        startOpts.slidingSync = this.syncManager.get()!
      }

      this.client.startClient(startOpts)
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      this.connectionState = 'ERROR'
    }
  }

  // ---- Connection state -------------------------------------------------------

  updateConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return
    this.connectionState = state
    this.emit('connectionState', { state })
    logger.info(`连接状态已更新: ${state}`)
  }

  private mapSyncStateToConnectionState(state: string): ConnectionState | null {
    switch (state) {
      case 'PREPARED':
      case 'SYNCING':
      case 'CATCHUP':
        return 'CONNECTED'
      case 'RECONNECTING':
        return 'RECONNECTING'
      case 'ERROR':
        return 'ERROR'
      case 'STOPPED':
        return 'DISCONNECTED'
      default:
        return null
    }
  }

  // ---- Accessors --------------------------------------------------------------

  getClient(): MatrixClient | null {
    return this.client
  }

  async waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
    if (this.client) return this.client
    const timeoutMs = opts?.timeoutMs ?? 5000
    const intervalMs = opts?.intervalMs ?? 50
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.client) return this.client
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(useI18nGlobal().t('matrix_error.client.not_ready_timeout'))
  }

  getSlidingSync(): SlidingSync | null {
    return this.syncManager.get()
  }

  getRustCryptoDebugState(): RustCryptoDebugState {
    return { ...this.rustCryptoDebugState }
  }

  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return { ...this.eventDecryptedDebugState }
  }

  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    return this.syncManager.waitForReady(timeoutMs)
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  getUserId(): string | null {
    return this.client?.getUserId() ?? null
  }

  getAccessToken(): string | null {
    return this.client?.getAccessToken?.() ?? this.config?.accessToken ?? null
  }

  getHomeserverUrl(): string | null {
    return this.client?.getHomeserverUrl?.() ?? this.config?.homeserverUrl ?? null
  }

  getDeviceId(): string | null {
    return this.client?.getDeviceId() ?? null
  }

  getUser(userId: string): User | null {
    return this.client?.getUser(userId) ?? null
  }

  isRoomEncrypted(roomId: string): boolean {
    return this.client?.isRoomEncrypted?.(roomId) ?? false
  }

  // ---- Space management -------------------------------------------------------

  private static readonly DEFAULT_MODERATOR_POWER_LEVEL = 50

  canManageSpace(spaceId: string): boolean {
    if (!this.client || !spaceId) return false

    const userId = this.client.getUserId()
    const room = this.client.getRoom(spaceId)
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
    if (!this.client) return []

    const results: Array<{
      name: string
      stats: { total: number; successful: number; failed: number; retried: number }
    }> = []
    const getterNames = this.extractManagerGetterNames(this.client)

    for (const getterName of getterNames) {
      const getter = (this.client as unknown as Record<string, unknown>)[getterName]
      if (typeof getter !== 'function') continue
      try {
        const manager = (getter as () => unknown).call(this.client)
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
    return this.client?.getRooms() ?? []
  }

  getRoom(roomId: string): Room | null {
    return this.client?.getRoom(roomId) ?? null
  }

  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    if (!this.client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await this.client.createRoom(options)
      logger.info(`创建房间成功: ${response.room_id}`)
      const room = this.client.getRoom(response.room_id)
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
    if (!this.client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await this.client!.joinRoom(roomId)
      logger.info(`加入房间成功: ${roomId}`)
      const room = this.client!.getRoom(roomId)
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
    if (!this.client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await this.client!.leave(roomId)
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
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  private emit(event: string, ...data: unknown[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(...data))
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return

    const client = this.client as MatrixClient
    if (this.observedClient === client) {
      return
    }

    if (this.observedClient) {
      this.detachEventListeners(this.observedClient)
    }

    client.on('sync', this.syncListener)
    client.on('room', this.roomListener)
    client.on('room_timeline', this.roomTimelineListener)
    client.on('Event.redaction', this.redactionListener)
    client.on('Event.decrypted', this.eventDecryptedListener as never)
    client.on('Room.typing', this.typingListener)
    client.on('Room.receipt', this.receiptListener)
    this.observedClient = client
  }

  private detachEventListeners(client: MatrixClient): void {
    client.off('sync', this.syncListener)
    client.off('room', this.roomListener)
    client.off('room_timeline', this.roomTimelineListener)
    client.off('Event.redaction', this.redactionListener)
    client.off('Event.decrypted', this.eventDecryptedListener as never)
    client.off('Room.typing', this.typingListener)
    client.off('Room.receipt', this.receiptListener)
    this.detachRoomListeners()
  }

  private detachRoomListeners(): void {
    for (const [, entry] of this.roomListeners) {
      const roomAny = entry.room as unknown as {
        off: (event: string, handler: (...args: unknown[]) => void) => void
      }
      if (typeof roomAny.off === 'function') {
        for (const [event, handler] of entry.handlers) {
          roomAny.off(event, handler)
        }
      }
    }
    this.roomListeners.clear()
  }
}

export const matrixClientService = new MatrixClientService()
export default matrixClientService
