import type { ICreateRoomOpts, MatrixClient, Room, SlidingSync, TelemetryManager, User } from '@/services/matrix/sdk'
import { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import { type LoginResult, MatrixClientAuth } from './MatrixClientAuth'
import { MatrixClientLifecycle } from './MatrixClientLifecycle'
import { MatrixClientRoom } from './MatrixClientRoom'
import { MatrixClientState } from './MatrixClientState'
import { MatrixClientTelemetry } from './MatrixClientTelemetry'
import {
  type ConnectionState,
  getMatrixConnectionManager,
  type MatrixClientConfig,
  type MatrixConnectionManager
} from './MatrixConnectionManager'
import {
  type EventDecryptedDebugState,
  MatrixCryptoStateTracker,
  type RustCryptoDebugState
} from './MatrixCryptoStateTracker'
import { MatrixEventRouter } from './MatrixEventRouter'
import { MatrixSyncManager } from './MatrixSyncManager'
import { MatrixTokenManager } from './MatrixTokenManager'

export type { LoginResult } from './MatrixClientAuth'
export { resolveStableDeviceId } from './MatrixClientAuth'
export type { ConnectionState, MatrixClientConfig } from './MatrixConnectionManager'
export type { EventDecryptedDebugState, RustCryptoDebugState } from './MatrixCryptoStateTracker'

const logger = createLogger('MatrixClient')

/**
 * Matrix 客户端服务（facade）
 *
 * 编排 Matrix 客户端的初始化、登录、登出和生命周期管理。内部委托给：
 * - MatrixConnectionManager — 连接生命周期 + 状态机
 * - MatrixEventRouter — 事件路由 + room 监听器
 * - MatrixCryptoStateTracker — crypto 调试状态
 * - MatrixTokenManager — token 刷新
 * - MatrixSyncManager — Sliding Sync
 * - MatrixClientLifecycle — initialize/startClient/stopClient/forceReconnect
 * - MatrixClientAuth — login/SSO/loginWithToken/logout
 * - MatrixClientState — getClient/getConnectionState/getUserId 等查询
 * - MatrixClientRoom — getRooms/createRoom/joinRoom/leaveRoom/canManageSpace
 * - MatrixClientTelemetry — getTelemetry/getManagerStatsList
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
  private readonly connectionManager: MatrixConnectionManager = getMatrixConnectionManager()
  private readonly eventRouter = new MatrixEventRouter()
  private readonly cryptoTracker = new MatrixCryptoStateTracker()
  private readonly tokenManager = new MatrixTokenManager()
  private readonly syncManager = new MatrixSyncManager()
  // startClient 幂等守卫（IdempotencyGuard）：
  // 防止 settlePostLoginStartup / useConnectionStatus.retry / forceReconnect 并发或串行重复触发
  // ensureCrypto + SDK startClient。在 stopClient / logout / initialize 重建时 reset。
  private readonly startClientGuard = new IdempotencyGuard()

  // 子服务（facade 委托对象）
  private readonly lifecycle: MatrixClientLifecycle
  private readonly auth: MatrixClientAuth
  private readonly state: MatrixClientState
  private readonly roomOps: MatrixClientRoom
  private readonly telemetry: MatrixClientTelemetry

  constructor() {
    logger.info?.('Matrix 客户端服务初始化')
    // ConnectionManager 拥有连接状态机；将其状态变更桥接到外部事件订阅者，
    // 保持原先 updateConnectionState 触发 'connectionState' 事件的行为。
    this.connectionManager.onStateChange((state) => {
      this.eventRouter.emit('connectionState', { state })
    })

    // 实例化子服务，注入主类持有的协作模块
    this.lifecycle = new MatrixClientLifecycle({
      connectionManager: this.connectionManager,
      eventRouter: this.eventRouter,
      syncManager: this.syncManager,
      cryptoTracker: this.cryptoTracker,
      tokenManager: this.tokenManager,
      startClientGuard: this.startClientGuard
    })
    this.auth = new MatrixClientAuth({
      connectionManager: this.connectionManager,
      eventRouter: this.eventRouter,
      syncManager: this.syncManager,
      cryptoTracker: this.cryptoTracker,
      tokenManager: this.tokenManager,
      lifecycle: this.lifecycle,
      startClientGuard: this.startClientGuard
    })
    this.state = new MatrixClientState({
      connectionManager: this.connectionManager,
      syncManager: this.syncManager,
      cryptoTracker: this.cryptoTracker
    })
    this.roomOps = new MatrixClientRoom({
      connectionManager: this.connectionManager
    })
    this.telemetry = new MatrixClientTelemetry({
      connectionManager: this.connectionManager
    })
  }

  // ---- Lifecycle --------------------------------------------------------------

  /** 初始化 Matrix 客户端
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    return this.lifecycle.initialize(config)
  }

  async startClient(): Promise<void> {
    return this.lifecycle.startClient()
  }

  async stopClient(): Promise<void> {
    return this.lifecycle.stopClient()
  }

  async waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
    return this.lifecycle.waitForClientReady(opts)
  }

  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    return this.lifecycle.waitForSlidingSyncReady(timeoutMs)
  }

  // ---- Auth / Login -----------------------------------------------------------

  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    return this.auth.login(username, password, deviceName)
  }

  async getSSOLoginUrl(identityProviderId?: string): Promise<string> {
    return this.auth.getSSOLoginUrl(identityProviderId)
  }

  async completeSSOLogin(loginToken: string): Promise<LoginResult> {
    return this.auth.completeSSOLogin(loginToken)
  }

  /** 使用访问令牌登录
   */
  async loginWithToken(token: string, userId: string, refreshToken?: string): Promise<LoginResult> {
    return this.auth.loginWithToken(token, userId, refreshToken)
  }

  async logout(): Promise<void> {
    return this.auth.logout()
  }

  // ---- State / Accessors ------------------------------------------------------

  getTelemetry(): TelemetryManager | null {
    return this.telemetry.getTelemetry()
  }

  updateConnectionState(state: ConnectionState): void {
    this.state.updateConnectionState(state)
  }

  getClient(): MatrixClient | null {
    return this.state.getClient()
  }

  getSlidingSync(): SlidingSync | null {
    return this.state.getSlidingSync()
  }

  getRustCryptoDebugState(): RustCryptoDebugState {
    return this.state.getRustCryptoDebugState()
  }

  /**
   * 检查 Rust Crypto 是否已成功初始化。
   * 用于在登录后判断加密功能是否可用，若不可用则在加密房间无法发送消息。
   */
  isCryptoReady(): boolean {
    return this.state.isCryptoReady()
  }

  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return this.state.getEventDecryptedDebugState()
  }

  getConnectionState(): ConnectionState {
    return this.state.getConnectionState()
  }

  getUserId(): string | null {
    return this.state.getUserId()
  }

  getAccessToken(): string | null {
    return this.state.getAccessToken()
  }

  getHomeserverUrl(): string | null {
    return this.state.getHomeserverUrl()
  }

  /**
   * 获取当前 Matrix homeserver 的域名（server name）。
   *
   * 用于在不直接访问 SDK client 的情况下判断联邦用户等场景。
   * 客户端未初始化时返回空字符串。
   */
  getServerDomain(): string {
    return this.state.getServerDomain()
  }

  getDeviceId(): string | null {
    return this.state.getDeviceId()
  }

  getUser(userId: string): User | null {
    return this.state.getUser(userId)
  }

  isRoomEncrypted(roomId: string): boolean {
    return this.state.isRoomEncrypted(roomId)
  }

  // ---- Room operations --------------------------------------------------------

  getRooms(): Room[] {
    return this.roomOps.getRooms()
  }

  getRoom(roomId: string): Room | null {
    return this.roomOps.getRoom(roomId)
  }

  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    return this.roomOps.createRoom(options)
  }

  async joinRoom(roomId: string): Promise<Room> {
    return this.roomOps.joinRoom(roomId)
  }

  async leaveRoom(roomId: string): Promise<void> {
    return this.roomOps.leaveRoom(roomId)
  }

  canManageSpace(spaceId: string): boolean {
    return this.roomOps.canManageSpace(spaceId)
  }

  // ---- Manager stats ----------------------------------------------------------

  getManagerStatsList(): Array<{
    name: string
    stats: { total: number; successful: number; failed: number; retried: number }
  }> {
    return this.telemetry.getManagerStatsList()
  }

  // ---- Event system -----------------------------------------------------------

  on(event: string, callback: (...args: unknown[]) => void): void {
    this.eventRouter.on(event, callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.eventRouter.off(event, callback)
  }
}

// 单例：使用 globalThis 守卫，防止 Vite HMR 模块重载或动态/静态导入混用
// 导致重复实例化（两个实例会并发调用 initRustCrypto，竞争 IndexedDB 句柄）
const SINGLETON_KEY = '__TJG_MATRIX_CLIENT_SERVICE__'
const g = globalThis as Record<string, unknown>
const existing = g[SINGLETON_KEY] as MatrixClientService | undefined
export const matrixClientService = existing ?? new MatrixClientService()
if (!existing) {
  g[SINGLETON_KEY] = matrixClientService
}
export default matrixClientService
