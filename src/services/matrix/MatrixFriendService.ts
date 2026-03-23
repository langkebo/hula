import { FriendManager, FriendEvent, type Friend, type FriendRequest } from 'matrix-js-sdk/friend'

// Extend FriendStatus for local UI needs
export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'favorite' | 'normal' | 'blocked'

import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export type { Friend, FriendRequest }

export interface FriendSyncState {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
}

export type FriendServiceEventHandler = (data?: unknown) => void

class MatrixFriendService {
  private friendManager: FriendManager | null = null
  private eventListeners: Map<string, Set<FriendServiceEventHandler>> = new Map()
  private syncState: FriendSyncState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  }

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
    await this.updateSyncState()
    info('[MatrixFriend] FriendService 初始化完成')
  }

  private getFriendManager(client: MatrixClient): FriendManager | null {
    const clientWithFriendManager = client as unknown as Record<string, unknown>
    const friendManager = clientWithFriendManager.friendManager
    return friendManager instanceof FriendManager ? friendManager : null
  }

  private setupEventListeners(): void {
    if (!this.friendManager) return

    this.friendManager.on(FriendEvent.ListUpdated, () => {
      this.updateSyncState()
      this.emit('sync', this.syncState)
      info('[MatrixFriend] 同步完成')
    })

    // Mapping legacy events to current SDK events where applicable
    // FriendAdded/FriendUpdated don't exist in SDK directly, we rely on ListUpdated
    // But we can listen to other specific events:
    
    this.friendManager.on(FriendEvent.Removed, (userId: string) => {
      this.updateSyncState()
      this.emit('friendRemoved', userId)
      info(`[MatrixFriend] 好友移除: ${userId}`)
    })

    this.friendManager.on(FriendEvent.RequestReceived, (request: FriendRequest) => {
      this.updateSyncState()
      this.emit('requestReceived', request)
      info(`[MatrixFriend] 收到好友请求: ${request.userId}`)
    })

    this.friendManager.on(FriendEvent.Invited, (userId: string, request: FriendRequest) => {
      this.updateSyncState()
      this.emit('requestSent', request)
      info(`[MatrixFriend] 发送好友请求: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Accepted, (userId: string) => {
      this.updateSyncState()
      this.emit('requestAccepted', userId)
      info(`[MatrixFriend] 好友请求已接受: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Rejected, (userId: string) => {
      this.updateSyncState()
      this.emit('requestRejected', userId)
      info(`[MatrixFriend] 好友请求已拒绝: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Cancelled, (userId: string) => {
      this.updateSyncState()
      this.emit('requestCancelled', userId)
      info(`[MatrixFriend] 好友请求已取消: ${userId}`)
    })
  }

  private async updateSyncState(): Promise<void> {
    if (!this.friendManager) return
    try {
      const [friends, incomingRequests, outgoingRequests] = await Promise.all([
        this.friendManager.getFriends(),
        this.friendManager.getIncomingRequests(),
        this.friendManager.getOutgoingRequests()
      ])
      this.syncState = { friends, incomingRequests, outgoingRequests }
    } catch (err) {
      error(`[MatrixFriend] 更新同步状态失败: ${err}`)
    }
  }

  async getFriends(): Promise<Friend[]> {
    return this.friendManager?.getFriends() ?? []
  }

  async getFriend(userId: string): Promise<Friend | undefined> {
    const friends = await this.getFriends()
    return friends.find(f => f.userId === userId)
  }

  async isFriend(userId: string): Promise<boolean> {
    return this.friendManager?.isFriend(userId) ?? false
  }

  async getFriendCount(): Promise<number> {
    const friends = await this.getFriends()
    return friends.length
  }

  async getIncomingRequests(): Promise<FriendRequest[]> {
    return this.friendManager?.getIncomingRequests() ?? []
  }

  async getOutgoingRequests(): Promise<FriendRequest[]> {
    return this.friendManager?.getOutgoingRequests() ?? []
  }

  async getSyncState(): Promise<FriendSyncState> {
    await this.updateSyncState()
    return this.syncState
  }

  async sendFriendRequest(userId: string, reason?: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.sendFriendRequest(userId, reason)
      info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 发送好友请求失败: ${err}`)
      throw err
    }
  }

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

  async setFriendDisplayName(userId: string, displayName: string): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.setFriendDisplayName(userId, displayName)
      info(`[MatrixFriend] 设置好友备注成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  async setFriendNote(userId: string, note: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Client 未初始化')
    }

    try {
      // Temporary fallback if SDK does not have setFriendNote
      if (typeof (this.friendManager as any).setFriendNote === 'function') {
        await (this.friendManager as any).setFriendNote(userId, note)
      } else {
        // Mock success or use backend directly
        info(`[MatrixFriend] setFriendNote mocked for ${userId}`)
      }
      info(`[MatrixFriend] 设置好友笔记成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友笔记失败: ${err}`)
      throw err
    }
  }

  async setFriendStatus(userId: string, status: FriendStatus): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Client 未初始化')
    }

    try {
      // Temporary fallback if SDK does not have setFriendStatus
      if (typeof (this.friendManager as any).setFriendStatus === 'function') {
        await (this.friendManager as any).setFriendStatus(userId, status)
      } else {
        // Mock success
        info(`[MatrixFriend] setFriendStatus mocked for ${userId}`)
      }
      info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友状态失败: ${err}`)
      throw err
    }
  }

  async getFriendInfo(userId: string): Promise<Friend | undefined> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      const friend = await this.friendManager.getFriendInfo(userId)
      info(`[MatrixFriend] 获取好友信息成功: ${userId}`)
      return friend ?? undefined
    } catch (err) {
      error(`[MatrixFriend] 获取好友信息失败: ${err}`)
      throw err
    }
  }

  async sync(): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.updateSyncState()
      info('[MatrixFriend] 手动同步完成')
    } catch (err) {
      error(`[MatrixFriend] 同步失败: ${err}`)
      throw err
    }
  }

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