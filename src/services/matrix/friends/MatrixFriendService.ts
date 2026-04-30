import { type Friend, FriendEvent, type FriendManager, type FriendRequest } from 'matrix-js-sdk/friend'

// Extend FriendStatus for local UI needs
export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'favorite' | 'normal' | 'blocked'

import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { matrixSpecialFriendService } from './MatrixSpecialFriendService'

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
  private eventListeners: Map<string, Set<FriendServiceEventHandler>> = new Map()
  private syncState: FriendSyncState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  }

  async initialize(): Promise<void> {
    try {
      const manager = await this.ensureFriendManager()
      if (!manager) {
        error('[MatrixFriend] FriendManager 未在客户端上找到')
        return
      }
      info('[MatrixFriend] FriendService 初始化完成')
    } catch (err) {
      error(`[MatrixFriend] 初始化失败: ${err}`)
      throw err
    }
  }

  private getFriendManager(client: MatrixClient): FriendManager | null {
    const clientWithFriendManager = client as unknown as Record<string, unknown>
    const friendManager = clientWithFriendManager.friendManager
    return friendManager &&
      typeof friendManager === 'object' &&
      typeof (friendManager as FriendManager).start === 'function'
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
        throw new Error('FriendManager 未初始化')
      }
      return null
    }

    if (!this.managerStarted) {
      await manager.start()
      this.managerStarted = true
      await this.updateSyncState()
    }

    return manager
  }

  private async requireFriendManager(): Promise<FriendManagerCompat> {
    const manager = await this.ensureFriendManager(false)
    if (!manager) {
      throw new Error('FriendManager 未初始化')
    }
    return manager
  }

  private getFriendUserId(friend: Friend): string {
    return friend.user_id ?? ''
  }

  private getRequestUserId(request: FriendRequest): string {
    return request.user_id ?? ''
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
      info('[MatrixFriend] 同步完成')
    })

    // Mapping legacy events to current SDK events where applicable
    // FriendAdded/FriendUpdated don't exist in SDK directly, we rely on ListUpdated
    // But we can listen to other specific events:

    this.friendManager.on(FriendEvent.Removed, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('friendRemoved', userId)
      info(`[MatrixFriend] 好友移除: ${userId}`)
    })

    this.friendManager.on(FriendEvent.RequestReceived, (...args: unknown[]) => {
      const request = this.toFriendRequest(args[0])
      if (!request) return
      this.updateSyncState()
      this.emit('requestReceived', request)
      info(`[MatrixFriend] 收到好友请求: ${this.getRequestUserId(request)}`)
    })

    this.friendManager.on(FriendEvent.Invited, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      const request = this.toFriendRequest(args[1])
      if (!userId || !request) return
      this.updateSyncState()
      this.emit('requestSent', request)
      info(`[MatrixFriend] 发送好友请求: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Accepted, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestAccepted', userId)
      info(`[MatrixFriend] 好友请求已接受: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Rejected, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
      this.updateSyncState()
      this.emit('requestRejected', userId)
      info(`[MatrixFriend] 好友请求已拒绝: ${userId}`)
    })

    this.friendManager.on(FriendEvent.Cancelled, (...args: unknown[]) => {
      const userId = this.toUserId(args[0])
      if (!userId) return
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
    try {
      return (await this.ensureFriendManager(false))?.getFriends() ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取好友列表失败: ${err}`)
      return []
    }
  }

  async getFriend(userId: string): Promise<Friend | undefined> {
    try {
      const friends = await this.getFriends()
      return friends.find((friend) => this.getFriendUserId(friend) === userId)
    } catch (err) {
      error(`[MatrixFriend] 获取好友失败: ${err}`)
      return undefined
    }
  }

  async isFriend(userId: string): Promise<boolean> {
    const manager = await this.ensureFriendManager(false)
    if (!manager) return false

    try {
      if (typeof manager.checkFriendship === 'function') {
        return await manager.checkFriendship(userId)
      }
      const friends = await manager.getFriends()
      return friends.some((f: Friend) => this.getFriendUserId(f) === userId)
    } catch (err) {
      error(`[MatrixFriend] 检查好友关系失败: ${err}`)
      return false
    }
  }

  async getFriendCount(): Promise<number> {
    try {
      const friends = await this.getFriends()
      return friends.length
    } catch (err) {
      error(`[MatrixFriend] 获取好友数量失败: ${err}`)
      return 0
    }
  }

  async getIncomingRequests(): Promise<FriendRequest[]> {
    try {
      return (await this.ensureFriendManager(false))?.getIncomingRequests() ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取入站好友请求失败: ${err}`)
      return []
    }
  }

  async getOutgoingRequests(): Promise<FriendRequest[]> {
    try {
      return (await this.ensureFriendManager(false))?.getOutgoingRequests() ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取出站好友请求失败: ${err}`)
      return []
    }
  }

  async getSyncState(): Promise<FriendSyncState> {
    try {
      await this.updateSyncState()
      return this.syncState
    } catch (err) {
      error(`[MatrixFriend] 获取同步状态失败: ${err}`)
      return this.syncState
    }
  }

  async sendFriendRequest(userId: string, reason?: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await manager.sendFriendRequest(userId, reason)
      info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 发送好友请求失败: ${err}`)
      throw err
    }
  }

  async acceptFriendRequest(userId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await manager.acceptFriendRequest(userId)
      info(`[MatrixFriend] 接受好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 接受好友请求失败: ${err}`)
      throw err
    }
  }

  async cancelFriendRequest(userId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await manager.cancelFriendRequest(userId)
      info(`[MatrixFriend] 取消好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 取消好友请求失败: ${err}`)
      throw err
    }
  }

  async rejectFriendRequest(userId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await manager.rejectFriendRequest(userId)
      info(`[MatrixFriend] 拒绝好友请求成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 拒绝好友请求失败: ${err}`)
      throw err
    }
  }

  async removeFriend(userId: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      await manager.removeFriend(userId)
      info(`[MatrixFriend] 删除好友成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 删除好友失败: ${err}`)
      throw err
    }
  }

  async setFriendDisplayName(userId: string, displayName: string): Promise<void> {
    try {
      const manager = await this.requireFriendManager()
      await manager.setFriendDisplayName(userId, displayName)
      info(`[MatrixFriend] 设置好友备注成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  async setFriendNote(userId: string, note: string): Promise<void> {
    const manager = await this.requireFriendManager()

    try {
      if (typeof manager.updateFriendNote === 'function') {
        await manager.updateFriendNote(userId, note)
      } else if (typeof manager.setFriendNote === 'function') {
        await manager.setFriendNote(userId, note)
      } else {
        throw new Error('FriendManager 不支持好友备注更新')
      }

      info(`[MatrixFriend] 设置好友笔记成功: ${userId}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友笔记失败: ${err}`)
      throw err
    }
  }

  async setFriendStatus(userId: string, status: FriendStatus): Promise<void> {
    let manager: FriendManagerCompat | null = null

    try {
      if (status === 'favorite') {
        await matrixSpecialFriendService.addSpecialFriend(userId)
        info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
        return
      }

      await matrixSpecialFriendService.removeSpecialFriend(userId)

      if (status === 'accepted' || status === 'normal') {
        info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
        return
      }

      manager = await this.requireFriendManager()
      if (typeof manager?.setFriendStatus !== 'function') {
        throw new Error(`FriendManager 不支持好友状态更新: ${status}`)
      }

      await manager.setFriendStatus(userId, status)
      info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
    } catch (err) {
      error(`[MatrixFriend] 设置好友状态失败: ${err}`)
      throw err
    }
  }

  async getSpecialFriends(): Promise<string[]> {
    try {
      return matrixSpecialFriendService.getSpecialFriends()
    } catch (err) {
      error(`[MatrixFriend] 获取特别好友失败: ${err}`)
      return []
    }
  }

  async getFriendInfo(userId: string): Promise<Friend | undefined> {
    const manager = await this.requireFriendManager()

    try {
      const friend = await manager.getFriendInfo(userId)
      info(`[MatrixFriend] 获取好友信息成功: ${userId}`)
      return friend ?? undefined
    } catch (err) {
      error(`[MatrixFriend] 获取好友信息失败: ${err}`)
      throw err
    }
  }

  async sync(): Promise<void> {
    await this.requireFriendManager()

    try {
      await this.updateSyncState()
      info('[MatrixFriend] 手动同步完成')
    } catch (err) {
      error(`[MatrixFriend] 同步失败: ${err}`)
      throw err
    }
  }

  async getFriendGroups(): Promise<FriendGroup[]> {
    const manager = await this.requireFriendManager()

    try {
      const groups = await (
        manager as FriendManagerCompat & {
          getFriendGroups?: () => Promise<FriendGroup[]>
        }
      ).getFriendGroups?.()
      info(`[MatrixFriend] 获取好友分组成功: ${groups?.length ?? 0} 个`)
      return (groups as unknown as FriendGroup[] | undefined) ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取好友分组失败: ${err}`)
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
      info(`[MatrixFriend] 创建好友分组成功: ${name}`)

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
      error(`[MatrixFriend] 创建好友分组失败: ${err}`)
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
      info(`[MatrixFriend] 删除好友分组成功: ${groupId}`)
    } catch (err) {
      error(`[MatrixFriend] 删除好友分组失败: ${err}`)
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
      info(`[MatrixFriend] 重命名好友分组成功: ${groupId} -> ${name}`)
    } catch (err) {
      error(`[MatrixFriend] 重命名好友分组失败: ${err}`)
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
      info(`[MatrixFriend] 添加好友到分组成功: ${userId} -> ${groupId}`)
    } catch (err) {
      error(`[MatrixFriend] 添加好友到分组失败: ${err}`)
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
      info(`[MatrixFriend] 从分组移除好友成功: ${userId} <- ${groupId}`)
    } catch (err) {
      error(`[MatrixFriend] 从分组移除好友失败: ${err}`)
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
      info(`[MatrixFriend] 获取分组内好友成功: ${groupId} -> ${friends?.length ?? 0} 个`)
      return friends ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取分组内好友失败: ${err}`)
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
      info(`[MatrixFriend] 获取用户所属分组成功: ${userId} -> ${groups?.length ?? 0} 个`)
      return groups ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取用户所属分组失败: ${err}`)
      throw err
    }
  }

  async getFriendSuggestions(): Promise<
    Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>
  > {
    const manager = await this.requireFriendManager()

    try {
      if (typeof manager.getFriendSuggestions !== 'function') {
        info('[MatrixFriend] FriendManager 不支持好友建议，返回空列表')
        return []
      }
      const suggestions = await manager.getFriendSuggestions()
      info(`[MatrixFriend] 获取好友建议成功: ${suggestions?.length ?? 0} 个`)
      return suggestions ?? []
    } catch (err) {
      error(`[MatrixFriend] 获取好友建议失败: ${err}`)
      throw err
    }
  }

  async getFriendStatus(userId: string): Promise<FriendStatus | null> {
    const manager = await this.requireFriendManager()

    try {
      if (typeof manager.getFriendStatus !== 'function') {
        info(`[MatrixFriend] FriendManager 不支持获取好友状态: ${userId}`)
        return null
      }
      const status = await manager.getFriendStatus(userId)
      info(`[MatrixFriend] 获取好友状态成功: ${userId}`)
      return (status as FriendStatus | undefined) ?? null
    } catch (err) {
      error(`[MatrixFriend] 获取好友状态失败: ${err}`)
      throw err
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
