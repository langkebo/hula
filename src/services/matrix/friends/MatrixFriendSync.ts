import { useI18nGlobal } from '@/services/i18n'
import type { MatrixClient } from '@/services/matrix/sdk'
import { FriendEvent } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { isFriendManagerRegistered } from '../extensions/managerExtensions'
import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import matrixClientService from '../MatrixClientService'
import {
  type FriendManagerCompat,
  type FriendSyncState,
  getRequestUserId,
  normalizeSynapseFriendRequest,
  toFriendRequest,
  toUserId
} from './friendUtils'

const logger = createLogger('MatrixFriendSync')

/**
 * FriendManager 获取结果（区分「客户端尚未创建」与「扩展真实缺失」）：
 * - no-client：client 尚未创建（未登录 / 身份变更重建窗口），属瞬时态，不应判为降级。
 * - missing：client 存在但 getFriendManager() 返回无效对象/抛错，属真实降级，回退 REST。
 * - ready：manager 可用。
 */
type FriendManagerResolution =
  | { status: 'no-client' }
  | { status: 'missing' }
  | { status: 'ready'; manager: FriendManagerCompat }

/**
 * 承载好友同步与事件相关逻辑：FriendManager 生命周期、轮询、事件监听、同步状态。
 * 通过构造函数注入 emit 回调，与外层服务的事件系统解耦。
 */
export class MatrixFriendSync {
  private static readonly POLL_INTERVAL = 30_000
  private static readonly POLL_MAX_INTERVAL = 120_000

  private friendManager: FriendManagerCompat | null = null
  private observedClient: MatrixClient | null = null
  private managerStarted = false
  private hasLoggedMissingFriendManager = false
  private syncState: FriendSyncState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  }
  /** 好友请求轮询定时器（后端不推送好友请求事件，需要前端定时拉取） */
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  /** 当前轮询间隔（毫秒），429 时自适应延长 */
  private pollIntervalMs = MatrixFriendSync.POLL_INTERVAL
  /** 连接状态变更回调引用（用于注销） */
  private connectionStateCallback: ((...args: unknown[]) => void) | null = null
  /** 防止 handleClientReady 并发重试 */
  private isRetrying = false
  /** 防止 updateSyncState 递归调用 */
  private isUpdatingSyncState = false
  /** 同步完成后抑制下一次轮询的 emit，避免 client 重置后重复触发 */
  private suppressNextPollEmit = false

  constructor(private readonly emit: (event: string, data?: unknown) => void) {}

  /** 初始化好友同步
   *
   * 注册连接状态监听器，在客户端重建后自动重试获取 FriendManager。
   * 解决客户端身份变更（重新登录）后 FriendManager 扩展丢失的问题。
   */
  async initialize(): Promise<void> {
    try {
      const resolution = this.syncFriendManager()

      // 客户端尚未创建（未登录 / 身份变更重建窗口）：FriendManager 尚不可访问。
      // 这不是「扩展缺失」的真实降级，不打印误导性的「已降级到 REST」日志；
      // 只注册连接监听，待 CONNECTED 后由 handleClientReady 重新获取 manager。
      if (resolution.status === 'no-client') {
        logger.info('[MatrixFriend] 客户端尚未就绪，暂缓 FriendManager 初始化（待连接后自动重试）')
        this.registerConnectionStateListener()
        return
      }

      if (resolution.status === 'missing') {
        this.handleMissingFriendManager()
        this.registerConnectionStateListener()
        return
      }

      // ready：启动 manager 并进入 SDK 同步路径
      this.hasLoggedMissingFriendManager = false
      await this.ensureFriendManagerStarted(resolution.manager)
      logger.info('[MatrixFriend] FriendService 初始化完成')
      // 始终注册连接状态监听，处理客户端重建后 FriendManager 丢失场景
      this.registerConnectionStateListener()
    } catch (err) {
      logger.error(`[MatrixFriend] 初始化失败: ${err}`)
      throw err
    }
  }

  /**
   * FriendManager 真实缺失（client 存在但扩展不可用）时的统一降级处理：
   * 记录「已降级到好友 REST 接口」并启动 REST 轮询（幂等，由 hasLoggedMissingFriendManager 门控）。
   * initialize() 与 handleClientReady() 共用，确保两条路径的降级行为一致。
   */
  private handleMissingFriendManager(): void {
    if (!this.hasLoggedMissingFriendManager) {
      this.hasLoggedMissingFriendManager = true
      logger.info('[MatrixFriend] FriendManager 未在客户端上找到，已降级到好友 REST 接口')
    }
    // 即使 FriendManager 不可用，也启动轮询（使用 REST API）
    this.startPolling()
  }

  private getFriendManager(client: MatrixClient): FriendManagerCompat | null {
    const clientWithMethods = client as unknown as Record<string, unknown>

    // SDK 通过 initializeManagerExtensions() 把 getFriendManager 挂到
    // MatrixClient.prototype 上（幂等，且在 createClient 之前已 await 完成），
    // 因此任意 client 实例都天然继承该访问器——「client 重建后访问器丢失」不是真实状态。
    // 这里做深检查：真实调用 getFriendManager() 并校验返回对象具备 start，
    // 避免访问器存在但工厂返回无效对象/抛错时静默失败。
    if (typeof clientWithMethods.getFriendManager === 'function') {
      try {
        const manager = clientWithMethods.getFriendManager()
        if (manager && typeof (manager as FriendManagerCompat).start === 'function') {
          return manager as FriendManagerCompat
        }
      } catch (err) {
        // FT-131-C: 记录 getFriendManager 工厂异常，避免静默吞错导致 manager 不可用原因无法排查
        logger.warn(`[MatrixFriend] getFriendManager() 工厂抛出异常: ${err}`)
      }
    }

    // 回退：检查直接挂载的 friendManager 属性（与 isFriendManagerRegistered 判定一致）
    const friendManager = clientWithMethods.friendManager
    return isFriendManagerRegistered(client) && friendManager && typeof friendManager === 'object'
      ? (friendManager as FriendManagerCompat)
      : null
  }

  private syncFriendManager(): FriendManagerResolution {
    const client = matrixClientService.getClient()
    if (!client) {
      return { status: 'no-client' }
    }

    // 客户端变更检测：当 observedClient 与当前 client 不同时，
    // 清理旧 manager 引用（旧客户端可能已被 stopClient/dispose，stop() 可能抛错）
    if (this.observedClient && this.observedClient !== client) {
      this.cleanupOldManager()
      this.observedClient = null
      this.managerStarted = false
      this.hasLoggedMissingFriendManager = false
      this.syncState = { friends: [], incomingRequests: [], outgoingRequests: [] }
      this.suppressNextPollEmit = true
    }

    const manager = this.getFriendManager(client)
    if (!manager) {
      return { status: 'missing' }
    }

    if (this.friendManager !== manager) {
      if (this.friendManager) {
        this.cleanupOldManager()
      }

      this.friendManager = manager
      this.observedClient = client
      this.managerStarted = false
      this.hasLoggedMissingFriendManager = false
      this.syncState = {
        friends: [],
        incomingRequests: [],
        outgoingRequests: []
      }
      this.setupEventListeners()
    }

    return { status: 'ready', manager: this.friendManager }
  }

  /** 安全清理旧 FriendManager（stop/removeAllListeners 可能抛错） */
  private cleanupOldManager(): void {
    if (!this.friendManager) return
    this.stopPolling()
    try {
      this.friendManager.stop()
      this.friendManager.removeAllListeners()
    } catch (err) {
      logger.warn(`[MatrixFriend] 旧 FriendManager 清理失败（可能客户端已停止）: ${err}`)
    }
    this.friendManager = null
  }

  /** 确保好友管理器已初始化
   */
  async ensureFriendManager(throwOnMissing = true): Promise<FriendManagerCompat | null> {
    const resolution = this.syncFriendManager()
    if (resolution.status !== 'ready') {
      if (throwOnMissing) {
        throw new Error(useI18nGlobal().t('matrix_error.friends.manager_not_initialized'))
      }
      return null
    }

    await this.ensureFriendManagerStarted(resolution.manager)
    return resolution.manager
  }

  /** 启动 manager 并触发首轮同步状态更新 + 启动轮询（幂等，由 managerStarted 门控） */
  private async ensureFriendManagerStarted(manager: FriendManagerCompat): Promise<void> {
    if (this.managerStarted) return
    await manager.start()
    this.managerStarted = true
    await this.updateSyncState()
    this.startPolling()
  }

  /** 获取好友管理器（不存在则抛异常）
   */
  async requireFriendManager(): Promise<FriendManagerCompat> {
    const manager = await this.ensureFriendManager(false)
    if (!manager) {
      throw new Error(useI18nGlobal().t('matrix_error.friends.manager_not_initialized'))
    }
    return manager
  }

  /** 更新同步状态（幂等，防止 SDK 事件回调递归） */
  async updateSyncState(): Promise<void> {
    if (!this.friendManager) return
    if (this.isUpdatingSyncState) return
    this.isUpdatingSyncState = true
    try {
      const results = await Promise.allSettled([
        this.friendManager.getFriends(),
        this.friendManager.getIncomingRequests(),
        this.friendManager.getOutgoingRequests()
      ])
      this.syncState = {
        friends: results[0].status === 'fulfilled' ? results[0].value : this.syncState.friends,
        incomingRequests: results[1].status === 'fulfilled' ? results[1].value : this.syncState.incomingRequests,
        outgoingRequests: results[2].status === 'fulfilled' ? results[2].value : this.syncState.outgoingRequests
      }
    } catch (err) {
      logger.error(`[MatrixFriend] 更新同步状态失败: ${err}`)
    } finally {
      this.isUpdatingSyncState = false
    }
  }

  /** 获取同步状态值
   */
  getSyncStateValue(): FriendSyncState {
    return this.syncState
  }

  private setupEventListeners(): void {
    if (!this.friendManager) return

    this.friendManager.on(FriendEvent.ListUpdated, () => {
      this.updateSyncState()
      this.emit('sync', this.syncState)
      logger.info('[MatrixFriend] 同步完成')
    })

    // Mapping legacy events to current SDK events where applicable
    // FriendAdded/FriendUpdated don't exist in SDK directly, we rely on ListUpdated
    // But we can listen to other specific events:

    this.friendManager.on(FriendEvent.Removed, (...args: unknown[]) => {
      const userId = toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('friendRemoved', userId)
      logger.info(`[MatrixFriend] 好友移除: ${userId}`)
    })

    this.friendManager.on(FriendEvent.RequestReceived, (...args: unknown[]) => {
      const request = toFriendRequest(args[0])
      if (!request) return
      this.updateSyncState()
      this.emit('requestReceived', request)
      logger.info(`[MatrixFriend] 收到好友请求: ${getRequestUserId(request)}`)
    })

    this.friendManager.on(FriendEvent.Invited, (...args: unknown[]) => {
      const userId = toUserId(args[0])
      const request = toFriendRequest(args[1])
      if (!userId || !request) return
      this.updateSyncState()
      this.emit('requestSent', request)
      logger.info(`[MatrixFriend] 发送好友请求: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Accepted, (...args: unknown[]) => {
      const userId = toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestAccepted', userId)
      logger.info(`[MatrixFriend] 好友请求已接受: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Rejected, (...args: unknown[]) => {
      const userId = toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestRejected', userId)
      logger.info(`[MatrixFriend] 好友请求已拒绝: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Cancelled, (...args: unknown[]) => {
      const userId = toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestCancelled', userId)
      logger.info(`[MatrixFriend] 好友请求已取消: ${userId}`)
    })
  }

  /**
   * 启动好友请求轮询
   * 后端 synapse-rust 不推送好友请求事件，需要前端定时拉取。
   * 使用自适应间隔：429 限流时自动延长间隔，成功后恢复。
   */
  private startPolling(): void {
    this.stopPolling()
    this.scheduleNextPoll()
  }

  private scheduleNextPoll(): void {
    this.pollTimer = setTimeout(async () => {
      try {
        const wasRateLimited = await this.pollFriendRequests()
        if (wasRateLimited) {
          this.pollIntervalMs = Math.min(this.pollIntervalMs * 2, MatrixFriendSync.POLL_MAX_INTERVAL)
          logger.info(`[MatrixFriend] 轮询间隔延长至 ${this.pollIntervalMs / 1000}s（429 限流）`)
        } else {
          this.pollIntervalMs = MatrixFriendSync.POLL_INTERVAL
        }
      } catch (err) {
        logger.warn(`[MatrixFriend] 轮询好友请求失败: ${err}`)
      }
      this.scheduleNextPoll()
    }, this.pollIntervalMs)
  }

  /** 停止好友请求轮询 */
  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** 轮询好友请求，检测新增/变更的请求。返回 true 表示被 429 限流。 */
  private async pollFriendRequests(): Promise<boolean> {
    const prevIncomingIds = new Set(this.syncState.incomingRequests.map((r) => r.user_id))
    const prevOutgoingIds = new Set(this.syncState.outgoingRequests.map((r) => r.user_id))

    let wasRateLimited = false

    if (this.friendManager && this.managerStarted) {
      // FriendManager 可用时，通过 SDK 拉取
      await this.updateSyncState()
    } else {
      // FriendManager 不可用时，通过 REST API 拉取
      try {
        const pending = await synapseFriendExtensionService.getPendingRequests()
        this.syncState = {
          ...this.syncState,
          incomingRequests: (pending.incoming ?? []).map((r) => normalizeSynapseFriendRequest(r, 'incoming')),
          outgoingRequests: (pending.outgoing ?? []).map((r) => normalizeSynapseFriendRequest(r, 'outgoing'))
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        wasRateLimited = errMsg.includes('rate_limited') || errMsg.includes('429')
        logger.warn(`[MatrixFriend] REST API 轮询好友请求失败: ${err}`)
        return wasRateLimited
      }
    }

    // 首次轮询（client 重置后）只更新状态不触发事件，避免将已有请求误识别为"新增"
    if (this.suppressNextPollEmit) {
      this.suppressNextPollEmit = false
      return false
    }

    // 检测新增的入站好友请求
    const newIncoming = this.syncState.incomingRequests.filter((r) => !prevIncomingIds.has(r.user_id))
    for (const request of newIncoming) {
      this.emit('requestReceived', request)
    }
    if (newIncoming.length > 0) {
      logger.info(`[MatrixFriend] 轮询发现 ${newIncoming.length} 个新好友请求`)
    }

    // 检测出站请求变化
    const newOutgoing = this.syncState.outgoingRequests.filter((r) => !prevOutgoingIds.has(r.user_id))
    if (newIncoming.length > 0 || newOutgoing.length > 0) {
      this.emit('sync', this.syncState)
    }

    return wasRateLimited
  }

  /** 执行好友列表同步
   */
  async sync(): Promise<void> {
    await this.requireFriendManager()

    try {
      await this.updateSyncState()
      logger.info('[MatrixFriend] 手动同步完成')
    } catch (err) {
      logger.error(`[MatrixFriend] 同步失败: ${err}`)
      throw err
    }
  }

  /** 注册连接状态监听器，客户端重建后自动重试获取 FriendManager */
  private registerConnectionStateListener(): void {
    if (this.connectionStateCallback) return
    this.connectionStateCallback = (...args: unknown[]) => {
      const data = args[0] as { state?: string } | undefined
      if (data?.state === 'CONNECTED') {
        void this.handleClientReady()
      }
    }
    matrixClientService.on('connectionState', this.connectionStateCallback)
  }

  /** 注销连接状态监听器 */
  private removeConnectionStateListener(): void {
    if (this.connectionStateCallback) {
      matrixClientService.off('connectionState', this.connectionStateCallback)
      this.connectionStateCallback = null
    }
  }

  /** 客户端就绪后重试获取 FriendManager（处理客户端重建场景） */
  private async handleClientReady(): Promise<void> {
    if (this.isRetrying) return
    const client = matrixClientService.getClient()
    if (!client) return
    // 客户端未变更且 manager 已启动 → 无需重试
    if (this.observedClient === client && this.managerStarted) return

    this.isRetrying = true
    try {
      const resolution = this.syncFriendManager()

      // 连接事件竞态：client 此刻仍未就绪，继续等待下次 CONNECTED
      if (resolution.status === 'no-client') {
        return
      }

      // 扩展真实缺失：与 initialize() 一致，warn + 降级 REST 轮询
      if (resolution.status === 'missing') {
        this.handleMissingFriendManager()
        return
      }

      // ready：manager 可用，恢复 SDK 同步路径
      await this.ensureFriendManagerStarted(resolution.manager)
      this.hasLoggedMissingFriendManager = false
      this.emit('sync', this.syncState)
      logger.info('[MatrixFriend] 客户端就绪后 FriendManager 已恢复')
    } catch (err) {
      logger.warn(`[MatrixFriend] 客户端就绪后重试获取 FriendManager 失败: ${err}`)
    } finally {
      this.isRetrying = false
    }
  }

  /** 停止好友同步
   */
  stop(): void {
    this.removeConnectionStateListener()
    this.cleanupOldManager()
    this.observedClient = null
    this.managerStarted = false
    this.isRetrying = false
    this.syncState = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: []
    }
    logger.info('[MatrixFriend] FriendService 已停止')
  }
}
