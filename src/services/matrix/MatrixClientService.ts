import {
  MatrixClient,
  Room,
  MatrixEvent,
  SlidingSync,
  createClient,
  LoginResponse,
  ICreateRoomOpts
} from 'matrix-js-sdk'
import { TelemetryManager } from 'matrix-js-sdk/src/telemetry'
import { PendingEventOrdering, ICreateClientOpts } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '@/services/matrix/network/runtimeFetch'

// 导入并初始化 Manager 扩展
import 'matrix-js-sdk/src/manager-extensions'

const logger = createLogger('MatrixClient')

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
  /** 是否允许非安全 HTTP (可选) */
  allowInsecureHttp?: boolean
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
class MatrixClientService {
  private client: MatrixClient | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private config: MatrixClientConfig | null = null
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  private slidingSyncInstance: SlidingSync | null = null
  private telemetryManager: TelemetryManager | null = null
  private observedClient: MatrixClient | null = null
  private readonly syncListener = (state: string, prevState?: string, data?: unknown) => {
    this.emit('sync', { state, prevState, data })

    // 增强错误日志
    if (state === 'ERROR') {
      logger.error(`同步错误: ${state}`, {
        prevState,
        data,
        homeserverUrl: this.config?.homeserverUrl,
        userId: this.client?.getUserId(),
        deviceId: this.client?.getDeviceId(),
        hasAccessToken: !!this.config?.accessToken,
        hasSlidingSync: !!this.slidingSyncInstance,
        connectionState: this.connectionState
      })
    } else {
      logger.info(`同步状态: ${state}`, { prevState })
    }

    // 如果启用了 Sliding Sync，由 SlidingSyncService 统一管理连接状态
    if (!this.slidingSyncInstance) {
      this.emit('connectionState', { state })
    }
  }
  private readonly roomListener = (room: Room) => {
    this.emit('room', room)
  }
  private readonly roomTimelineListener = (event: MatrixEvent, room: Room | undefined) => {
    this.emit('timeline', { event, room })
  }

  constructor() {
    logger.info('Matrix 客户端服务初始化')
  }

  private isMatrixApiError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }

    return 'errcode' in error || 'httpStatus' in error
  }

  private async loginByHttpFallback(username: string, password: string, deviceName?: string): Promise<LoginResponse> {
    if (!this.config?.homeserverUrl) {
      throw new Error('客户端配置缺失，无法执行登录回退请求')
    }

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch(`${this.config.homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'm.login.password',
        user: username,
        password,
        initial_device_display_name: deviceName || 'HuLa Client'
      })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `登录失败 (${response.status})`)
    }

    return (await response.json()) as LoginResponse
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
   * 私有方法，在 startClient() 时调用
   */
  private createSlidingSync(): SlidingSync {
    if (!this.client || !this.config) {
      throw new Error('客户端未初始化')
    }

    const lists = new Map()
    lists.set('default', {
      ranges: [[0, 20]],
      sort: ['by_recency'],
      timeline_limit: 10,
      required_state: [
        ['m.room.name', ''],
        ['m.room.avatar', ''],
        ['m.room.encryption', ''],
        ['m.room.member', '*']
      ]
    })

    const slidingSync = new SlidingSync(
      this.config.homeserverUrl,
      lists,
      {
        timeline_limit: 10,
        required_state: [
          ['m.room.name', ''],
          ['m.room.avatar', ''],
          ['m.room.encryption', ''],
          ['m.room.member', '*']
        ]
      },
      this.client,
      30000
    )

    logger.info('Sliding Sync 实例已创建')
    return slidingSync
  }

  /**
   * 使用用户名密码登录
      throw err
    }
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
        if (this.isMatrixApiError(error)) {
          throw error
        }

        logger.warn('SDK 密码登录失败，尝试使用 HTTP 回退登录', error)
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
      throw new Error('客户端未初始化')
    }

    try {
      const loginFlow = await this.client.loginFlows()
      const ssoFlow = loginFlow.flows.find((flow: Record<string, unknown>) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error('服务器不支持 SSO 登录')
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
      const loginResponse: LoginResponse = await this.client.login('m.login.token', {
        token: loginToken
      })

      this.connectionState = 'CONNECTED'
      logger.info(`SSO 登录成功: ${loginResponse.user_id}`)

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
  async startClient(): Promise<void> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      let shouldStartSlidingSync = false

      // 在启动客户端前创建 Sliding Sync 实例
      // 此时已经有了有效的 accessToken
      if (!this.slidingSyncInstance && this.config?.accessToken) {
        this.slidingSyncInstance = this.createSlidingSync()
        shouldStartSlidingSync = true
        logger.info('Sliding Sync 已启用')
      }

      await this.client!.startClient({
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached
      })

      if (this.slidingSyncInstance && shouldStartSlidingSync) {
        this.slidingSyncInstance.start()
        logger.info('Sliding Sync 已启动')
      }

      this.connectionState = 'CONNECTED'
      this.setupEventListeners()

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

  /**
   * 获取 Matrix 客户端实例
   *
   * @returns Matrix 客户端实例，如果未初始化则返回 null
   */
  getClient(): MatrixClient | null {
    return this.client
  }

  /**
   * 获取 Sliding Sync 实例
   */
  getSlidingSync(): SlidingSync | null {
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
  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      const response = await this.client.createRoom(options)
      logger.info(`创建房间成功: ${response.room_id}`)
      const room = this.client.getRoom(response.room_id)
      if (!room) {
        throw new Error('创建房间后无法获取房间实例')
      }
      return room
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建房间失败'
      logger.error(errorMessage)
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
      logger.info(`加入房间成功: ${roomId}`)
      const room = this.client!.getRoom(roomId)
      if (!room) {
        throw new Error('加入房间后无法获取房间实例')
      }
      return room
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加入房间失败'
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
      throw new Error('客户端未初始化')
    }

    try {
      await this.client!.leave(roomId)
      logger.info(`离开房间成功: ${roomId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '离开房间失败'
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
    this.observedClient = client
  }

  private detachEventListeners(client: MatrixClient): void {
    client.off('sync', this.syncListener)
    client.off('room', this.roomListener)
    client.off('room_timeline', this.roomTimelineListener)
  }
}

export const matrixClientService = new MatrixClientService()
export default matrixClientService
