import * as sdk from 'matrix-js-sdk'
import type { MatrixClient, ICreateClientOpts, LoginResponse, Room, MatrixEvent, ICreateRoomOpts } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

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
class MatrixClientService {
  private client: MatrixClient | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private config: MatrixClientConfig | null = null
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  constructor() {
    info('[MatrixClient] Matrix 客户端服务初始化')
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
      userId: config.userId
    }

    if (config.identityServerUrl) {
      clientOpts.idBaseUrl = config.identityServerUrl
    }

    this.client = sdk.createClient(clientOpts)
    info(`[MatrixClient] 客户端初始化完成: ${config.homeserverUrl}`)
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
      const loginResponse: LoginResponse = await this.client.login('m.login.password', {
        user: username,
        password: password,
        initial_device_display_name: deviceName || 'HuLa Client'
      })

      this.connectionState = 'CONNECTED'
      info(`[MatrixClient] 登录成功: ${loginResponse.user_id}`)

      return {
        success: true,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        accessToken: loginResponse.access_token
      }
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : '登录失败'
      error(`[MatrixClient] 登录失败: ${errorMessage}`)
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
      const ssoFlow = loginFlow.flows.find((flow) => flow.type === 'm.login.sso')

      if (!ssoFlow) {
        throw new Error('服务器不支持 SSO 登录')
      }

      const ssoUrl = this.client.getSsoLoginUrl(window.location.href, 'HuLa Client', identityProviderId)

      info(`[MatrixClient] 获取 SSO 登录 URL 成功`)
      return ssoUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取 SSO 登录 URL 失败'
      error(`[MatrixClient] ${errorMessage}`)
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
      error(`[MatrixClient] ${errorMessage}`)
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
      error(`[MatrixClient] ${errorMessage}`)
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
      await this.client.logout()
      await this.stopClient()
      info('[MatrixClient] 登出成功')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败'
      error(`[MatrixClient] ${errorMessage}`)
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
      await this.client.startClient({
        initialSyncLimit: 20,
        pendingEventOrdering: sdk.PendingEventOrdering.Detached
      })
      this.connectionState = 'CONNECTED'
      this.setupEventListeners()

      info('[MatrixClient] 客户端启动成功')
    } catch (err) {
      this.connectionState = 'ERROR'
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      error(`[MatrixClient] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 停止客户端
   */
  async stopClient(): Promise<void> {
    if (this.client) {
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
      info(`[MatrixClient] 创建房间成功: ${response.room_id}`)
      const room = this.client.getRoom(response.room_id)
      if (!room) {
        throw new Error('创建房间后无法获取房间实例')
      }
      return room
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建房间失败'
      error(`[MatrixClient] ${errorMessage}`)
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
      await this.client.joinRoom(roomId)
      info(`[MatrixClient] 加入房间成功: ${roomId}`)
      const room = this.client.getRoom(roomId)
      if (!room) {
        throw new Error('加入房间后无法获取房间实例')
      }
      return room
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加入房间失败'
      error(`[MatrixClient] ${errorMessage}`)
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
      await this.client.leave(roomId)
      info(`[MatrixClient] 离开房间成功: ${roomId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '离开房间失败'
      error(`[MatrixClient] ${errorMessage}`)
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
   */
  private setupEventListeners(): void {
    if (!this.client) return

    this.client.on(sdk.ClientEvent.Sync, (state: string) => {
      this.emit('sync', { state })
      this.emit('connectionState', { state })
      info(`[MatrixClient] 同步状态: ${state}`)
    })

    this.client.on(sdk.ClientEvent.Room, (room: Room) => {
      this.emit('room', room)
    })

    this.client.on(sdk.RoomEvent.Timeline, (event: MatrixEvent, room: Room | undefined) => {
      this.emit('timeline', { event, room })
    })
  }
}

export const matrixClientService = new MatrixClientService()
export default matrixClientService
