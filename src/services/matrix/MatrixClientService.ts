import * as sdk from 'matrix-js-sdk'
import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk'
import { TelemetryManager } from 'matrix-js-sdk/src/telemetry'
import { PendingEventOrdering, ICreateClientOpts } from '@/types/matrix-js-sdk'
import { ExtendedMatrixClientForEvents } from '@/types/matrix-api'
import { info, warn } from '@tauri-apps/plugin-log'
import { BaseManager } from './BaseManager'

import 'matrix-js-sdk/src/manager-extensions'
import { extendMatrixClientWithManagers } from 'matrix-js-sdk/src/manager-extensions'

import matrixPresenceService from './MatrixPresenceService'
import matrixKeyBackupService from './MatrixKeyBackupService'
import matrixVerificationService from './MatrixVerificationService'
import matrixSecureBackupService from './MatrixSecureBackupService'
import matrixAccountDataService from './MatrixAccountDataService'
import matrixRendezvousService from './MatrixRendezvousService'
import { matrixBeaconService } from './MatrixBeaconService'
import { matrixLocationService } from './MatrixLocationService'
import matrixThreadService from './MatrixThreadService'
import matrixKeyRotationService from './MatrixKeyRotationService'
import matrixBurnAfterReadService from './MatrixBurnAfterReadService'
import matrixPinnedEventsService from './MatrixPinnedEventsService'
import matrixWidgetService from './MatrixWidgetService'
import matrixAIConnectionService from './MatrixAIConnectionService'
import matrixGuestService from './MatrixGuestService'

/**
 * 连接状态类型
 */
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'

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
class MatrixClientService extends BaseManager {
  private client: MatrixClient | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private config: MatrixClientConfig | null = null
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  private slidingSyncInstance: any = null
  private telemetryManager: TelemetryManager | null = null
  // 存储 SDK 事件监听器引用，用于清理
  private sdkEventHandlers: Map<string, (...args: unknown[]) => void> = new Map()
  private tokenRefreshTimer: number | null = null
  private refreshToken: string | null = null
  private _tokenExpiresIn: number | null = null
  private _tokenStartTime: number | null = null

  constructor() {
    super()
    info('[MatrixClient] Matrix 客户端服务初始化')
  }

  /**
   * 获取 Telemetry 实例
   */
  getTelemetry(): TelemetryManager | null {
    return this.telemetryManager
  }

  /**
   * 启动 Token 自动刷新
   *
   * @param expiresIn - Token 过期时间（毫秒）
   * @param refreshToken - Refresh Token
   */
  private startTokenRefresh(expiresIn: number, refreshToken?: string): void {
    this._tokenExpiresIn = expiresIn
    this._tokenStartTime = Date.now()
    this.refreshToken = refreshToken || null

    // 清除旧的定时器
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer)
    }

    // 在 Token 过期前 5 分钟刷新（移动端提前 10 分钟）
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    const refreshBuffer = isMobile ? 10 * 60 * 1000 : 5 * 60 * 1000
    let refreshInterval = expiresIn - refreshBuffer

    // 确保刷新间隔至少为 1 分钟
    if (refreshInterval < 60000) {
      refreshInterval = 60000
    }

    if (refreshInterval > 0) {
      this.tokenRefreshTimer = window.setInterval(async () => {
        await this.refreshAccessToken()
      }, refreshInterval)

      info(`[MatrixClient] Token 自动刷新已启动，将在 ${Math.floor(refreshInterval / 1000 / 60)} 分钟后刷新`)
    }
  }

  /**
   * 停止 Token 自动刷新
   */
  private stopTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }
    this._tokenExpiresIn = null
    this.refreshToken = null
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.client || !this.refreshToken) {
      warn('[MatrixClient] 无法刷新 Token：客户端未初始化或无 Refresh Token')
      return false
    }

    const startTime = performance.now()

    try {
      info('[MatrixClient] 开始刷新 Access Token')

      const result = await this.client.refreshAccessToken(this.refreshToken)

      const duration = performance.now() - startTime

      // 更新 Token
      if (result.access_token) {
        this.client.http.opts.accessToken = result.access_token
        info('[MatrixClient] Access Token 刷新成功')
      }

      // 更新 Refresh Token（如果服务器返回了新的）
      if (result.refresh_token) {
        this.refreshToken = result.refresh_token
      }

      // 重新启动刷新定时器
      if (result.expires_in_ms) {
        this.startTokenRefresh(result.expires_in_ms, this.refreshToken || undefined)
      }

      // 性能监控：记录刷新耗时
      this.telemetryManager?.track('token_refresh_success', {
        duration_ms: duration,
        expires_in_ms: result.expires_in_ms
      })

      // 性能告警：如果刷新时间超过 500ms，记录警告
      if (duration > 500) {
        warn(`[MatrixClient] Token 刷新耗时过长: ${duration.toFixed(2)}ms`)
        this.telemetryManager?.track('token_refresh_slow', {
          duration_ms: duration
        })
      }

      return true
    } catch (err) {
      const duration = performance.now() - startTime
      // 错误上报
      this.telemetryManager?.track('token_refresh_failed', {
        duration_ms: duration,
        error: err instanceof Error ? err.message : String(err)
      })

      // Token 刷新失败，可能需要重新登录
      this.stopTokenRefresh()
      return false
    }
  }

  /**
   * 初始化 Matrix 客户端
   *
   * @param config - 客户端配置
   * @throws {Error} 如果配置无效
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    this.config = config
    this.connectionState = 'CONNECTING'

    const clientOpts: ICreateClientOpts = {
      baseUrl: config.homeserverUrl,
      deviceId: config.deviceId,
      accessToken: config.accessToken,
      userId: config.userId,
      useAuthorizationHeader: true
    }

    if (config.identityServerUrl) {
      clientOpts.idBaseUrl = config.identityServerUrl
    }

    // Initialize temporary client to create SlidingSync instance
    const tempClient = sdk.createClient(clientOpts)

    // Detect mobile platform for optimized parameters
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    const timelineLimit = isMobile ? 10 : 20
    const requiredState = isMobile
      ? [
          ['m.room.name', ''],
          ['m.room.avatar', '']
        ]
      : [
          ['m.room.name', ''],
          ['m.room.avatar', ''],
          ['m.room.encryption', ''],
          ['m.room.member', '*']
        ]

    // Enable Sliding Sync (MSC3886)
    const lists = new Map()
    lists.set('default', {
      ranges: [[0, timelineLimit === 10 ? 10 : 20]],
      sort: ['by_recency'],
      timeline_limit: timelineLimit,
      required_state: requiredState
    })

    const SlidingSyncCtor = (sdk as any).SlidingSync
    const slidingSync = new SlidingSyncCtor(
      config.homeserverUrl,
      lists,
      {
        timeline_limit: timelineLimit,
        required_state: requiredState
      },
      tempClient,
      isMobile ? 5000 : 2000 // longer timeout for mobile
    )

    info(`[MatrixClient] Sliding Sync configured: isMobile=${isMobile}, timelineLimit=${timelineLimit}`)

    // @ts-expect-error: slidingSync is an experimental/custom property not in ICreateClientOpts
    clientOpts.slidingSync = slidingSync
    this.slidingSyncInstance = slidingSync
    this.client = sdk.createClient(clientOpts)

    // 注册所有 SDK Manager 扩展 (AI Connection, Voice, Widget, BurnAfterRead 等)
    await extendMatrixClientWithManagers()

    info(`[MatrixClient] 客户端初始化完成: ${config.homeserverUrl} (启用 Sliding Sync)`)
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
      const loginResponse: sdk.LoginResponse = await this.client.login('m.login.password', {
        user: username,
        password: password,
        initial_device_display_name: deviceName || 'HuLa Client'
      })

      info(`[MatrixClient] 登录成功: ${loginResponse.user_id}`)

      await this.initialize({
        ...this.config!,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id ?? undefined
      })

      this.connectionState = 'CONNECTED'

      // 启动 Token 自动刷新（如果服务器返回了 refresh_token 和 expires_in）
      if (loginResponse.refresh_token && loginResponse.expires_in) {
        this.startTokenRefresh(loginResponse.expires_in, loginResponse.refresh_token)
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
      throw new Error('客户端未初始化')
    }

    try {
      const loginFlow = await this.client.loginFlows()
      const ssoFlow = loginFlow.flows.find((flow: any) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error('服务器不支持 SSO 登录')
      }

      const ssoUrl = this.client.getSsoLoginUrl(window.location.href, 'HuLa Client', identityProviderId)

      info(`[MatrixClient] 获取 SSO 登录 URL 成功`)
      return ssoUrl
    } catch (err) {
      const _errorMessage = err instanceof Error ? err.message : '获取 SSO 登录 URL 失败'
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
      const loginResponse: sdk.LoginResponse = await this.client.login('m.login.token', {
        token: loginToken
      })

      this.connectionState = 'CONNECTED'
      info(`[MatrixClient] SSO 登录成功: ${loginResponse.user_id}`)

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : 'SSO 登录失败'
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
  async loginWithToken(token: string, userId: string): Promise<LoginResult> {
    if (!this.config) {
      return { success: false, error: '配置未初始化' }
    }

    try {
      await this.initialize({
        ...this.config,
        accessToken: token,
        userId: userId
      })

      this.connectionState = 'CONNECTED'
      return {
        success: true,
        userId: userId,
        accessToken: token
      }
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : 'Token 登录失败'
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

    try {
      await this.client!.logout()
      await this.stopClient()
      // 重置密钥恢复状态
      matrixKeyBackupService.resetRestoreState()
      info('[MatrixClient] 登出成功')
    } catch (err) {
      const _errorMessage = err instanceof Error ? err.message : '登出失败'
    } finally {
      this.client = null
      this.connectionState = 'DISCONNECTED'
    }
  }

  /**
   * 启动客户端
   *
   * @throws {Error} 如果客户端未初始化
   */
  async startClient(): Promise<void> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      await this.client!.startClient({
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached
      })
      this.connectionState = 'CONNECTED'
      this.setupEventListeners()
      this.initializeServices()

      // 新设备自动恢复密钥（非阻塞）
      matrixKeyBackupService.autoRestoreKeysOnNewDevice().catch((err) => {
        warn(`[MatrixClient] 密钥自动恢复失败: ${err}`)
      })

      info('[MatrixClient] 客户端启动成功')
    } catch (err) {
      this.connectionState = 'ERROR'
      const _errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      throw err
    }
  }

  /**
   * 停止客户端
   */
  async stopClient(): Promise<void> {
    if (this.client) {
      // 先清理事件监听器，防止内存泄漏
      this.cleanupEventListeners()

      this.client.stopClient()
      this.connectionState = 'DISCONNECTED'
      info('[MatrixClient] 客户端已停止')
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

  isConnected(): boolean {
    return this.client !== null
  }

  getHomeserverUrl(): string | null {
    if (!this.client) return null
    return this.client.getHomeserverUrl()
  }

  getDomain(): string | null {
    if (!this.client) return null
    return (this.client as any).getDomain?.() ?? null
  }

  async startWithToken(accessToken: string, deviceId?: string): Promise<void> {
    if (!this.client) return
    await (this.client as any).startWithToken?.(accessToken, deviceId)
  }

  /**
   * 获取客户端配置
   *
   * @returns 客户端配置，如果未初始化则返回 null
   */
  getConfig(): MatrixClientConfig | null {
    return this.config
  }

  /**
   * 注册新用户
   *
   * @param username - 用户名
   * @param password - 密码
   * @param session - 认证会话 (可选)
   * @returns 注册结果
   */
  async register(username: string, password: string, session?: string): Promise<LoginResult> {
    if (!this.client) {
      return { success: false, error: '客户端未初始化' }
    }

    try {
      this.connectionState = 'CONNECTING'
      const authData: any = session ? { session } : undefined

      const registerResponse = await this.client.register(username, password, undefined, authData)

      info(`[MatrixClient] 注册成功: ${registerResponse.user_id}`)

      await this.initialize({
        ...this.config!,
        accessToken: registerResponse.access_token,
        userId: registerResponse.user_id,
        deviceId: registerResponse.device_id ?? undefined
      })

      this.connectionState = 'CONNECTED'

      return {
        success: true,
        userId: registerResponse.user_id,
        deviceId: registerResponse.device_id,
        accessToken: registerResponse.access_token
      }
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : '注册失败'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 获取 Sliding Sync 实例
   */
  getSlidingSync(): any {
    return this.slidingSyncInstance
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
   * 获取当前设备 ID
   *
   * @returns 设备 ID，如果未登录则返回 null
   */
  getDeviceId(): string | null {
    return this.client?.getDeviceId() ?? null
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
  async createRoom(options: sdk.ICreateRoomOpts): Promise<Room> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      const response = await this.client.createRoom(options)
      info(`[MatrixClient] 创建房间成功: ${response.room_id}`)
      const room = this.client.getRoom(response.room_id)
      if (!room) {
        throw new Error('创建房间后无法获取房间实例')
      }
      return room
    } catch (err) {
      const _errorMessage = err instanceof Error ? err.message : '创建房间失败'
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
      throw new Error('客户端未初始化')
    }

    try {
      await this.client!.joinRoom(roomId)
      info(`[MatrixClient] 加入房间成功: ${roomId}`)
      const room = this.client!.getRoom(roomId)
      if (!room) {
        throw new Error('加入房间后无法获取房间实例')
      }
      return room
    } catch (err) {
      const _errorMessage = err instanceof Error ? err.message : '加入房间失败'
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
      throw new Error('客户端未初始化')
    }

    try {
      await this.client!.leave(roomId)
      info(`[MatrixClient] 离开房间成功: ${roomId}`)
    } catch (err) {
      const _errorMessage = err instanceof Error ? err.message : '离开房间失败'
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
  private initializeServices(): void {
    if (!this.client) return
    try {
      matrixPresenceService.initialize(this.client)
      matrixKeyBackupService.initialize(this.client)
      matrixVerificationService.initialize(this.client)
      matrixSecureBackupService.initialize(this.client)
      matrixAccountDataService.initialize(this.client)
      matrixRendezvousService.initialize(this.client)
      matrixBeaconService.initialize()
      matrixLocationService.initialize()
      matrixThreadService.initialize()
      matrixKeyRotationService.initialize()
      matrixBurnAfterReadService.initialize()
      matrixPinnedEventsService.initialize()
      matrixWidgetService.initialize()
      matrixAIConnectionService.initialize()
      matrixGuestService.initialize()
      info('[MatrixClient] 服务初始化完成')
    } catch (error) {
      this.handleError(error, 'initializeServices', undefined as unknown as void, false)
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return

    const client = this.client as unknown as ExtendedMatrixClientForEvents

    // 创建并存储事件处理器引用，以便后续清理
    const syncHandler = (...args: unknown[]) => {
      const state = args[0] as string
      this.emit('sync', { state })
      this.emit('connectionState', { state })
      info(`[MatrixClient] 同步状态: ${state}`)
    }
    this.sdkEventHandlers.set('sync', syncHandler)
    client.on('sync', syncHandler)

    const roomHandler = (...args: unknown[]) => {
      const room = args[0] as Room
      this.emit('room', room)
    }
    this.sdkEventHandlers.set('room', roomHandler)
    client.on('room', roomHandler)

    const timelineHandler = (...args: unknown[]) => {
      const event = args[0] as MatrixEvent
      const room = args[1] as Room | undefined
      this.emit('timeline', { event, room })
    }
    this.sdkEventHandlers.set('room_timeline', timelineHandler)
    client.on('room_timeline', timelineHandler)
  }

  /**
   * 清理 SDK 事件监听器
   * 在停止客户端或登出时调用，防止内存泄漏
   */
  private cleanupEventListeners(): void {
    if (!this.client) return

    const client = this.client as unknown as ExtendedMatrixClientForEvents

    // 移除所有已注册的事件监听器
    this.sdkEventHandlers.forEach((handler, eventName) => {
      client.off(eventName, handler)
      info(`[MatrixClient] 已移除事件监听器: ${eventName}`)
    })

    // 清空监听器引用
    this.sdkEventHandlers.clear()
  }
}

export const matrixClientService = new MatrixClientService()
export default matrixClientService
