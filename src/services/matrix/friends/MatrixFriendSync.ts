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
 * 承载好友同步与事件相关逻辑：FriendManager 生命周期、轮询、事件监听、同步状态。
 * 通过构造函数注入 emit 回调，与外层服务的事件系统解耦。
 */
export class MatrixFriendSync {
  private friendManager: FriendManagerCompat | null = null
  private observedClient: MatrixClient | null = null
  private managerStarted = false
  private hasLoggedMissingFriendManager = false
  private syncState: FriendSyncState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  }
  /** 好友请求轮询定时器（后端不推送事件，需要前端定时拉取） */
  private pollTimer: ReturnType<typeof setInterval> | null = null
  /** 轮询间隔（毫秒） */
  private static readonly POLL_INTERVAL = 30_000

  constructor(private readonly emit: (event: string, data?: unknown) => void) {}

  async initialize(): Promise<void> {
    try {
      const manager = await this.ensureFriendManager(false)
      if (!manager) {
        if (!this.hasLoggedMissingFriendManager) {
          this.hasLoggedMissingFriendManager = true
          logger.info('[MatrixFriend] FriendManager 未在客户端上找到，已降级到好友 REST 接口')
        }
        // 即使 FriendManager 不可用，也启动轮询（使用 REST API）
        this.startPolling()
        return
      }
      this.hasLoggedMissingFriendManager = false
      logger.info('[MatrixFriend] FriendService 初始化完成')
    } catch (err) {
      logger.error(`[MatrixFriend] 初始化失败: ${err}`)
      throw err
    }
  }

  private getFriendManager(client: MatrixClient): FriendManagerCompat | null {
    // 优先使用 SDK 注册的 getFriendManager() 方法
    const clientWithMethods = client as unknown as Record<string, unknown>
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

  private syncFriendManager(): FriendManagerCompat | null {
    const client = matrixClientService.getClient()
    if (!client) {
      return null
    }

    const manager = this.getFriendManager(client)
    if (!manager) {
      return null
    }

    if (this.observedClient !== client || this.friendManager !== manager) {
      if (this.friendManager && this.friendManager !== manager) {
        this.stopPolling()
        this.friendManager.stop()
        this.friendManager.removeAllListeners()
      }

      this.friendManager = manager
      this.observedClient = client
      this.managerStarted = false
      this.syncState = {
        friends: [],
        incomingRequests: [],
        outgoingRequests: []
      }
      this.setupEventListeners()
    }

    return this.friendManager
  }

  async ensureFriendManager(throwOnMissing = true): Promise<FriendManagerCompat | null> {
    const manager = this.syncFriendManager()
    if (!manager) {
      if (throwOnMissing) {
        throw new Error(useI18nGlobal().t('matrix_error.friends.manager_not_initialized'))
      }
      return null
    }

    if (!this.managerStarted) {
      await manager.start()
      this.managerStarted = true
      await this.updateSyncState()
      this.startPolling()
    }

    return manager
  }

  async requireFriendManager(): Promise<FriendManagerCompat> {
    const manager = await this.ensureFriendManager(false)
    if (!manager) {
      throw new Error(useI18nGlobal().t('matrix_error.friends.manager_not_initialized'))
    }
    return manager
  }

  async updateSyncState(): Promise<void> {
    if (!this.friendManager) return
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
    }
  }

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
   * 后端 synapse-rust 不推送好友请求事件，需要前端定时拉取
   */
  private startPolling(): void {
    this.stopPolling()
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollFriendRequests()
      } catch (err) {
        logger.warn(`[MatrixFriend] 轮询好友请求失败: ${err}`)
      }
    }, MatrixFriendSync.POLL_INTERVAL)
  }

  /** 停止好友请求轮询 */
  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** 轮询好友请求，检测新增/变更的请求 */
  private async pollFriendRequests(): Promise<void> {
    const prevIncomingIds = new Set(this.syncState.incomingRequests.map((r) => r.user_id))
    const prevOutgoingIds = new Set(this.syncState.outgoingRequests.map((r) => r.user_id))

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
        logger.warn(`[MatrixFriend] REST API 轮询好友请求失败: ${err}`)
        return
      }
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
  }

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

  stop(): void {
    if (this.friendManager) {
      this.friendManager.stop()
      this.friendManager.removeAllListeners()
      this.friendManager = null
    }
    this.stopPolling()
    this.observedClient = null
    this.managerStarted = false
    this.syncState = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: []
    }
    logger.info('[MatrixFriend] FriendService 已停止')
  }
}
