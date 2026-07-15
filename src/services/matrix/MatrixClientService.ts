import {
  createClient,
  type ICreateRoomOpts,
  initializeManagerExtensions,
  type LoginResponse,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  SlidingSync,
  type SlidingSync as SlidingSyncInstance,
  type User
} from 'matrix-js-sdk'
import type { TelemetryManager } from 'matrix-js-sdk/telemetry'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { setMatrixClientAccessor } from '@/services/matrix/matrixClientAccessor'
import {
  logoutExpiredSession,
  persistRefreshedToken,
  setupSystemResumeListener
} from '@/services/matrix/matrixClientPlatform'
import { getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'
import { type ICreateClientOpts, PendingEventOrdering } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import type { SearchEventDoc } from '@/workers/matrixWorkerTypes'

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
  private slidingSyncInstance: SlidingSync | null = null
  private telemetryManager: TelemetryManager | null = null
  private observedClient: MatrixClient | null = null
  private slidingSyncReadyResolve: (() => void) | null = null
  private slidingSyncReadyPromise: Promise<void> | null = null
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private isRefreshingToken = false
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
    // 状态不变时不再输出日志，避免刷屏

    const nextConnectionState = this.mapSyncStateToConnectionState(state)
    if (nextConnectionState) {
      this.updateConnectionState(nextConnectionState)
    }

    if (state === 'PREPARED' || state === 'SYNCING') {
      this.markSlidingSyncReady()
    }
  }
  private readonly roomListener = (room: Room) => {
    this.emit('room', room)

    const homeserverUrl = this.client?.getHomeserverUrl() || ''

    // 当有新房间加入时，通知搜索索引
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

    // 监听房间元数据变化
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

  /**
   * 获取 Telemetry 实例
   */
  getTelemetry(): TelemetryManager | null {
    return this.telemetryManager
  }

  /**
   * 初始化 Matrix 客户端
   *
   * @param config - 客户端配置
   * @throws {Error} 如果配置无效
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    try {
      if (this.observedClient) {
        this.detachEventListeners(this.observedClient)
        this.observedClient = null
      }

      this.slidingSyncInstance?.stop?.()
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

      // 在创建客户端之前，注册所有 Manager 扩展
      // 使用主入口的 initializeManagerExtensions 确保修改的是预打包版本的 MatrixClient.prototype
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

      // 注册全局 accessor（提前注册，getter 延迟访问 this.client）
      setMatrixClientAccessor({
        getClient: () => this.client,
        getAccessToken: () => this.client?.getAccessToken() ?? null,
        getHomeserverUrl: () => this.client?.getHomeserverUrl() ?? null,
        waitForClientReady: (opts) => this.waitForClientReady(opts)
      })

      // 不在这里创建 SlidingSync，延迟到 startClient() 时创建
      // 这样可以确保有有效的 accessToken
      this.client = createClient(clientOpts)

      logger.info(`客户端初始化完成: ${config.homeserverUrl}`)
    } catch (err) {
      this.connectionState = 'ERROR'
      logger.error('客户端初始化失败:', err)
      throw err
    }
  }

  /**
   * 创建 Sliding Sync 实例
   */
  private createSlidingSync(): SlidingSyncInstance {
    if (!this.client || !this.config) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    const slidingSyncConfig = this.config.slidingSync ?? {}
    const roomRangeEnd = slidingSyncConfig.roomRangeEnd ?? 49
    const timelineLimit = slidingSyncConfig.timelineLimit ?? 10
    const pollTimeout = slidingSyncConfig.pollTimeout ?? 30000

    const requiredState: Array<[string, string]> = [
      ['m.room.name', ''],
      ['m.room.avatar', ''],
      ['m.room.encryption', ''],
      ['m.room.create', ''],
      ['m.room.power_levels', ''],
      ['m.room.member', '*']
    ]

    const lists = new Map()
    lists.set('default', {
      ranges: [[0, roomRangeEnd]],
      sort: ['by_recency'],
      timeline_limit: timelineLimit,
      required_state: requiredState
    })

    const slidingSync = new SlidingSync(
      this.config.homeserverUrl,
      lists,
      {
        timeline_limit: timelineLimit,
        required_state: requiredState
      },
      this.client,
      pollTimeout
    )

    logger.info(
      `Sliding Sync 实例已创建 (rooms=${roomRangeEnd + 1}, timeline=${timelineLimit}, timeout=${pollTimeout}ms)`
    )
    return slidingSync
  }

  /**
   * 使用用户名密码登录
   *
   * @param username - 用户名
   * @param password - 密码
   * @param deviceName - 设备名称 (可选)
   * @returns 登录结果
   */
  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    if (!this.client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.connectionState = 'CONNECTING'
      let loginResponse: LoginResponse

      try {
        loginResponse = await this.client.login('m.login.password', {
          user: username,
          password: password,
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

      await this.initialize({
        ...this.config!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.connectionState = 'CONNECTED'
      this.scheduleTokenRefresh(loginResponse.refresh_token, loginResponse.expires_in)

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

  /**
   * 获取 SSO 登录 URL
   *
   * @param identityProviderId - 身份提供者 ID (可选)
   * @returns SSO 登录 URL
   * @throws {Error} 如果客户端未初始化或服务器不支持 SSO
   */
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

  /**
   * 完成 SSO 登录
   *
   * @param loginToken - SSO 登录令牌
   * @returns 登录结果
   */
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
      this.scheduleTokenRefresh(loginResponse.refresh_token, loginResponse.expires_in)

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
   * 使用 Token 登录
   *
   * @param token - 访问令牌
   * @param userId - 用户 ID
   * @returns 登录结果
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

      // 如果有 refresh_token，尝试获取 token 过期时间并调度刷新
      if (refreshToken) {
        try {
          if (this.client) {
            // 尝试刷新 token 以获取 expires_in 信息
            const refreshResult = (await this.client.http.request('POST', '/_matrix/client/v3/refresh', undefined, {
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
              const uid = this.client.getUserId()
              if (uid) {
                await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? refreshToken)
              }
              this.scheduleTokenRefresh(newRefreshToken ?? refreshToken, newExpiresInMs)
            }
          }
        } catch {
          // 服务器不支持 refresh 或刷新失败，不影响登录
          // Token 登录用户将使用现有 token 直到过期
        }
      }

      return {
        success: true,
        userId: userId,
        deviceId: resolvedDeviceId,
        accessToken: token
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

  /**
   * 登出
   */
  async logout(): Promise<void> {
    if (!this.client) {
      return
    }

    this.clearTokenRefreshTimer()

    try {
      await this.client!.logout()
      await this.stopClient()
      logger.info('登出成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败'
      logger.error(errorMessage)
    } finally {
      this.slidingSyncInstance?.stop?.()
      this.slidingSyncInstance = null
      this.observedClient = null
      this.client = null
      this.connectionState = 'DISCONNECTED'
    }
  }

  /**
   * 启动客户端
   *
   * @throws {Error} 如果客户端未初始化
   */
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
        this.slidingSyncInstance ??= this.createSlidingSync()
        this.resetSlidingSyncReady()
        startOpts.slidingSync = this.slidingSyncInstance
      } else {
        this.slidingSyncInstance = null
      }

      await this.ensureRustCrypto()

      // 在启动客户端之前注册事件监听器，确保不遗漏初始 sync 事件
      this.setupEventListeners()

      await this.client!.startClient(startOpts)

      // startClient 返回后 sync 可能仍在进行中，
      // 连接状态由 syncListener 中的 mapSyncStateToConnectionState 管理
      logger.info('客户端启动成功')
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      logger.error(errorMessage, err)
      throw err
    }
  }

  /**
   * 停止客户端
   */
  async stopClient(): Promise<void> {
    try {
      this.clearTokenRefreshTimer()
      if (this.client) {
        this.detachEventListeners(this.client)
        this.observedClient = null
        this.slidingSyncInstance?.stop?.()
        this.client.stopClient()
        this.connectionState = 'DISCONNECTED'
        logger.info('客户端已停止')
      }
    } catch (err) {
      logger.error('停止客户端失败:', err)
      throw err
    }
  }

  /**
   * Listen for system resume events (wake from sleep)
   * and trigger Matrix sync reconnection
   */
  private setupResumeListener(): void {
    setupSystemResumeListener(() => {
      if (this.client && this.connectionState === 'CONNECTED') {
        this.forceReconnect()
      }
    })
  }

  /**
   * Force a Matrix sync reconnection
   */
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
        this.slidingSyncInstance ??= this.createSlidingSync()
        this.resetSlidingSyncReady()
        startOpts.slidingSync = this.slidingSyncInstance
      }

      this.client.startClient(startOpts)
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      this.connectionState = 'ERROR'
    }
  }

  private scheduleTokenRefresh(refreshToken?: string, expiresInMs?: number): void {
    this.clearTokenRefreshTimer()
    if (!refreshToken || !expiresInMs || expiresInMs <= 0) return

    // Matrix 规范中 expires_in 是秒，需转换为毫秒
    // 如果值小于 1000，说明传入的是秒而非毫秒
    const expiresInMsActual = expiresInMs < 1000 ? expiresInMs * 1000 : expiresInMs
    const refreshAt = Math.max(expiresInMsActual - 60000, 30000)
    logger.info(`[TokenRefresh] 已调度 Token 刷新: ${refreshAt}ms 后 (原始值: ${expiresInMs})`)
    this.tokenRefreshTimer = setTimeout(() => {
      void this.tryRefreshToken(refreshToken)
    }, refreshAt)
  }

  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }
  }

  private async tryRefreshToken(refreshToken: string): Promise<void> {
    if (this.isRefreshingToken || !this.client) return
    this.isRefreshingToken = true

    try {
      logger.info('[TokenRefresh] 开始刷新访问令牌')
      // 使用未认证请求，因为 refresh 端点不需要旧的 access_token
      const result = (await this.client.http.request('POST', '/_matrix/client/v3/refresh', undefined, {
        refresh_token: refreshToken
      })) as Record<string, unknown>

      const newAccessToken = result.access_token as string | undefined
      const newRefreshToken = result.refresh_token as string | undefined
      // Matrix 规范中 expires_in 是秒，需转换为毫秒
      let newExpiresInMs = result.expires_in_ms as number | undefined
      const expiresInSec = result.expires_in as number | undefined
      if (!newExpiresInMs && expiresInSec) {
        newExpiresInMs = expiresInSec * 1000
      }

      if (newAccessToken) {
        const uid = this.client.getUserId()
        if (uid) {
          await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? '')
        }
        logger.info('[TokenRefresh] 访问令牌刷新成功')
        this.scheduleTokenRefresh(newRefreshToken, newExpiresInMs)
      }
    } catch (err) {
      const httpStatus = (err as { httpStatus?: number })?.httpStatus
      // 404 表示服务器不支持 refresh 端点，不应登出，只需停止后续刷新
      if (httpStatus === 404) {
        logger.warn('[TokenRefresh] 服务器不支持 Token 刷新端点 (404)，停止自动刷新')
        this.clearTokenRefreshTimer()
        return
      }
      // 429 限流，稍后重试
      if (httpStatus === 429) {
        logger.warn('[TokenRefresh] Token 刷新被限流 (429)，将在 30s 后重试')
        this.scheduleTokenRefresh(refreshToken, 30000)
        return
      }
      // 其他错误（如 M_UNKNOWN_TOKEN）才触发登出
      logger.error(`[TokenRefresh] 刷新访问令牌失败: ${err}`)
      logger.warn('[TokenRefresh] Session expired, clearing stored session')
      try {
        await logoutExpiredSession()
      } catch (err) {
        logger.warn('Cleanup error:', err)
      }
    } finally {
      this.isRefreshingToken = false
    }
  }

  /**
   * 更新连接状态并触发事件
   *
   * @param state - 新的连接状态
   */
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

  /**
   * 获取 Matrix 客户端实例
   *
   * @returns Matrix 客户端实例，如果未初始化则返回 null
   */
  getClient(): MatrixClient | null {
    return this.client
  }

  /**
   * 等待客户端就绪
   *
   * 调用方在初始化竞争窗口里需要拿到一个非 null 的 MatrixClient，
   * 该方法会以轮询方式等待 `this.client` 被赋值；超时后抛错。
   *
   * @param opts.timeoutMs 超时毫秒数，默认 5000
   * @param opts.intervalMs 轮询间隔，默认 50ms
   */
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

  /**
   * 获取 Sliding Sync 实例
   */
  getSlidingSync(): SlidingSync | null {
    return this.slidingSyncInstance
  }

  getRustCryptoDebugState(): RustCryptoDebugState {
    return { ...this.rustCryptoDebugState }
  }

  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return { ...this.eventDecryptedDebugState }
  }

  resetSlidingSyncReady(): void {
    if (this.slidingSyncReadyPromise) {
      this.slidingSyncReadyResolve?.()
    }
    this.slidingSyncReadyPromise = new Promise<void>((resolve) => {
      this.slidingSyncReadyResolve = resolve
    })
  }

  markSlidingSyncReady(): void {
    if (this.slidingSyncReadyResolve) {
      this.slidingSyncReadyResolve()
      this.slidingSyncReadyResolve = null
    }
  }

  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    if (!this.slidingSyncInstance) return false
    if (!this.slidingSyncReadyPromise) return true
    try {
      await Promise.race([
        this.slidingSyncReadyPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ])
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取当前连接状态
   *
   * @returns 连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * 获取当前用户 ID
   *
   * @returns 用户 ID，如果未登录则返回 null
   */
  getUserId(): string | null {
    return this.client?.getUserId() ?? null
  }

  /**
   * 获取当前访问令牌
   *
   * 在 client 尚未完全 ready 的恢复窗口里，优先回退到 initialize() 保存的 config。
   */
  getAccessToken(): string | null {
    return this.client?.getAccessToken?.() ?? this.config?.accessToken ?? null
  }

  /**
   * 获取当前 homeserver URL
   *
   * 在 client 尚未完全 ready 的恢复窗口里，优先回退到 initialize() 保存的 config。
   */
  getHomeserverUrl(): string | null {
    return this.client?.getHomeserverUrl?.() ?? this.config?.homeserverUrl ?? null
  }

  /**
   * 获取当前设备 ID
   *
   * @returns 设备 ID，如果未登录则返回 null
   */
  getDeviceId(): string | null {
    return this.client?.getDeviceId() ?? null
  }

  /**
   * 获取用户信息
   *
   * @param userId - 用户 ID
   * @returns 用户实例，如果不存在则返回 null
   */
  getUser(userId: string): User | null {
    return this.client?.getUser(userId) ?? null
  }

  /**
   * 同步判断房间是否已加密
   *
   * @param roomId - 房间 ID
   * @returns 是否已加密
   */
  isRoomEncrypted(roomId: string): boolean {
    return this.client?.isRoomEncrypted?.(roomId) ?? false
  }

  /**
   * 判断当前用户是否有权限管理指定 Space
   *
   * 检查用户是否已加入该 space，且 power level >= 50
   *
   * @param spaceId - Space 房间 ID
   * @returns 是否有管理权限
   */
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

  /**
   * 收集所有 Manager 的 RequestStats（供性能监控模块使用）
   *
   * @returns Manager stats 列表
   */
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

  /**
   * 获取所有房间
   *
   * @returns 房间列表
   */
  getRooms(): Room[] {
    return this.client?.getRooms() ?? []
  }

  /**
   * 获取指定房间
   *
   * @param roomId - 房间 ID
   * @returns 房间实例，如果不存在则返回 null
   */
  getRoom(roomId: string): Room | null {
    return this.client?.getRoom(roomId) ?? null
  }

  /**
   * 创建房间
   *
   * @param options - 房间创建选项
   * @returns 创建的房间
   * @throws {Error} 如果客户端未初始化或创建失败
   */
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

  /**
   * 加入房间
   *
   * @param roomId - 房间 ID 或别名
   * @returns 加入的房间
   * @throws {Error} 如果客户端未初始化或加入失败
   */
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

  /**
   * 离开房间
   *
   * @param roomId - 房间 ID
   * @throws {Error} 如果客户端未初始化或离开失败
   */
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

  /**
   * 注册事件监听器
   *
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  /**
   * 移除事件监听器
   *
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * 触发事件
   *
   * @param event - 事件名称
   * @param data - 事件数据
   */
  private emit(event: string, ...data: unknown[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(...data))
    }
  }

  /**
   * 设置 SDK 事件监听器
   * 注意: MatrixClient 继承自 EventEmitter，事件名称为字符串字面量
   */
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

    // 清理 Room 级别的事件监听器
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
