import * as sdk from 'matrix-js-sdk'
import type {
  MatrixClient,
  ICreateClientOpts,
  LoginResponse,
  Room,
  MatrixEvent,
  ICreateRoomOpts
} from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'

export interface MatrixClientConfig {
  homeserverUrl: string
  identityServerUrl?: string
  deviceId?: string
  accessToken?: string
  userId?: string
}

export interface LoginResult {
  success: boolean
  userId?: string
  deviceId?: string
  accessToken?: string
  error?: string
}

class MatrixClientService {
  private client: MatrixClient | null = null
  private connectionState: ConnectionState = 'DISCONNECTED'
  private config: MatrixClientConfig | null = null
  private eventListeners: Map<string, Set<Function>> = new Map()

  constructor() {
    info('[MatrixClient] Matrix 客户端服务初始化')
  }

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
    } catch (err: any) {
      this.connectionState = 'ERROR'
      error(`[MatrixClient] 登录失败: ${err}`)
      return {
        success: false,
        error: err.message || '登录失败'
      }
    }
  }

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

      const ssoUrl = this.client.getSsoLoginUrl(
        window.location.href,
        'HuLa Client',
        identityProviderId
      )

      info(`[MatrixClient] 获取 SSO 登录 URL 成功`)
      return ssoUrl
    } catch (err: any) {
      error(`[MatrixClient] 获取 SSO 登录 URL 失败: ${err}`)
      throw err
    }
  }

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
    } catch (err: any) {
      this.connectionState = 'ERROR'
      error(`[MatrixClient] SSO 登录失败: ${err}`)
      return {
        success: false,
        error: err.message || 'SSO 登录失败'
      }
    }
  }

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
    } catch (err: any) {
      this.connectionState = 'ERROR'
      error(`[MatrixClient] Token 登录失败: ${err}`)
      return {
        success: false,
        error: err.message || 'Token 登录失败'
      }
    }
  }

  async logout(): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      await this.client.logout()
      await this.stopClient()
      info('[MatrixClient] 登出成功')
    } catch (err) {
      error(`[MatrixClient] 登出失败: ${err}`)
    } finally {
      this.client = null
      this.connectionState = 'DISCONNECTED'
    }
  }

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
      error(`[MatrixClient] 客户端启动失败: ${err}`)
      throw err
    }
  }

  async stopClient(): Promise<void> {
    if (this.client) {
      this.client.stopClient()
      this.connectionState = 'DISCONNECTED'
      info('[MatrixClient] 客户端已停止')
    }
  }

  getClient(): MatrixClient | null {
    return this.client
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  getUserId(): string | null {
    return this.client?.getUserId() ?? null
  }

  getDeviceId(): string | null {
    return this.client?.getDeviceId() ?? null
  }

  getRooms(): Room[] {
    return this.client?.getRooms() ?? []
  }

  getRoom(roomId: string): Room | null {
    return this.client?.getRoom(roomId) ?? null
  }

  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      const response = await this.client.createRoom(options)
      info(`[MatrixClient] 创建房间成功: ${response.room_id}`)
      return this.client.getRoom(response.room_id)!
    } catch (err) {
      error(`[MatrixClient] 创建房间失败: ${err}`)
      throw err
    }
  }

  async joinRoom(roomId: string): Promise<Room> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      await this.client.joinRoom(roomId)
      info(`[MatrixClient] 加入房间成功: ${roomId}`)
      return this.client.getRoom(roomId)!
    } catch (err) {
      error(`[MatrixClient] 加入房间失败: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      await this.client.leave(roomId)
      info(`[MatrixClient] 离开房间成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixClient] 离开房间失败: ${err}`)
      throw err
    }
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return

    this.client.on(sdk.ClientEvent.Sync, (state: string) => {
      this.emit('sync', { state })
      info(`[MatrixClient] 同步状态: ${state}`)
    })

    this.client.on(sdk.ClientEvent.Room, (room: Room) => {
      this.emit('room', room)
    })

    this.client.on(sdk.RoomEvent.Timeline, (event: MatrixEvent, room: Room | undefined) => {
      this.emit('timeline', { event, room })
    })

    this.client.on(sdk.ClientEvent.Sync, (state: string) => {
      this.emit('connectionState', { state })
      info(`[MatrixClient] 同步状态: ${state}`)
    })
  }
}

export const matrixClientService = new MatrixClientService()
export default matrixClientService
