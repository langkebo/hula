import { type Friend, FriendEvent, type FriendManager, type FriendRequest } from 'matrix-js-sdk/friend'

// 好友请求状态（发送/接受/拒绝流程中的状态）
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected'

// 好友关系状态（已建立好友关系后的分类标记）
export type FriendRelationStatus = 'favorite' | 'normal' | 'blocked' | 'hidden'

/**
 * @deprecated 请使用 `FriendRequestStatus` 或 `FriendRelationStatus` 替代。
 * 该类型混合了请求状态和关系状态，语义不清晰，将在未来版本中移除。
 */
export type FriendStatus = FriendRequestStatus | FriendRelationStatus

import type { MatrixClient } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'
import { isFriendManagerRegistered } from '../extensions/managerExtensions'
import { type SynapseDmInfo, synapseDmExtensionService } from '../extensions/SynapseDmExtensionService'
import {
  type SynapseFriendInfo,
  type SynapseFriendRequest,
  synapseFriendExtensionService
} from '../extensions/SynapseFriendExtensionService'
import matrixClientService from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import { matrixRoomActionFacade } from '../room/ActionFacade'
import { matrixSpecialFriendService } from './MatrixSpecialFriendService'

const logger = createLogger('MatrixFriendService')

export type { Friend, FriendRequest }

export interface FriendGroup {
  group_id: string
  name: string
  member_count?: number
  created_at?: number
}

export interface FriendSyncState {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
}

export type FriendServiceEventHandler = (data?: unknown) => void

type FriendManagerCompat = FriendManager & {
  updateFriendNote?: (userId: string, note: string) => Promise<void>
  setFriendNote?: (userId: string, note: string) => Promise<void>
  setFriendStatus?: (userId: string, status: FriendStatus) => Promise<void>
}

class MatrixFriendService {
  private friendManager: FriendManager | null = null
  private observedClient: MatrixClient | null = null
  private managerStarted = false
  private hasLoggedMissingFriendManager = false
  private eventListeners: Map<string, Set<FriendServiceEventHandler>> = new Map()
  private syncState: FriendSyncState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  }
  /** 好友请求轮询定时器（后端不推送事件，需要前端定时拉取） */
  private pollTimer: ReturnType<typeof setInterval> | null = null
  /** 轮询间隔（毫秒） */
  private static readonly POLL_INTERVAL = 30_000

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

  private getFriendManager(client: MatrixClient): FriendManager | null {
    // 优先使用 SDK 注册的 getFriendManager() 方法
    const clientWithMethods = client as unknown as Record<string, unknown>
    if (typeof clientWithMethods.getFriendManager === 'function') {
      try {
        const manager = clientWithMethods.getFriendManager()
        if (manager && typeof (manager as FriendManager).start === 'function') {
          return manager as FriendManager
        }
      } catch (err) {
        // FT-131-C: 记录 getFriendManager 工厂异常，避免静默吞错导致 manager 不可用原因无法排查
        logger.warn(`[MatrixFriend] getFriendManager() 工厂抛出异常: ${err}`)
      }
    }

    // 回退：检查直接挂载的 friendManager 属性（与 isFriendManagerRegistered 判定一致）
    const friendManager = clientWithMethods.friendManager
    return isFriendManagerRegistered(client) && friendManager && typeof friendManager === 'object'
      ? (friendManager as FriendManager)
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

    return this.friendManager as FriendManagerCompat
  }

  private async ensureFriendManager(throwOnMissing = true): Promise<FriendManagerCompat | null> {
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

  private async requireFriendManager(): Promise<FriendManagerCompat> {
    const manager = await this.ensureFriendManager(false)
    if (!manager) {
      throw new Error(useI18nGlobal().t('matrix_error.friends.manager_not_initialized'))
    }
    return manager
  }

  private getFriendUserId(friend: Friend): string {
    return friend.user_id ?? ''
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
    }, MatrixFriendService.POLL_INTERVAL)
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
          incomingRequests: (pending.incoming ?? []).map((r) => this.normalizeSynapseFriendRequest(r, 'incoming')),
          outgoingRequests: (pending.outgoing ?? []).map((r) => this.normalizeSynapseFriendRequest(r, 'outgoing'))
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

  private getRequestUserId(request: FriendRequest): string {
    return request.user_id ?? ''
  }

  /** 将 REST API 返回的好友请求转换为 FriendRequest 格式 */
  private normalizeSynapseFriendRequest(
    req: SynapseFriendRequest,
    direction: 'incoming' | 'outgoing' = 'incoming'
  ): FriendRequest {
    // incoming: 对方发起，user_id 取 requester
    // outgoing: 本方发起，user_id 取 recipient
    return {
      user_id: direction === 'incoming' ? req.requester : req.recipient,
      message: req.message,
      status: req.status === 'declined' ? 'rejected' : req.status,
      timestamp: req.created_ts,
      direction
    }
  }

  private normalizeFriend(friend: Friend | SynapseFriendInfo): Friend {
    const source = friend as Friend & {
      displayname?: string
      username?: string
      online?: boolean
      presence?: string
      last_active_ts?: number
    }

    return {
      ...source,
      user_id: source.user_id,
      display_name: source.display_name ?? source.displayname ?? source.username,
      avatar_url: source.avatar_url,
      since: source.since ?? source.last_active_ts,
      note: source.note,
      status: source.status,
      dm_room_id: source.dm_room_id,
      // 保留后端真实字段，供上层做 presence 初始值兜底
      ...(source.online !== undefined ? { online: source.online } : {}),
      ...(source.presence ? { presence: source.presence } : {}),
      ...(source.username ? { username: source.username } : {})
    } as Friend
  }

  private async getFriendsByFallbackApi(): Promise<Friend[]> {
    try {
      const friends = await synapseFriendExtensionService.getFriends()
      return friends.map((friend) => this.normalizeFriend(friend))
    } catch (err) {
      logger.error(`[MatrixFriend] 回退好友列表接口失败: ${err}`)
      return []
    }
  }

  private toUserId(value: unknown): string | null {
    return typeof value === 'string' ? value : null
  }

  private toFriendRequest(value: unknown): FriendRequest | null {
    return value && typeof value === 'object' ? (value as FriendRequest) : null
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
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('friendRemoved', userId)
      logger.info(`[MatrixFriend] 好友移除: ${userId}`)
    })

    this.friendManager.on(FriendEvent.RequestReceived, (...args: unknown[]) => {
      const request = this.toFriendRequest(args[0])
      if (!request) return
      this.updateSyncState()
      this.emit('requestReceived', request)
      logger.info(`[MatrixFriend] 收到好友请求: ${this.getRequestUserId(request)}`)
    })

    this.friendManager.on(FriendEvent.Invited, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      const request = this.toFriendRequest(args[1])
      if (!userId || !request) return
      this.updateSyncState()
      this.emit('requestSent', request)
      logger.info(`[MatrixFriend] 发送好友请求: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Accepted, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestAccepted', userId)
      logger.info(`[MatrixFriend] 好友请求已接受: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Rejected, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestRejected', userId)
      logger.info(`[MatrixFriend] 好友请求已拒绝: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Cancelled, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestCancelled', userId)
      logger.info(`[MatrixFriend] 好友请求已取消: ${userId}`)
    })
  }

  private async updateSyncState(): Promise<void> {
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

  async getFriends(): Promise<Friend[]> {
    try {
      const manager = await this.ensureFriendManager(false)
      if (manager) {
        const friends = await manager.getFriends()
        if (friends.length > 0) {
          return friends.map((friend) => this.normalizeFriend(friend))
        }
        logger.info('[MatrixFriend] FriendManager 返回空列表，尝试从回退 API 获取')
      } else {
        logger.info('[MatrixFriend] FriendManager 不可用，尝试从回退 API 获取')
      }
      return await this.getFriendsByFallbackApi()
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友列表失败，回退到 REST API: ${err}`)
      return await this.getFriendsByFallbackApi()
    }
  }

  async getFriend(userId: string): Promise<Friend | undefined> {
    try {
      const friends = await this.getFriends()
      return friends.find((friend) => this.getFriendUserId(friend) === userId)
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友失败: ${err}`)
      return undefined
    }
  }

  async isFriend(userId: string): Promise<boolean> {
    const manager = await this.ensureFriendManager(false)

    try {
      if (manager) {
        if (typeof manager.checkFriendship === 'function') {
          const result = await manager.checkFriendship(userId)
          return result.is_friend || result.are_friends
        }
        const friends = await manager.getFriends()
        return friends.some((f: Friend) => this.getFriendUserId(f) === userId)
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 检查好友关系失败，回退到 REST API: ${err}`)
    }

    // FriendManager 不可用时，回退到 REST API
    try {
      return await synapseFriendExtensionService.checkFriendship(userId)
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 检查好友关系也失败: ${restErr}`)
      return false
    }
  }

  async getFriendCount(): Promise<number> {
    try {
      const friends = await this.getFriends()
      return friends.length
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友数量失败: ${err}`)
      return 0
    }
  }

  async getIncomingRequests(): Promise<FriendRequest[]> {
    const manager = await this.ensureFriendManager(false)

    try {
      if (manager) {
        return await manager.getIncomingRequests()
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取入站好友请求失败，回退到 REST API: ${err}`)
    }

    // FriendManager 不可用时，回退到 REST API
    try {
      const pending = await synapseFriendExtensionService.getPendingRequests()
      return (pending.incoming ?? []).map((r) => this.normalizeSynapseFriendRequest(r, 'incoming'))
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 获取入站好友请求也失败: ${restErr}`)
      return []
    }
  }

  async getOutgoingRequests(): Promise<FriendRequest[]> {
    const manager = await this.ensureFriendManager(false)

    try {
      if (manager) {
        return await manager.getOutgoingRequests()
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取出站好友请求失败，回退到 REST API: ${err}`)
    }

    // FriendManager 不可用时，回退到 REST API
    try {
      const pending = await synapseFriendExtensionService.getPendingRequests()
      return (pending.outgoing ?? []).map((r) => this.normalizeSynapseFriendRequest(r, 'outgoing'))
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 获取出站好友请求也失败: ${restErr}`)
      return []
    }
  }

  async getSyncState(): Promise<FriendSyncState> {
    try {
      await this.updateSyncState()
      return this.syncState
    } catch (err) {
      logger.error(`[MatrixFriend] 获取同步状态失败: ${err}`)
      return this.syncState
    }
  }

  async sendFriendRequest(userId: string, reason?: string): Promise<void> {
    const manager = await this.ensureFriendManager(false)

    try {
      if (manager) {
        await manager.sendFriendRequest(userId, reason)
      } else {
        await synapseFriendExtensionService.sendFriendRequest(userId, reason)
      }
      logger.info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)

      // 409 已存在待处理的好友请求，属于正常业务场景，不应作为错误
      if (errMsg.includes('already exists') || errMsg.includes('M_USER_IN_USE') || errMsg.includes('409')) {
        logger.info(`[MatrixFriend] 好友请求已存在: ${userId}`)
        return
      }

      // FriendManager 失败时降级到 REST API
      if (manager) {
        try {
          await synapseFriendExtensionService.sendFriendRequest(userId, reason)
          logger.info(`[MatrixFriend] 发送好友请求成功(REST降级): ${userId}`)
          return
        } catch (restErr) {
          const restErrMsg = restErr instanceof Error ? restErr.message : String(restErr)
          // REST 降级也返回 409，同样属于正常场景
          if (
            restErrMsg.includes('already exists') ||
            restErrMsg.includes('M_USER_IN_USE') ||
            restErrMsg.includes('409')
          ) {
            logger.info(`[MatrixFriend] 好友请求已存在(REST): ${userId}`)
            return
          }
          logger.error(`[MatrixFriend] REST API 发送好友请求也失败: ${restErr}`)
        }
      }

      // 好友端点不可用时，回退到创建 DM 房间作为添加好友的替代方案
      if (errMsg.includes('不可用') || errMsg.includes('unavailable') || errMsg.includes('404')) {
        logger.info(`[MatrixFriend] 好友端点不可用，回退到创建 DM 房间: ${userId}`)
        try {
          await matrixRoomActionFacade.createDirectRoom(userId)
          logger.info(`[MatrixFriend] 已创建 DM 房间作为好友替代: ${userId}`)
          return
        } catch (dmErr) {
          logger.error(`[MatrixFriend] 创建 DM 房间也失败: ${dmErr}`)
        }
      }

      logger.error(`[MatrixFriend] 发送好友请求失败: ${err}`)
      throw err
    }
  }

  async acceptFriendRequest(userId: string): Promise<void> {
    try {
      const manager = await this.requireFriendManager()
      await manager.acceptFriendRequest(userId)
      logger.info(`[MatrixFriend] 接受好友请求成功: ${userId}`)
    } catch {
      await synapseFriendExtensionService.acceptFriendRequest(userId)
      logger.info(`[MatrixFriend] 接受好友请求成功(REST降级): ${userId}`)
    }
  }

  async cancelFriendRequest(userId: string): Promise<void> {
    const manager = await this.ensureFriendManager(false)

    try {
      if (manager) {
        await manager.cancelFriendRequest(userId)
        logger.info(`[MatrixFriend] 取消好友请求成功: ${userId}`)
        return
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 取消好友请求失败，回退到 REST API: ${err}`)
    }

    // FriendManager 不可用或失败时，回退到 REST API
    try {
      await synapseFriendExtensionService.cancelFriendRequest(userId)
      logger.info(`[MatrixFriend] 取消好友请求成功(REST降级): ${userId}`)
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 取消好友请求也失败: ${restErr}`)
      throw restErr
    }
  }

  async rejectFriendRequest(userId: string): Promise<void> {
    try {
      const manager = await this.requireFriendManager()
      await manager.rejectFriendRequest(userId)
      logger.info(`[MatrixFriend] 拒绝好友请求成功: ${userId}`)
    } catch {
      await synapseFriendExtensionService.declineFriendRequest(userId)
      logger.info(`[MatrixFriend] 拒绝好友请求成功(REST降级): ${userId}`)
    }
  }

  async removeFriend(userId: string): Promise<void> {
    try {
      const manager = await this.requireFriendManager()
      await manager.removeFriend(userId)
      logger.info(`[MatrixFriend] 删除好友成功: ${userId}`)
    } catch {
      await synapseFriendExtensionService.removeFriend(userId)
      logger.info(`[MatrixFriend] 删除好友成功(REST降级): ${userId}`)
    }
  }

  async setFriendDisplayName(userId: string, displayName: string): Promise<void> {
    try {
      const manager = await this.requireFriendManager()
      await manager.setFriendDisplayName(userId, displayName)
      logger.info(`[MatrixFriend] 设置好友备注成功: ${userId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  async setFriendNote(userId: string, note: string): Promise<void> {
    try {
      const manager = await this.requireFriendManager()
      if (typeof manager.updateFriendNote === 'function') {
        await manager.updateFriendNote(userId, note)
      } else if (typeof manager.setFriendNote === 'function') {
        await manager.setFriendNote(userId, note)
      } else {
        throw new Error(useI18nGlobal().t('matrix_error.friends.remark_update_unsupported'))
      }

      logger.info(`[MatrixFriend] 设置好友笔记成功: ${userId}`)
    } catch {
      await synapseFriendExtensionService.setFriendNote(userId, note)
      logger.info(`[MatrixFriend] 设置好友笔记成功(REST降级): ${userId}`)
    }
  }

  async setFriendStatus(userId: string, status: FriendStatus): Promise<void> {
    let manager: FriendManagerCompat | null = null

    try {
      if (status === 'favorite') {
        await matrixSpecialFriendService.addSpecialFriend(userId)
        logger.info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
        return
      }

      await matrixSpecialFriendService.removeSpecialFriend(userId)

      // 'accepted' 和 'normal' 是默认关系状态，无需调用后端 API
      if (status === 'accepted' || status === 'normal') {
        logger.info(`[MatrixFriend] 设置好友状态成功（本地默认状态，无需后端调用）: ${userId} -> ${status}`)
        return
      }

      manager = await this.requireFriendManager()
      if (typeof manager?.setFriendStatus !== 'function') {
        throw new Error(useI18nGlobal().t('matrix_error.friends.status_update_unsupported', { status }))
      }

      await manager.setFriendStatus(userId, status)
      logger.info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 设置好友状态失败: ${err}`)
      throw err
    }
  }

  async getSpecialFriends(): Promise<string[]> {
    try {
      return matrixSpecialFriendService.getSpecialFriends()
    } catch (err) {
      logger.error(`[MatrixFriend] 获取特别好友失败: ${err}`)
      return []
    }
  }

  async getFriendInfo(userId: string): Promise<Friend | undefined> {
    const manager = await this.requireFriendManager()

    try {
      const friend = await manager.getFriendInfo(userId)
      logger.info(`[MatrixFriend] 获取好友信息成功: ${userId}`)
      return friend ?? undefined
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友信息失败: ${err}`)
      throw err
    }
  }

  /** 获取与指定好友的 DM 房间（对应后端 GET /friends/{uid}/dm） */
  async getFriendDmRoom(userId: string): Promise<SynapseDmInfo> {
    try {
      const result = await synapseDmExtensionService.getDmRoom(userId)
      logger.info(`[MatrixFriend] 获取好友 DM 房间: userId=${userId}, roomId=${result.room_id || '(none)'}`)
      return result
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友 DM 房间失败: ${err}`)
      return { room_id: '', exists: false }
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

  async getFriendGroups(): Promise<FriendGroup[]> {
    const manager = await this.requireFriendManager()

    try {
      const groups = await (
        manager as FriendManagerCompat & {
          getFriendGroups?: () => Promise<Array<{ id: string; name: string; members?: string[]; created_at?: number }>>
        }
      ).getFriendGroups?.()
      logger.info(`[MatrixFriend] 获取好友分组成功: ${groups?.length ?? 0} 个`)
      // SDK FriendGroup.id → 前端 FriendGroup.group_id 映射
      return (groups ?? []).map((g) => ({
        group_id: g.id,
        name: g.name,
        member_count: g.members?.length,
        created_at: g.created_at
      }))
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友分组失败: ${err}`)
      throw err
    }
  }

  async createFriendGroup(name: string): Promise<FriendGroup> {
    const manager = await this.requireFriendManager()

    try {
      const result = await (
        manager as FriendManagerCompat & {
          createFriendGroup?: (name: string) => Promise<unknown>
        }
      ).createFriendGroup?.(name)
      logger.info(`[MatrixFriend] 创建好友分组成功: ${name}`)

      if (typeof result === 'string') {
        return { group_id: result, name }
      }
      const raw = (result ?? {}) as Partial<FriendGroup> & { id?: string }
      return {
        ...raw,
        group_id: raw.group_id ?? raw.id ?? '',
        name: raw.name ?? name
      }
    } catch (err) {
      logger.error(`[MatrixFriend] 创建好友分组失败: ${err}`)
      throw err
    }
  }

  async deleteFriendGroup(groupId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          deleteFriendGroup?: (groupId: string) => Promise<void>
        }
      ).deleteFriendGroup?.(groupId)
      logger.info(`[MatrixFriend] 删除好友分组成功: ${groupId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 删除好友分组失败: ${err}`)
      throw err
    }
  }

  async renameFriendGroup(groupId: string, name: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          renameFriendGroup?: (groupId: string, name: string) => Promise<void>
        }
      ).renameFriendGroup?.(groupId, name)
      logger.info(`[MatrixFriend] 重命名好友分组成功: ${groupId} -> ${name}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 重命名好友分组失败: ${err}`)
      throw err
    }
  }

  async addFriendToGroup(groupId: string, userId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          addFriendToGroup?: (groupId: string, userId: string) => Promise<void>
        }
      ).addFriendToGroup?.(groupId, userId)
      logger.info(`[MatrixFriend] 添加好友到分组成功: ${userId} -> ${groupId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 添加好友到分组失败: ${err}`)
      throw err
    }
  }

  async removeFriendFromGroup(groupId: string, userId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          removeFriendFromGroup?: (groupId: string, userId: string) => Promise<void>
        }
      ).removeFriendFromGroup?.(groupId, userId)
      logger.info(`[MatrixFriend] 从分组移除好友成功: ${userId} <- ${groupId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 从分组移除好友失败: ${err}`)
      throw err
    }
  }

  async getFriendsInGroup(groupId: string): Promise<Friend[]> {
    const manager = await this.requireFriendManager()

    try {
      const friends = await (
        manager as FriendManagerCompat & {
          getFriendsInGroup?: (groupId: string) => Promise<Friend[]>
        }
      ).getFriendsInGroup?.(groupId)
      logger.info(`[MatrixFriend] 获取分组内好友成功: ${groupId} -> ${friends?.length ?? 0} 个`)
      return friends ?? []
    } catch (err) {
      logger.error(`[MatrixFriend] 获取分组内好友失败: ${err}`)
      throw err
    }
  }

  async getFriendGroupsByUser(userId: string): Promise<FriendGroup[]> {
    const manager = await this.requireFriendManager()

    try {
      const groups = await (
        manager as FriendManagerCompat & {
          getFriendGroupsByUser?: (userId: string) => Promise<FriendGroup[]>
        }
      ).getFriendGroupsByUser?.(userId)
      logger.info(`[MatrixFriend] 获取用户所属分组成功: ${userId} -> ${groups?.length ?? 0} 个`)
      return groups ?? []
    } catch (err) {
      logger.error(`[MatrixFriend] 获取用户所属分组失败: ${err}`)
      throw err
    }
  }

  async getFriendSuggestions(): Promise<
    Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>
  > {
    const manager = await this.requireFriendManager()

    try {
      if (typeof manager.getFriendSuggestions !== 'function') {
        logger.info('[MatrixFriend] FriendManager 不支持好友建议，返回空列表')
        return []
      }
      const suggestions = await manager.getFriendSuggestions()
      logger.info(`[MatrixFriend] 获取好友建议成功: ${suggestions?.length ?? 0} 个`)
      return suggestions ?? []
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友建议失败: ${err}`)
      throw err
    }
  }

  async getFriendStatus(userId: string): Promise<FriendStatus | null> {
    const manager = await this.ensureFriendManager(false)

    try {
      if (manager && typeof manager.getFriendStatus === 'function') {
        const status = await manager.getFriendStatus(userId)
        logger.info(`[MatrixFriend] 获取好友状态成功: ${userId}`)
        return (status as FriendStatus | undefined) ?? null
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取好友状态失败，回退到 REST API: ${err}`)
    }

    try {
      const result = await synapseFriendExtensionService.checkFriendship(userId)
      return result ? 'accepted' : null
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 获取好友状态也失败: ${restErr}`)
      return null
    }
  }

  async getFriendStatusInfo(userId: string): Promise<Record<string, unknown> | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const result = (await authedRequestWithPath<Record<string, unknown>>(
        client,
        'GET',
        MATRIX_PATHS.FRIENDS.STATUS(userId)
      )) as Record<string, unknown>
      return result
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友状态详情失败: ${userId}, ${err}`)
      return null
    }
  }

  async searchFriendsViaApi(
    query: string,
    options?: { mode?: 'fuzzy' | 'exact'; limit?: number }
  ): Promise<Array<{ user_id: string; display_name?: string; avatar_url?: string }>> {
    try {
      const results = await synapseFriendExtensionService.searchFriends(query, options)
      return results.map((r) => ({
        user_id: r.user_id,
        display_name:
          ((r as unknown as Record<string, unknown>).display_name as string | undefined) ??
          ((r as unknown as Record<string, unknown>).displayname as string | undefined),
        avatar_url: r.avatar_url
      }))
    } catch (err) {
      logger.error(`[MatrixFriend] REST 搜索好友失败: ${err}`)
      return []
    }
  }

  stop(): void {
    if (this.friendManager) {
      this.friendManager.stop()
      this.friendManager.removeAllListeners()
      this.friendManager = null
    }
    this.observedClient = null
    this.managerStarted = false
    this.eventListeners.clear()
    this.syncState = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: []
    }
    logger.info('[MatrixFriend] FriendService 已停止')
  }

  on(event: string, callback: FriendServiceEventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)?.add(callback)
  }

  off(event: string, callback: FriendServiceEventHandler): void {
    this.eventListeners.get(event)?.delete(callback)
  }

  private emit(event: string, data?: unknown): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(data))
  }
}

export const matrixFriendService = new MatrixFriendService()
export default matrixFriendService
