import { FriendManager, FriendEvent, type Friend, type FriendRequest, type FriendStatus } from 'matrix-js-sdk/friend'
import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export type { Friend, FriendRequest, FriendStatus }

/**
 * 好友同步状态接口
 */
export interface FriendSyncState {
  /** 好友列表 */
  friends: Friend[]
  /** 收到的好友请求 */
  incomingRequests: FriendRequest[]
  /** 发出的好友请求 */
  outgoingRequests: FriendRequest[]
}

/**
 * 好友服务事件处理器类型
 */
export type FriendServiceEventHandler = (data?: unknown) => void

/**
 * Matrix 好友服务
 *
 * 负责好友关系管理，包括发送/接受/拒绝好友请求、好友列表同步等功能。
 *
 * @example
 * ```typescript
 * const friendService = matrixFriendService;
 *
 * // 初始化
 * await friendService.initialize();
 *
 * // 发送好友请求
 * await friendService.sendFriendRequest('@user:server', '你好');
 *
 * // 接受好友请求
 * await friendService.acceptFriendRequest('@user:server');
 *
 * // 获取好友列表
 * const friends = friendService.getFriends();
 * ```
 */
class MatrixFriendService {
  private friendManager: FriendManager | null = null
  private eventListeners: Map<string, Set<FriendServiceEventHandler>> = new Map()
  private syncState: FriendSyncState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  }

  /**
   * 初始化好友服务
   *
   * @throws {Error} 如果客户端未初始化
   */
  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    this.friendManager = this.getFriendManager(client)
    if (!this.friendManager) {
      error('[MatrixFriend] FriendManager 未在客户端上找到')
      return
    }

    this.setupEventListeners()
    await this.friendManager.start()
    info('[MatrixFriend] FriendService 初始化完成')
  }

  /**
   * 从客户端获取 FriendManager
   *
   * @param client - Matrix 客户端实例
   * @returns FriendManager 实例，如果不存在则返回 null
   */
  private getFriendManager(client: MatrixClient): FriendManager | null {
    const clientWithFriendManager = client as unknown as Record<string, unknown>
    const friendManager = clientWithFriendManager.friendManager
    return friendManager instanceof FriendManager ? friendManager : null
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.friendManager) return

    this.friendManager.on(FriendEvent.SyncComplete, () => {
      this.updateSyncState()
      this.emit('sync', this.syncState)
      info('[MatrixFriend] 同步完成')
    })

    this.friendManager.on(FriendEvent.FriendAdded, (friend: Friend) => {
      this.updateSyncState()
      this.emit('friendAdded', friend)
      info(`[MatrixFriend] 好友添加: ${friend.userId}`)
    })

    this.friendManager.on(FriendEvent.FriendRemoved, (userId: string) => {
      this.updateSyncState()
      this.emit('friendRemoved', userId)
      info(`[MatrixFriend] 好友移除: ${userId}`)
    })

    this.friendManager.on(FriendEvent.FriendUpdated, (friend: Friend) => {
      this.updateSyncState()
      this.emit('friendUpdated', friend)
      info(`[MatrixFriend] 好友更新: ${friend.userId}`)
    })

    this.friendManager.on(FriendEvent.RequestReceived, (request: FriendRequest) => {
      this.updateSyncState()
      this.emit('requestReceived', request)
      info(`[MatrixFriend] 收到好友请求: ${request.userId}`)
    })

    this.friendManager.on(FriendEvent.RequestSent, (request: FriendRequest) => {
      this.updateSyncState()
      this.emit('requestSent', request)
      info(`[MatrixFriend] 发送好友请求: ${request.userId}`)
    })

    this.friendManager.on(FriendEvent.RequestAccepted, (userId: string) => {
      this.updateSyncState()
      this.emit('requestAccepted', userId)
      info(`[MatrixFriend] 好友请求已接受: ${userId}`)
    })

    this.friendManager.on(FriendEvent.RequestRejected, (userId: string) => {
      this.updateSyncState()
      this.emit('requestRejected', userId)
      info(`[MatrixFriend] 好友请求已拒绝: ${userId}`)
    })

    this.friendManager.on(FriendEvent.RequestCancelled, (userId: string) => {
      this.updateSyncState()
      this.emit('requestCancelled', userId)
      info(`[MatrixFriend] 好友请求已取消: ${userId}`)
    })
  }

  /**
   * 更新同步状态
   */
  private updateSyncState(): void {
    if (!this.friendManager) return
    this.syncState = {
      friends: this.friendManager.getFriends(),
      incomingRequests: this.friendManager.getIncomingRequests(),
      outgoingRequests: this.friendManager.getOutgoingRequests()
    }
  }

  /**
   * 获取所有好友
   *
   * @returns 好友列表
   */
  getFriends(): Friend[] {
    return this.friendManager?.getFriends() ?? []
  }

  /**
   * 获取指定好友信息
   *
   * @param userId - 用户 ID
   * @returns 好友信息，如果不存在则返回 undefined
   */
  getFriend(userId: string): Friend | undefined {
    return this.friendManager?.getFriend(userId)
  }

  /**
   * 检查是否为好友
   *
   * @param userId - 用户 ID
   * @returns 是否为好友
   */
  isFriend(userId: string): boolean {
    return this.friendManager?.isFriend(userId) ?? false
  }

  /**
   * 获取好友数量
   *
   * @returns 好友数量
   */
  getFriendCount(): number {
    return this.friendManager?.getFriendCount() ?? 0
  }

  /**
   * 获取收到的好友请求
   *
   * @returns 收到的好友请求列表
   */
  getIncomingRequests(): FriendRequest[] {
    return this.friendManager?.getIncomingRequests() ?? []
  }

  /**
   * 获取发出的好友请求
   *
   * @returns 发出的好友请求列表
   */
  getOutgoingRequests(): FriendRequest[] {
    return this.friendManager?.getOutgoingRequests() ?? []
  }

  /**
   * 获取同步状态
   *
   * @returns 当前同步状态
   */
  getSyncState(): FriendSyncState {
    return this.syncState
  }

  /**
   * 发送好友请求
   *
   * @param userId - 目标用户 ID
   * @param message - 请求消息 (可选)
   * @throws {Error} 如果 FriendManager 未初始化或发送失败
   */
  async sendFriendRequest(userId: string, message?: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.sendFriendRequest(userId, message)
      info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 发送好友请求失败: ${err}`)
      throw err
    }
  }

  /**
   * 接受好友请求
   *
   * @param userId - 用户 ID
   * @throws {Error} 如果 FriendManager 未初始化或接受失败
   */
  async acceptFriendRequest(userId: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.acceptFriendRequest(userId)
      info(`[MatrixFriend] 接受好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 接受好友请求失败: ${err}`)
      throw err
    }
  }

  /**
   * 拒绝好友请求
   *
   * @param userId - 用户 ID
   * @throws {Error} 如果 FriendManager 未初始化或拒绝失败
   */
  async rejectFriendRequest(userId: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.rejectFriendRequest(userId)
      info(`[MatrixFriend] 拒绝好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 拒绝好友请求失败: ${err}`)
      throw err
    }
  }

  /**
   * 取消好友请求
   *
   * @param userId - 用户 ID
   * @throws {Error} 如果 FriendManager 未初始化或取消失败
   */
  async cancelFriendRequest(userId: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.cancelFriendRequest(userId)
      info(`[MatrixFriend] 取消好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 取消好友请求失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除好友
   *
   * @param userId - 用户 ID
   * @throws {Error} 如果 FriendManager 未初始化或删除失败
   */
  async removeFriend(userId: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.removeFriend(userId)
      info(`[MatrixFriend] 删除好友成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 删除好友失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置好友备注
   *
   * @param userId - 用户 ID
   * @param note - 备注内容
   * @throws {Error} 如果 FriendManager 未初始化或设置失败
   */
  async setFriendNote(userId: string, note: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.setFriendNote(userId, note)
      info(`[MatrixFriend] 设置好友备注成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置好友状态
   *
   * @param userId - 用户 ID
   * @param status - 好友状态
   * @throws {Error} 如果 FriendManager 未初始化或设置失败
   */
  async setFriendStatus(userId: string, status: FriendStatus): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.setFriendStatus(userId, status)
      info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取好友详细信息
   *
   * @param userId - 用户 ID
   * @returns 好友信息
   * @throws {Error} 如果 FriendManager 未初始化或获取失败
   */
  async getFriendInfo(userId: string): Promise<Friend | undefined> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      const friend = await this.friendManager.getFriendInfo(userId)
      info(`[MatrixFriend] 获取好友信息成功: ${userId}`)
      return friend
    } catch (err) {
      error(`[MatrixFriend] 获取好友信息失败: ${err}`)
      throw err
    }
  }

  /**
   * 手动同步好友数据
   *
   * @throws {Error} 如果 FriendManager 未初始化或同步失败
   */
  async sync(): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.sync()
      this.updateSyncState()
      info('[MatrixFriend] 手动同步完成')
    } catch (err) {
      error(`[MatrixFriend] 同步失败: ${err}`)
      throw err
    }
  }

  /**
   * 停止好友服务
   */
  stop(): void {
    if (this.friendManager) {
      this.friendManager.stop()
      this.friendManager.removeAllListeners()
      this.friendManager = null
    }
    this.eventListeners.clear()
    this.syncState = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: []
    }
    info('[MatrixFriend] FriendService 已停止')
  }

  /**
   * 注册事件监听器
   *
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: FriendServiceEventHandler): void {
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
  off(event: string, callback: FriendServiceEventHandler): void {
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
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }
}

export const matrixFriendService = new MatrixFriendService()
export default matrixFriendService
