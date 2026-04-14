import { FriendManager, FriendEvent, type Friend, type FriendRequest } from 'matrix-js-sdk/friend'

export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'favorite' | 'normal' | 'blocked'

import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error } from '@tauri-apps/plugin-log'

export type { Friend, FriendRequest }

export interface FriendSyncState {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
}

export type FriendServiceEventHandler = (data?: unknown) => void

class MatrixFriendService extends BaseManager {
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

  async getFriends(throwOnError = true): Promise<Friend[]> {
    try {
      return this.friendManager?.getFriends() ?? []
    } catch (err) {
      return this.handleError(err, 'getFriends', [] as Friend[], throwOnError)
    }
  }

  async getFriend(userId: string, throwOnError = true): Promise<Friend | undefined> {
    try {
      const friends = await this.getFriends(throwOnError)
      return friends.find((f) => f.userId === userId)
    } catch (err) {
      return this.handleError(err, 'getFriend', undefined, throwOnError)
    }
  }

  async isFriend(userId: string, throwOnError = true): Promise<boolean> {
    try {
      return this.friendManager?.isFriend(userId) ?? false
    } catch (err) {
      return this.handleError(err, 'isFriend', false, throwOnError)
    }
  }

  async getFriendCount(throwOnError = true): Promise<number> {
    try {
      const friends = await this.getFriends(throwOnError)
      return friends.length
    } catch (err) {
      return this.handleError(err, 'getFriendCount', 0, throwOnError)
    }
  }

  async getIncomingRequests(throwOnError = true): Promise<FriendRequest[]> {
    try {
      return this.friendManager?.getIncomingRequests() ?? []
    } catch (err) {
      return this.handleError(err, 'getIncomingRequests', [] as FriendRequest[], throwOnError)
    }
  }

  async getOutgoingRequests(throwOnError = true): Promise<FriendRequest[]> {
    try {
      return this.friendManager?.getOutgoingRequests() ?? []
    } catch (err) {
      return this.handleError(err, 'getOutgoingRequests', [] as FriendRequest[], throwOnError)
    }
  }

  async getSyncState(throwOnError = true): Promise<FriendSyncState> {
    try {
      await this.updateSyncState()
      return this.syncState
    } catch (err) {
      return this.handleError(err, 'getSyncState', this.syncState, throwOnError)
    }
  }

  async sendFriendRequest(userId: string, reason?: string, throwOnError = false): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.sendFriendRequest(userId, reason)
      info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'sendFriendRequest', undefined as void, throwOnError)
    }
  }

  async acceptFriendRequest(userId: string, throwOnError = false): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.acceptFriendRequest(userId)
      info(`[MatrixFriend] 接受好友请求成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'acceptFriendRequest', undefined as void, throwOnError)
    }
  }

  async cancelFriendRequest(userId: string, throwOnError = false): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.cancelFriendRequest(userId)
      info(`[MatrixFriend] 取消好友请求成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'cancelFriendRequest', undefined as void, throwOnError)
    }
  }

  async rejectFriendRequest(userId: string, throwOnError = false): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.rejectFriendRequest(userId)
      info(`[MatrixFriend] 拒绝好友请求成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'rejectFriendRequest', undefined as void, throwOnError)
    }
  }

  async removeFriend(userId: string, throwOnError = false): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.removeFriend(userId)
      info(`[MatrixFriend] 删除好友成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'removeFriend', undefined as void, throwOnError)
    }
  }

  async setFriendDisplayName(userId: string, displayName: string, throwOnError = false): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.friendManager.setFriendDisplayName(userId, displayName)
      info(`[MatrixFriend] 设置好友备注成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'setFriendDisplayName', undefined as void, throwOnError)
    }
  }

  async setFriendNote(userId: string, note: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Client 未初始化')
    }

    try {
      if (typeof (this.friendManager as any).setFriendNote === 'function') {
        await (this.friendManager as any).setFriendNote(userId, note)
      } else {
        info(`[MatrixFriend] setFriendNote mocked for ${userId}`)
      }
      info(`[MatrixFriend] 设置好友笔记成功: ${userId}`)
    } catch (err) {
      this.handleError(err, 'setFriendNote', undefined as void, throwOnError)
    }
  }

  async setFriendStatus(userId: string, status: FriendStatus, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Client 未初始化')
    }

    try {
      const SPECIAL_FRIENDS_EVENT_TYPE = 'm.special_friends'
      const content = client.getAccountData(SPECIAL_FRIENDS_EVENT_TYPE) as { special_friends?: string[] } | undefined
      const currentList = content?.special_friends || []

      let newList: string[]
      if (status === 'favorite') {
        if (!currentList.includes(userId)) {
          newList = [...currentList, userId]
        } else {
          newList = currentList
        }
        await client.setAccountData(SPECIAL_FRIENDS_EVENT_TYPE, { special_friends: newList })
      } else if (currentList.includes(userId)) {
        newList = currentList.filter((id: string) => id !== userId)
        await client.setAccountData(SPECIAL_FRIENDS_EVENT_TYPE, { special_friends: newList })
      }

      if (typeof (this.friendManager as any).setFriendStatus === 'function') {
        await (this.friendManager as any).setFriendStatus(userId, status)
      }
      info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
    } catch (err) {
      this.handleError(err, 'setFriendStatus', undefined as void, throwOnError)
    }
  }

  async getSpecialFriends(throwOnError = true): Promise<string[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      return []
    }
    try {
      const content = client.getAccountData('m.special_friends') as { special_friends?: string[] } | undefined
      return content?.special_friends || []
    } catch (err) {
      return this.handleError(err, 'getSpecialFriends', [] as string[], throwOnError)
    }
  }

  async getFriendInfo(userId: string, throwOnError = true): Promise<Friend | undefined> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      const friend = await this.friendManager.getFriendInfo(userId)
      info(`[MatrixFriend] 获取好友信息成功: ${userId}`)
      return friend ?? undefined
    } catch (err) {
      return this.handleError(err, 'getFriendInfo', undefined, throwOnError)
    }
  }

  async sync(throwOnError = true): Promise<void> {
    if (!this.friendManager) {
      throw new Error('FriendManager 未初始化')
    }

    try {
      await this.updateSyncState()
      info('[MatrixFriend] 手动同步完成')
    } catch (err) {
      this.handleError(err, 'sync', undefined as void, throwOnError)
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
