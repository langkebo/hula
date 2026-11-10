import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { ICreateRoomOpts, MatrixClient, Room, SlidingSync, TelemetryManager, User } from '@/services/matrix/sdk'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import type { CryptoLifecycleDiagnostics } from './crypto/cryptoLifecycleDiagnostics'
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
 * 解析当前窗口 label，用于坐实「多窗口各 new 一次 MatrixClientService」的窗口身份。
 * 非 Tauri 运行时（浏览器/测试）返回 'browser'；窗口上下文不可用（如测试 stub）降级为 'unknown'。
 */
function resolveCurrentWindowLabel(): string {
  if (!hasTauriRuntime()) return 'browser'
  try {
    return WebviewWindow.getCurrent().label || 'unknown'
  } catch {
    return 'unknown'
  }
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
    logger.info?.(`Matrix 客户端服务初始化 [window=${resolveCurrentWindowLabel()}]`)
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
      connectionManager: this.connectionManager,
      // 建/入房后立即订阅：滑窗只对「订阅变化」的房间强制 initial=true，
      // 否则新房间进不了 store（createRoom 的 waitForRoom 必超时）
      subscribeRoomForSync: (roomId) => this.syncManager.subscribeRoom(roomId)
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

  /** 启动客户端同步。内部有幂等守卫：并发或重复调用不会重复触发 crypto 初始化与 SDK startClient。 */
  async startClient(): Promise<void> {
    return this.lifecycle.startClient()
  }

  /** 停止同步并释放 crypto 绑定；可重复调用，不抛错。 */
  async stopClient(): Promise<void> {
    return this.lifecycle.stopClient()
  }

  /** 轮询等待 client 就绪，超时或间隔可配；超时抛错。 */
  async waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
    return this.lifecycle.waitForClientReady(opts)
  }

  /** 等待 Sliding Sync 就绪，返回是否在超时内完成（不抛错）。 */
  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    return this.lifecycle.waitForSlidingSyncReady(timeoutMs)
  }

  /** 用 access token 通过 whoami 解析身份（userId/deviceId），失败返回空对象。 */
  async resolveIdentityByWhoami(token: string, homeserverUrl: string): Promise<{ userId?: string; deviceId?: string }> {
    return this.lifecycle.resolveIdentityByWhoami(token, homeserverUrl)
  }

  // ---- Auth / Login -----------------------------------------------------------

  /** 密码登录。返回结果里带 refreshToken —— 它只在登录响应出现一次，调用方需自行持久化。 */
  async login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
    return this.auth.login(username, password, deviceName)
  }

  /** 注册并登录访客账号 */
  async registerGuest(deviceName?: string): Promise<LoginResult> {
    return this.auth.registerGuest(deviceName)
  }

  /** 生成 SSO 登录地址（含回调重定向与 state 校验）。 */
  async getSSOLoginUrl(): Promise<string> {
    return this.auth.getSSOLoginUrl()
  }

  /** 用 SSO 回调带回的 loginToken 完成登录。 */
  async completeSSOLogin(loginToken: string): Promise<LoginResult> {
    return this.auth.completeSSOLogin(loginToken)
  }

  /** 使用访问令牌登录
   */
  async loginWithToken(token: string, userId: string, refreshToken?: string): Promise<LoginResult> {
    return this.auth.loginWithToken(token, userId, refreshToken)
  }

  /** 登出：撤销服务端会话并清理本地加密状态、缓存与凭据。 */
  async logout(): Promise<void> {
    return this.auth.logout()
  }

  // ---- State / Accessors ------------------------------------------------------

  /** 取 SDK 的 telemetry manager；未启用时返回 null。 */
  getTelemetry(): TelemetryManager | null {
    return this.telemetry.getTelemetry()
  }

  /** 手动改写连接状态并广播 `connectionState` 事件（重连流程使用）。 */
  updateConnectionState(state: ConnectionState): void {
    this.state.updateConnectionState(state)
  }

  /** 取当前 SDK client；尚未初始化时返回 null。 */
  getClient(): MatrixClient | null {
    return this.state.getClient()
  }

  /** 取 Sliding Sync 实例；未启用或未就绪时返回 null。 */
  getSlidingSync(): SlidingSync | null {
    return this.state.getSlidingSync()
  }

  /**
   * 把「当前正在看的房间」同步给滑窗订阅。
   *
   * 订阅后服务端会为该房间下发更完整的 `required_state` + `timeline`；
   * 不订阅时只能拿到列表档位的 `timeline_limit`，且新房间根本不会进 store。
   */
  setActiveSyncRoom(roomId: string | null): void {
    this.syncManager.setActiveRoom(roomId)
  }

  /** 取 Rust Crypto 初始化的调试快照（是否成功、跳过原因、错误）。 */
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

  /** 取事件解密路径的调试状态。 */
  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return this.state.getEventDecryptedDebugState()
  }

  /**
   * 获取 crypto 生命周期诊断（Batch 4.1）。
   *
   * 与 `getRustCryptoDebugState()` 的区别：后者只描述「本次初始化成功与否」，
   * 前者描述**生命周期失配**（解绑被拒 / 已停止的 crypto 被复用）——
   * 这两类事件此前只在日志里可见，没有运行期信号。
   */
  getCryptoLifecycleDiagnostics(): CryptoLifecycleDiagnostics {
    return this.state.getCryptoLifecycleDiagnostics()
  }

  /** 当前连接状态机的取值。 */
  getConnectionState(): ConnectionState {
    return this.state.getConnectionState()
  }

  /** 当前登录用户的 MXID；未登录时为 null。 */
  getUserId(): string | null {
    return this.state.getUserId()
  }

  /**
   * 当前 SDK client 的访问令牌；client 未就绪时为 null。
   * **不回落**配置快照 —— 快照在 token 刷新后不会更新，用它发请求必然 401。
   */
  getAccessToken(): string | null {
    return this.state.getAccessToken()
  }

  /** 当前 homeserver 的 base URL。 */
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

  /** 当前设备 ID；未登录时为 null。 */
  getDeviceId(): string | null {
    return this.state.getDeviceId()
  }

  /** 按 MXID 取 SDK 的 User 对象；该用户不在本地已知集合中时返回 null。 */
  getUser(userId: string): User | null {
    return this.state.getUser(userId)
  }

  /** 判断房间是否启用加密。 */
  isRoomEncrypted(roomId: string): boolean {
    return this.state.isRoomEncrypted(roomId)
  }

  // ---- Room operations --------------------------------------------------------

  /** 取已加入的房间列表。 */
  getRooms(): Room[] {
    return this.roomOps.getRooms()
  }

  /** 按 roomId 取房间；不存在或未加入时返回 null。 */
  getRoom(roomId: string): Room | null {
    return this.roomOps.getRoom(roomId)
  }

  /**
   * 订阅房间的滑窗数据（幂等）。
   *
   * 服务端只在 pos 缺省或订阅集合变化时下发 `initial: true`，而 `SlidingSyncSdk.onRoomData`
   * 对 store 里不存在的房间在 `initial` 不为真时直接丢弃。被邀请/被拉入的新房间必须先订阅，
   * 否则接收方永远进不了 store、看不到该会话的消息。
   */
  subscribeRoomForSync(roomId: string): void {
    this.syncManager.subscribeRoom(roomId)
  }

  /** 创建房间（preset、加密、`creation_content` 等选项透传给 SDK）。 */
  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    return this.roomOps.createRoom(options)
  }

  /** 加入房间，返回加入后的 Room 对象。 */
  async joinRoom(roomId: string): Promise<Room> {
    return this.roomOps.joinRoom(roomId)
  }

  /** 退出房间。 */
  async leaveRoom(roomId: string): Promise<void> {
    return this.roomOps.leaveRoom(roomId)
  }

  /** 判断当前用户是否有权管理该 Space（按层级与 power level）。 */
  canManageSpace(spaceId: string): boolean {
    return this.roomOps.canManageSpace(spaceId)
  }

  // ---- Manager stats ----------------------------------------------------------

  /** 各 SDK manager 的请求统计（总数/成功/失败/重试）。 */
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
