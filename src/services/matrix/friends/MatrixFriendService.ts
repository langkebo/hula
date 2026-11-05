import type { Friend, FriendRequest } from '@/services/matrix/sdk'

import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { type SynapseDmInfo, synapseDmExtensionService } from '../extensions/SynapseDmExtensionService'
import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import matrixClientService from '../MatrixClientService'
import {
  clearAllFriendReadErrors,
  clearFriendsLoadError,
  friendEventBus,
  getFriendsGeneration,
  setFriendReadError,
  setFriendsLoadError
} from './friendEvents'
import {
  type FriendStatus,
  type FriendSyncState,
  getFriendUserId,
  normalizeFriend,
  normalizeSynapseFriendRequest,
  streamFriendPages
} from './friendUtils'
import { matrixFriendSync } from './MatrixFriendSync'
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

/** 好友列表缓存 TTL：覆盖启动阶段的重复读取；写操作另有代际失效，不依赖它。 */
const FRIENDS_CACHE_TTL_MS = 15_000

/** 好友查询门面：Manager 优先 → REST 回退、错误归一、降级信号。生命周期/写/分组见三个单例。 */
class MatrixFriendService {
  private friendsCache: { at: number; generation: number; data: Friend[] } | null = null
  private friendsInFlight: Promise<Friend[]> | null = null

  /** 注册好友服务事件监听器（同一事件可注册多个回调）。 */
  on(event: string, callback: (data?: unknown) => void): void {
    friendEventBus.on(event, callback)
  }

  /** 移除某一事件的监听器。 */
  off(event: string, callback: (data?: unknown) => void): void {
    friendEventBus.off(event, callback)
  }

  /** 停止好友服务并清空所有事件监听器。 */
  stop(): void {
    matrixFriendSync.stop()
    friendEventBus.clear()
    this.invalidateFriendsCache()
    clearAllFriendReadErrors()
  }

  /** 让好友列表缓存立即失效（写操作 / 账号切换）。 */
  invalidateFriendsCache(): void {
    this.friendsCache = null
    this.friendsInFlight = null
  }

  /** REST 回退：失败**抛出**，由 `getFriends` 记录降级信号（不再吞成空列表）。 */
  private async getFriendsByFallbackApi(): Promise<Friend[]> {
    const friends = await synapseFriendExtensionService.getFriends()
    return friends.map((friend) => normalizeFriend(friend))
  }

  /** 全量好友（Manager 优先 → REST），带单飞 + 短 TTL 缓存；写操作后由代际失效。 */
  async getFriends(): Promise<Friend[]> {
    const generation = getFriendsGeneration()
    if (this.friendsCache && this.friendsCache.generation === generation) {
      const age = Date.now() - this.friendsCache.at
      if (age < FRIENDS_CACHE_TTL_MS) return this.friendsCache.data
    }
    if (this.friendsInFlight) return this.friendsInFlight

    this.friendsInFlight = this.loadFriends()
      .then((friends) => {
        // 期间发生过写操作则代际已变，不写缓存
        if (getFriendsGeneration() === generation) {
          this.friendsCache = { at: Date.now(), generation, data: friends }
        }
        clearFriendsLoadError()
        return friends
      })
      .catch((err: unknown) => {
        // 仍 fail-soft（调用方拿到 []），但记录原因供 UI 区分「空」与「失败」
        setFriendsLoadError(err)
        logger.error(`[MatrixFriend] 好友列表读取失败，已降级为空列表: ${err}`)
        return []
      })
      .finally(() => {
        this.friendsInFlight = null
      })
    return this.friendsInFlight
  }

  private async loadFriends(): Promise<Friend[]> {
    try {
      const manager = await matrixFriendSync.ensureFriendManager(false)
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
    const manager = await matrixFriendSync.ensureFriendManager(false)

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

    // 失败时**抛错**而非 false：`contactStateResolver` 用「抛错 = 无法确认」实现 fail-open；
    // 返回 false 会被判成 stranger 并缓存 5 分钟，真实好友的邀请会被自动拒掉。
    try {
      return await synapseFriendExtensionService.checkFriendship(userId)
    } catch (restErr) {
      logger.error(`[MatrixFriend] 好友关系无法确认: ${userId} — ${restErr}`)
      throw restErr
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
    const manager = await matrixFriendSync.ensureFriendManager(false)

    try {
      if (manager) {
        return await manager.getIncomingRequests()
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取入站好友请求失败，回退到 REST API: ${err}`)
    }

    try {
      const pending = await synapseFriendExtensionService.getPendingRequests()
      return (pending.incoming ?? []).map((r) => normalizeSynapseFriendRequest(r, 'incoming'))
    } catch (restErr) {
      setFriendReadError('requests', restErr)
      logger.error(`[MatrixFriend] REST API 获取入站好友请求失败: ${restErr}`)
      throw restErr
    }
  }

  /** 获取已发出的待处理好友请求：优先 FriendManager，不可用时回退 REST API。 */
  async getOutgoingRequests(): Promise<FriendRequest[]> {
    const manager = await matrixFriendSync.ensureFriendManager(false)

    try {
      if (manager) {
        return await manager.getOutgoingRequests()
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取出站好友请求失败，回退到 REST API: ${err}`)
    }

    try {
      const pending = await synapseFriendExtensionService.getPendingRequests()
      return (pending.outgoing ?? []).map((r) => normalizeSynapseFriendRequest(r, 'outgoing'))
    } catch (restErr) {
      setFriendReadError('requests', restErr)
      logger.error(`[MatrixFriend] REST API 获取出站好友请求失败: ${restErr}`)
      throw restErr
    }
  }

  /** 刷新并返回好友同步状态。 */
  async getSyncState(): Promise<FriendSyncState> {
    try {
      await matrixFriendSync.updateSyncState()
      return matrixFriendSync.getSyncStateValue()
    } catch (err) {
      logger.error(`[MatrixFriend] 获取同步状态失败: ${err}`)
      return matrixFriendSync.getSyncStateValue()
    }
  }

  /** 同步获取缓存的 FriendSyncState（不发 HTTP 请求） */
  getSyncStateValue(): FriendSyncState {
    return matrixFriendSync.getSyncStateValue()
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
    const manager = await matrixFriendSync.requireFriendManager()

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
      return { room_id: null, exists: false }
    }
  }

  /**
   * 创建（或复用）与指定好友的 DM 房间（POST /friends/dm/{uid}）。
   *
   * 为什么走服务端而不是客户端的 `startDirectRoom`：只有这条路径会让**服务端**
   * 决定加密与轮换 → 房间一定带 `m.room.encryption`（B-1）与 1 天 / 50 条的
   * Megolm 轮换参数（B-6）。客户端 `createRoom` 走的是 SDK 默认值，可能两头都缺。
   *
   * `isPrivate: true` 时后端还会写 `com.hula.privacy` 标记
   * （`{"action":"block_screenshot","is_private":true}`）并把
   * `history_visibility` 固定为 `invited`，前端据此启用防截屏提示（F-2）。
   *
   * ⚠️ `synapseDmExtensionService.createPrivateDm` 的默认值已与后端对齐为 `false`，
   * 但这里仍**显式传 false** —— 默认值曾与后端相反（前端 true / 后端 false），
   * 不传参就会静默创建私密会话。显式传值让意图不依赖默认值变化。
   *
   * @returns 房间 ID；失败返回 `null`（由调用方回落到客户端的本地建 DM）。
   */
  async createFriendDmRoom(userId: string, options: { isPrivate?: boolean } = {}): Promise<string | null> {
    const isPrivate = options.isPrivate ?? false
    try {
      const result = await synapseDmExtensionService.createPrivateDm(userId, isPrivate)
      if (!result.room_id) {
        logger.warn(`[MatrixFriend] 服务端未返回 DM 房间: userId=${userId}, isPrivate=${isPrivate}`)
        return null
      }
      logger.info(
        `[MatrixFriend] 服务端创建 DM 房间: userId=${userId}, isPrivate=${isPrivate}, roomId=${result.room_id}`
      )
      return result.room_id
    } catch (err) {
      // 服务端端点不可用（旧后端 / 4xx）时不能让「发消息」整体失败：
      // 返回 null 让调用方回落，与 getFriendDmRoom 的 fail-soft 保持一致。
      logger.error(`[MatrixFriend] 服务端创建 DM 房间失败: userId=${userId}, isPrivate=${isPrivate}, err=${err}`)
      return null
    }
  }

  /** 获取好友推荐列表；FriendManager 不支持时返回空数组。 */
  async getFriendSuggestions(): Promise<
    Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>
  > {
    const manager = await matrixFriendSync.requireFriendManager()

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
    const manager = await matrixFriendSync.ensureFriendManager(false)

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
      setFriendReadError('search', err)
      logger.error(`[MatrixFriend] REST 搜索好友失败: ${err}`)
      throw err
    }
  }
}

export const matrixFriendService = new MatrixFriendService()

// 好友域聚合入口：调用方从这里取「查询门面 + 三个能力单例」，无需关心内部文件划分。
export { friendEventBus } from './friendEvents'
/** 逐页流式读好友（首页先返回，后续页随用随取）：绑定扩展服务实现。 */
export const streamFriendsPages = () => streamFriendPages(synapseFriendExtensionService.getFriendsPage)
export { matrixFriendGroups } from './MatrixFriendGroups'
export { matrixFriendOperations } from './MatrixFriendOperations'
export { matrixFriendSync } from './MatrixFriendSync'
