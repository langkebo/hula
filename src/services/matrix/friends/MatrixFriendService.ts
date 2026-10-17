import type { Friend, FriendRequest } from '@/services/matrix/sdk'

import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { type SynapseDmInfo, synapseDmExtensionService } from '../extensions/SynapseDmExtensionService'
import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import matrixClientService from '../MatrixClientService'
import {
  type FriendGroup,
  type FriendServiceEventHandler,
  type FriendStatus,
  type FriendSyncState,
  getFriendUserId,
  normalizeFriend,
  normalizeSynapseFriendRequest
} from './friendUtils'
import { MatrixFriendGroups } from './MatrixFriendGroups'
import { MatrixFriendOperations } from './MatrixFriendOperations'
import { MatrixFriendSync } from './MatrixFriendSync'
import { matrixSpecialFriendService } from './MatrixSpecialFriendService'

export type {
  FriendGroup,
  FriendRelationStatus,
  FriendRequestStatus,
  FriendServiceEventHandler,
  FriendStatus,
  FriendSyncState
} from './friendUtils'
export type { Friend, FriendRequest }

const logger = createLogger('MatrixFriendService')

/**
 * 好友服务门面：保留全部对外 API，内部拆分为三个协作子服务：
 *  - MatrixFriendSync：FriendManager 生命周期、同步、轮询、事件监听
 *  - MatrixFriendOperations：好友请求/备注/状态等写操作
 *  - MatrixFriendGroups：好友分组管理
 * 纯函数工具（normalize/getRequestUserId 等）位于 ./friendUtils。
 */
class MatrixFriendService {
  private readonly friendSync: MatrixFriendSync
  private readonly operations: MatrixFriendOperations
  private readonly groups: MatrixFriendGroups
  private eventListeners: Map<string, Set<FriendServiceEventHandler>> = new Map()

  constructor() {
    this.friendSync = new MatrixFriendSync((event, data) => this.emit(event, data))
    this.operations = new MatrixFriendOperations(this.friendSync)
    this.groups = new MatrixFriendGroups(this.friendSync)
  }

  // ===== 事件系统 =====

  /** 注册好友服务事件监听器（同一事件可注册多个回调）。 */
  on(event: string, callback: FriendServiceEventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)?.add(callback)
  }

  /** 移除某一事件的监听器。 */
  off(event: string, callback: FriendServiceEventHandler): void {
    this.eventListeners.get(event)?.delete(callback)
  }

  private emit(event: string, data?: unknown): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(data))
  }

  // ===== 生命周期（委托 sync） =====

  /** 初始化好友服务：建立 FriendManager 并挂载同步监听。 */
  async initialize(): Promise<void> {
    return this.friendSync.initialize()
  }

  /** 触发一次好友数据同步。 */
  async sync(): Promise<void> {
    return this.friendSync.sync()
  }

  /** 停止好友服务并清空所有事件监听器。 */
  stop(): void {
    this.friendSync.stop()
    this.eventListeners.clear()
  }

  // ===== 好友操作（委托 operations） =====

  /** 向指定用户发送好友请求，可附可选理由。 */
  async sendFriendRequest(userId: string, reason?: string): Promise<void> {
    return this.operations.sendFriendRequest(userId, reason)
  }

  /** 接受来自指定用户的好友请求。 */
  async acceptFriendRequest(userId: string): Promise<void> {
    return this.operations.acceptFriendRequest(userId)
  }

  /** 取消已向指定用户发出的好友请求。 */
  async cancelFriendRequest(userId: string): Promise<void> {
    return this.operations.cancelFriendRequest(userId)
  }

  /** 拒绝来自指定用户的好友请求。 */
  async rejectFriendRequest(userId: string): Promise<void> {
    return this.operations.rejectFriendRequest(userId)
  }

  /** 解除与指定用户的好友关系。 */
  async removeFriend(userId: string): Promise<void> {
    return this.operations.removeFriend(userId)
  }

  /** 设置指定好友的显示名称（本地备注名）。 */
  async setFriendDisplayName(userId: string, displayName: string): Promise<void> {
    return this.operations.setFriendDisplayName(userId, displayName)
  }

  /** 设置指定好友的备注信息。 */
  async setFriendNote(userId: string, note: string): Promise<void> {
    return this.operations.setFriendNote(userId, note)
  }

  /** 设置指定好友的关系状态。 */
  async setFriendStatus(userId: string, status: FriendStatus): Promise<void> {
    return this.operations.setFriendStatus(userId, status)
  }

  // ===== 好友分组（委托 groups） =====

  /** 获取当前用户的全部分组。 */
  async getFriendGroups(): Promise<FriendGroup[]> {
    return this.groups.getFriendGroups()
  }

  /** 新建好友分组并返回其结构。 */
  async createFriendGroup(name: string): Promise<FriendGroup> {
    return this.groups.createFriendGroup(name)
  }

  /** 删除指定好友分组。 */
  async deleteFriendGroup(groupId: string): Promise<void> {
    return this.groups.deleteFriendGroup(groupId)
  }

  /** 重命名指定好友分组。 */
  async renameFriendGroup(groupId: string, name: string): Promise<void> {
    return this.groups.renameFriendGroup(groupId, name)
  }

  /** 将好友加入指定分组。 */
  async addFriendToGroup(groupId: string, userId: string): Promise<void> {
    return this.groups.addFriendToGroup(groupId, userId)
  }

  /** 将好友移出指定分组。 */
  async removeFriendFromGroup(groupId: string, userId: string): Promise<void> {
    return this.groups.removeFriendFromGroup(groupId, userId)
  }

  /** 获取指定分组内的好友列表。 */
  async getFriendsInGroup(groupId: string): Promise<Friend[]> {
    return this.groups.getFriendsInGroup(groupId)
  }

  /** 获取指定好友所属的分组列表。 */
  async getFriendGroupsByUser(userId: string): Promise<FriendGroup[]> {
    return this.groups.getFriendGroupsByUser(userId)
  }

  // ===== 查询方法 =====

  private async getFriendsByFallbackApi(): Promise<Friend[]> {
    try {
      const friends = await synapseFriendExtensionService.getFriends()
      return friends.map((friend) => normalizeFriend(friend))
    } catch (err) {
      logger.error(`[MatrixFriend] 回退好友列表接口失败: ${err}`)
      return []
    }
  }

  /** 获取好友列表：优先 FriendManager，为空或不可用时回退 REST API。 */
  async getFriends(): Promise<Friend[]> {
    try {
      const manager = await this.friendSync.ensureFriendManager(false)
      if (manager) {
        const friends = await manager.getFriends()
        if (friends.length > 0) {
          return friends.map((friend) => normalizeFriend(friend))
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

  /** 按用户 ID 获取单个好友，未命中返回 undefined。 */
  async getFriend(userId: string): Promise<Friend | undefined> {
    try {
      const friends = await this.getFriends()
      return friends.find((friend) => getFriendUserId(friend) === userId)
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友失败: ${err}`)
      return undefined
    }
  }

  /** 判断指定用户是否为好友：优先 FriendManager，不可用时回退 REST API。 */
  async isFriend(userId: string): Promise<boolean> {
    const manager = await this.friendSync.ensureFriendManager(false)

    try {
      if (manager) {
        if (typeof manager.checkFriendship === 'function') {
          const result = await manager.checkFriendship(userId)
          return result.is_friend || result.are_friends
        }
        const friends = await manager.getFriends()
        return friends.some((f: Friend) => getFriendUserId(f) === userId)
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

  /** 获取好友数量，失败时返回 0。 */
  async getFriendCount(): Promise<number> {
    try {
      const friends = await this.getFriends()
      return friends.length
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友数量失败: ${err}`)
      return 0
    }
  }

  /** 获取收到的待处理好友请求：优先 FriendManager，不可用时回退 REST API。 */
  async getIncomingRequests(): Promise<FriendRequest[]> {
    const manager = await this.friendSync.ensureFriendManager(false)

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
      return (pending.incoming ?? []).map((r) => normalizeSynapseFriendRequest(r, 'incoming'))
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 获取入站好友请求也失败: ${restErr}`)
      return []
    }
  }

  /** 获取已发出的待处理好友请求：优先 FriendManager，不可用时回退 REST API。 */
  async getOutgoingRequests(): Promise<FriendRequest[]> {
    const manager = await this.friendSync.ensureFriendManager(false)

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
      return (pending.outgoing ?? []).map((r) => normalizeSynapseFriendRequest(r, 'outgoing'))
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 获取出站好友请求也失败: ${restErr}`)
      return []
    }
  }

  /** 刷新并返回好友同步状态。 */
  async getSyncState(): Promise<FriendSyncState> {
    try {
      await this.friendSync.updateSyncState()
      return this.friendSync.getSyncStateValue()
    } catch (err) {
      logger.error(`[MatrixFriend] 获取同步状态失败: ${err}`)
      return this.friendSync.getSyncStateValue()
    }
  }

  /** 同步获取缓存的 FriendSyncState（不发 HTTP 请求） */
  getSyncStateValue(): FriendSyncState {
    return this.friendSync.getSyncStateValue()
  }

  /** 获取特别关注好友的用户 ID 列表。 */
  async getSpecialFriends(): Promise<string[]> {
    try {
      return matrixSpecialFriendService.getSpecialFriends()
    } catch (err) {
      logger.error(`[MatrixFriend] 获取特别好友失败: ${err}`)
      return []
    }
  }

  /** 获取指定好友的详细信息，失败时抛出异常。 */
  async getFriendInfo(userId: string): Promise<Friend | undefined> {
    const manager = await this.friendSync.requireFriendManager()

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

  /** 获取好友推荐列表；FriendManager 不支持时返回空数组。 */
  async getFriendSuggestions(): Promise<
    Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>
  > {
    const manager = await this.friendSync.requireFriendManager()

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

  /** 获取与指定用户的好友关系状态，未知或失败时返回 null。 */
  async getFriendStatus(userId: string): Promise<FriendStatus | null> {
    const manager = await this.friendSync.ensureFriendManager(false)

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

  /** 获取指定好友的状态详情，客户端或接口不可用时返回 null。 */
  async getFriendStatusInfo(userId: string): Promise<Record<string, unknown> | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const friendManager = client.getFriendManager()
      if (friendManager?.getFriendStatusInfo) {
        const result = await friendManager.getFriendStatusInfo(userId)
        logger.info(`[MatrixFriend] 获取好友状态详情成功: ${userId}`)
        // SDK 返回 FriendStatusInfo（具体接口，无索引签名）；保持公开契约 Record<string, unknown> | null
        return unknownToObject(result)
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取好友状态详情失败: ${err}`)
      return null
    }
    return null
  }

  async searchFriendsViaApi(
    query: string,
    options?: { mode?: 'fuzzy' | 'exact'; limit?: number }
  ): Promise<Array<{ user_id: string; display_name?: string | undefined; avatar_url?: string | undefined }>> {
    try {
      const results = await synapseFriendExtensionService.searchFriends(query, options)
      return results.map((r) => ({
        user_id: r.user_id,
        display_name: (unknownToObject(r)?.display_name as string | undefined) ?? r.displayname,
        avatar_url: r.avatar_url
      }))
    } catch (err) {
      logger.error(`[MatrixFriend] REST 搜索好友失败: ${err}`)
      return []
    }
  }
}

export const matrixFriendService = new MatrixFriendService()
