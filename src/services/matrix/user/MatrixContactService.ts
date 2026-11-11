import type { MatrixEvent, RoomMember, User } from 'matrix-js-sdk'
import { DIRECTORY_SEARCH_LIMIT } from '@/common/constants'
import { ERROR_CLIENT_NOT_INITIALIZED_EN } from '@/common/matrixConstants'
import { createLogger } from '@/utils/Logger'
import { normalizeMatrixUserId, toLocalpart } from '@/utils/userIdentity'
import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import { matrixFriendOperations } from '../friends/MatrixFriendService'
import { matrixClientService } from '../MatrixClientService'
import { matrixDirectMessageService } from '../room/MatrixDirectMessageService'
import { matrixRoomActionFacade, matrixRoomQueryFacade, matrixRoomReadFacade } from '../room/RoomFacade'

const logger = createLogger('MatrixContactService')

export interface UserProfile {
  userId: string
  displayName?: string | undefined
  avatarUrl?: string | undefined
}

export interface UserItem {
  uid: string
  name: string
  avatar: string
  activeStatus: number
  lastOptTime: number
}

interface DirectChatResult {
  roomId: string
}

class MatrixContactService {
  private hasLoggedSearchBeforeClientReady = false

  private isClientNotReadyError(err: unknown): boolean {
    return err instanceof Error && err.message === ERROR_CLIENT_NOT_INITIALIZED_EN
  }

  private getCurrentMatrixUserId(): string {
    return matrixClientService.getUserId() || matrixClientService.getClient()?.getUserId?.() || ''
  }

  private normalizeTargetUserId(value: string): string {
    return normalizeMatrixUserId(value, this.getCurrentMatrixUserId())
  }

  private toUserItem(user: Partial<User> & { userId?: string }, fallbackUserId: string): UserItem {
    return {
      uid: user.userId || fallbackUserId,
      name: user.displayName || '',
      avatar: user.avatarUrl || '',
      activeStatus: 0,
      lastOptTime: 0
    }
  }

  /** 按关键字搜索好友（委托 `searchUsers`）。 */
  async searchFriend(query: string, limit = DIRECTORY_SEARCH_LIMIT): Promise<UserProfile[]> {
    return this.searchUsers(query, limit)
  }

  /**
   * 按关键字搜索用户。
   * 优先经 synapse-rust 好友扩展做精确匹配，其次模糊匹配，再退回用户目录搜索；
   * 对 `@user:domain` 或 localpart 形式输入还会做一次 profile 兜底查询。
   */
  async searchUsers(query: string, limit = DIRECTORY_SEARCH_LIMIT): Promise<UserProfile[]> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }

    try {
      const normalizedUserId = this.normalizeTargetUserId(trimmedQuery)
      const exactKeyword = toLocalpart(normalizedUserId) || trimmedQuery

      const exactMatches = await synapseFriendExtensionService.searchFriends(exactKeyword, {
        limit,
        mode: 'exact'
      })
      if (exactMatches.length > 0) {
        return exactMatches.map((user) => ({
          userId: user.user_id,
          displayName: user.displayname ?? user.username ?? undefined,
          avatarUrl: user.avatar_url ?? undefined
        }))
      }

      const fallbackMatches = await synapseFriendExtensionService.searchFriends(trimmedQuery, {
        limit,
        mode: 'fuzzy'
      })
      if (fallbackMatches.length > 0) {
        return fallbackMatches.map((user) => ({
          userId: user.user_id,
          displayName: user.displayname ?? user.username ?? undefined,
          avatarUrl: user.avatar_url ?? undefined
        }))
      }

      const client = matrixClientService.getClient()
      if (!client) {
        if (!this.hasLoggedSearchBeforeClientReady) {
          this.hasLoggedSearchBeforeClientReady = true
          logger.info('[MatrixContact] Matrix client 未就绪，返回空搜索结果')
        }
        return []
      }

      this.hasLoggedSearchBeforeClientReady = false

      const response = await client.searchUserDirectory({
        term: query,
        limit
      })

      const results = response.results.map((user: { user_id: string; display_name?: string; avatar_url?: string }) => ({
        userId: user.user_id,
        displayName: user.display_name ?? undefined,
        avatarUrl: user.avatar_url ?? undefined
      }))

      // 如果用户目录搜索也没有结果，且输入看起来像 Matrix 用户 ID，尝试直接获取 profile
      if (results.length === 0 && trimmedQuery.startsWith('@') && trimmedQuery.includes(':')) {
        try {
          const profile = await client.getUserProfile(trimmedQuery)
          if (profile) {
            results.push({
              userId: trimmedQuery,
              displayName: profile.displayname ?? undefined,
              avatarUrl: profile.avatar_url ?? undefined
            })
          }
        } catch (err) {
          // profile 不存在属正常结果（用户未注册/无资料），记录 debug 便于排查而不误报警。
          logger.debug(`[MatrixContact] 直接 profile 查询无结果: ${trimmedQuery}`, err)
        }
      }

      // 如果仍然没有结果，尝试将输入作为 localpart 构造完整 Matrix ID 进行 profile lookup
      if (results.length === 0 && !trimmedQuery.startsWith('@')) {
        try {
          const currentUserId = client.getUserId()
          const domain = currentUserId?.split(':')[1]
          if (domain) {
            const fullUserId = `@${trimmedQuery}:${domain}`
            const profile = await client.getUserProfile(fullUserId)
            if (profile) {
              results.push({
                userId: fullUserId,
                displayName: profile.displayname ?? undefined,
                avatarUrl: profile.avatar_url ?? undefined
              })
            }
          }
        } catch (err) {
          // profile 不存在属正常结果（用户未注册/无资料），记录 debug 便于排查而不误报警。
          logger.debug(`[MatrixContact] localpart 构造 profile 查询无结果: ${trimmedQuery}`, err)
        }
      }

      return results
    } catch (err) {
      if (this.isClientNotReadyError(err)) {
        if (!this.hasLoggedSearchBeforeClientReady) {
          this.hasLoggedSearchBeforeClientReady = true
          logger.info('[MatrixContact] Matrix client 未就绪，返回空搜索结果')
        }
        return []
      }
      logger.error(`[MatrixContact] Failed to search users: ${err}`)
      throw err
    }
  }

  /** 获取指定用户的资料（显示名 + 头像）；失败返回 null。 */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const profile = await client.getUserProfile(userId)
      return {
        userId,
        displayName: profile.displayname,
        avatarUrl: profile.avatar_url
      }
    } catch (err) {
      logger.error(`[MatrixContact] Failed to get user profile: ${err}`)
      return null
    }
  }

  /** 获取或创建与指定用户的私聊房间，返回房间 ID。 */
  async getOrCreateDirectChat(userId: string): Promise<DirectChatResult> {
    try {
      const roomId = await matrixDirectMessageService.getOrCreateDmRoom(userId)
      logger.info(`[MatrixContact] Direct chat created/accessed: ${roomId}`)
      return { roomId }
    } catch (err) {
      logger.error(`[MatrixContact] Failed to create direct chat: ${err}`)
      throw err
    }
  }

  /** 获取当前账号的全部私聊房间 ID 列表。 */
  async getDMRooms(): Promise<string[]> {
    try {
      const rooms = await matrixDirectMessageService.getDMRooms(false)
      return rooms.map((room) => room.roomId)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to get DM rooms: ${err}`)
      throw err
    }
  }

  /** 邀请用户加入房间。 */
  async inviteUser(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomActionFacade.inviteUser(roomId, userId)
      logger.info(`[MatrixContact] Invited user ${userId} to room ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to invite user: ${err}`)
      throw err
    }
  }

  /** 将用户踢出房间（可选原因）。 */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      await matrixRoomActionFacade.kickUser(roomId, userId, reason)
      logger.info(`[MatrixContact] Kicked user ${userId} from room ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to kick user: ${err}`)
      throw err
    }
  }

  /** 封禁房间成员（可选原因）。 */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      await matrixRoomActionFacade.banUser(roomId, userId, reason)
      logger.info(`[MatrixContact] Banned user ${userId} from room ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to ban user: ${err}`)
      throw err
    }
  }

  /** 解除房间成员封禁。 */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomActionFacade.unbanUser(roomId, userId)
      logger.info(`[MatrixContact] Unbanned user ${userId} from room ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to unban user: ${err}`)
      throw err
    }
  }

  /** 获取房间的成员列表。 */
  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    try {
      return await matrixRoomQueryFacade.getMembers(roomId)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to get room members: ${err}`)
      throw err
    }
  }

  /** 获取房间状态事件；`eventType` 为 `*` 时返回全部，否则按类型过滤。 */
  async getRoomState(roomId: string, eventType: string): Promise<MatrixEvent[]> {
    try {
      const stateEvents = await matrixRoomReadFacade.getRoomState(roomId)
      if (eventType === '*') {
        return stateEvents as MatrixEvent[]
      }

      return (stateEvents as MatrixEvent[]).filter((event) => event.getType?.() === eventType)
    } catch (err) {
      logger.error(`[MatrixContact] Failed to get room state: ${err}`)
      throw err
    }
  }

  /** 批量按用户 ID 获取展示项（本地已缓存用户优先，未命中再查 profile）。 */
  async getUserByIds(uidList: string[]): Promise<UserItem[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        return []
      }

      const users: UserItem[] = []
      for (const uid of uidList) {
        const user = client.getUser(uid)
        if (user) {
          users.push(this.toUserItem(user, uid))
          continue
        }

        const profile = await this.getUserProfile(uid)
        if (profile) {
          users.push(
            this.toUserItem(
              {
                userId: profile.userId,
                ...(profile.displayName !== undefined ? { displayName: profile.displayName } : {}),
                ...(profile.avatarUrl !== undefined ? { avatarUrl: profile.avatarUrl } : {})
              },
              uid
            )
          )
        }
      }
      return users
    } catch (err) {
      logger.error(`[MatrixContact] Failed to get users by ids: ${err}`)
      throw err
    }
  }

  /** 添加好友（等价于获取或创建与该用户的私聊）。 */
  async addFriend(userId: string): Promise<DirectChatResult> {
    return this.getOrCreateDirectChat(userId)
  }

  /** 发送好友请求，并返回与目标用户的私聊房间 ID。 */
  async sendAddFriendRequest(userId: string, reason?: string): Promise<DirectChatResult> {
    try {
      const normalizedUserId = this.normalizeTargetUserId(userId)
      await matrixFriendOperations.sendFriendRequest(normalizedUserId, reason)
      const roomId = (await matrixDirectMessageService.getDmForUser(normalizedUserId, false)) ?? ''
      return { roomId }
    } catch (err) {
      logger.error(`[MatrixContact] Failed to send friend request: ${err}`)
      throw err
    }
  }
}

export const matrixContactService = new MatrixContactService()
