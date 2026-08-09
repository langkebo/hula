import type { IPublicRoomsChunkRoom, Room, Visibility } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import type {
  Space as SdkSpace,
  SpaceChild as SdkSpaceChild,
  SpaceManager as SdkSpaceManager,
  SpaceMember as SdkSpaceMember
} from '../sdk-compat'

const logger = createLogger('MatrixSpaceService')

export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: Visibility
  avatarUrl?: string
}

export interface SpaceInfo {
  spaceId: string
  name: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  childCount: number
}

export type { SdkSpaceChild as SpaceChild, SdkSpaceMember as SpaceMember }

class SpaceService extends BaseMatrixService {
  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getSpaceManager(): SdkSpaceManager {
    return this.getClient().getSpaceManager()
  }

  private sdkSpaceToSpaceInfo(space: SdkSpace): SpaceInfo {
    return {
      spaceId: space.space_id,
      name: space.name || '',
      topic: space.topic || undefined,
      avatarUrl: space.avatar_url || undefined,
      memberCount: 0,
      childCount: 0
    }
  }

  private normalizeSpaceTreePathItems(
    items: Array<{ space_id: string; name: string }>
  ): Array<{ space_id: string; name: string }> {
    const dedupedItems: Array<{ space_id: string; name: string }> = []

    for (const item of items) {
      if (!item.space_id) continue
      if (dedupedItems.some((candidate) => candidate.space_id === item.space_id)) continue
      dedupedItems.push({
        space_id: item.space_id,
        name: item.name || ''
      })
    }

    return dedupedItems
  }

  private async getSpaceTreePathViaParents(spaceId: string): Promise<Array<{ space_id: string; name: string }>> {
    try {
      const parentSpaces = await this.getRoomParentSpaces(spaceId)
      if (!parentSpaces.length) {
        return []
      }

      const directParent = parentSpaces[0]
      const parentPath = await this.getSpaceTreePathViaParents(directParent.spaceId)

      return this.normalizeSpaceTreePathItems([
        ...parentPath,
        {
          space_id: directParent.spaceId,
          name: directParent.name || ''
        },
        {
          space_id: spaceId,
          name: (await this.getSpace(spaceId))?.name || ''
        }
      ])
    } catch (err) {
      logger.error(`[Space] 通过父空间回退树路径失败: ${spaceId}, ${err}`)
      return []
    }
  }

  private roomToSpaceInfo(room: Room): SpaceInfo {
    return {
      spaceId: room.roomId,
      name: room.name || '',
      topic: room.topic || undefined,
      avatarUrl: room.getMxcAvatarUrl() || undefined,
      memberCount: room.getJoinedMembers().length,
      childCount: this.getSpaceChildIds(room).length
    }
  }

  private getSpaceChildIds(room: Room): string[] {
    const childEvents = room.currentState.getStateEvents('m.space.child')
    return childEvents.map((e) => e.getStateKey()).filter((key): key is string => !!key)
  }

  // ---------------------------------------------------------------------------
  // Space CRUD
  // ---------------------------------------------------------------------------

  async createSpace(options: SpaceOptions): Promise<SpaceInfo | null> {
    const client = this.getClient()
    try {
      // 注意：不能把 `m.room.create` 放进 `initial_state` —— 它由服务端在创建房间时
      // 自动生成，客户端显式提供会被 synapse(-rust) 拒绝并返回 400
      // （errcode M_INVALID_PARAM / "m.room.create cannot be supplied in initial_state"）。
      // 创建 Space 的正确方式是用 `room_types: ['m.space']`（下面已设置）。
      const { room_id } = await client.createRoom({
        name: options.name,
        topic: options.topic,
        visibility: options.visibility,
        room_types: ['m.space'],
        initial_state: [
          ...(options.avatarUrl
            ? [
                {
                  type: 'm.room.avatar',
                  state_key: '',
                  content: { url: options.avatarUrl }
                }
              ]
            : [])
        ]
      })

      logger.info(`[Space] Space 已创建: ${room_id}`)

      // Register with SpaceManager on the backend
      try {
        const manager = this.getSpaceManager()
        await manager.createSpace({
          room_id,
          name: options.name,
          topic: options.topic,
          avatar_url: options.avatarUrl,
          visibility: options.visibility === 'public' ? 'public' : 'private'
        })
        logger.info(`[Space] Space 已注册到后端: ${room_id}`)
      } catch (mgrErr) {
        logger.info(`[Space] SpaceManager 注册失败（非致命）: ${mgrErr}`)
      }

      return {
        spaceId: room_id,
        name: options.name,
        topic: options.topic,
        avatarUrl: options.avatarUrl,
        memberCount: 1,
        childCount: 0
      }
    } catch (err) {
      logger.error(`[Space] 创建 Space 失败: ${err}`)
      throw err
    }
  }

  async getSpace(spaceId: string): Promise<SpaceInfo | null> {
    try {
      const manager = this.getSpaceManager()
      const space = await manager.getSpace(spaceId)
      const info = this.sdkSpaceToSpaceInfo(space)

      // Enrich with local Room data when available
      const client = this.getClient()
      const room = client.getRoom(spaceId)
      if (room) {
        info.memberCount = room.getJoinedMembers().length
        info.childCount = this.getSpaceChildIds(room).length
      } else {
        // Try to get stats from SpaceManager
        try {
          const stats = await manager.getSpaceStats(spaceId)
          info.memberCount = stats.memberCount
          info.childCount = stats.childCount
        } catch {
          // Stats unavailable, keep defaults
        }
      }

      return info
    } catch (err) {
      // Fallback to local Room-based approach
      const errMsg = err instanceof Error ? err.message : String(err)
      if (!errMsg.includes('M_NOT_FOUND') && !errMsg.includes('404')) {
        logger.error(`[Space] SpaceManager 获取 Space 失败: ${err}`)
      }
      try {
        const client = this.getClient()
        const room = client.getRoom(spaceId)
        if (!room) return null
        return this.roomToSpaceInfo(room)
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取 Space 失败: ${fallbackErr}`)
        return null
      }
    }
  }

  async updateSpace(spaceId: string, options: Partial<SpaceOptions>): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.updateSpace(spaceId, {
        name: options.name,
        topic: options.topic,
        avatar_url: options.avatarUrl
      })
      logger.info(`[Space] Space 已更新: ${spaceId}`)
    } catch (err) {
      // Fallback to raw client calls
      logger.info(`[Space] SpaceManager 更新失败，回退到客户端调用: ${err}`)
      const client = this.getClient()
      try {
        if (options.name) {
          await client.setRoomName(spaceId, options.name)
        }
        if (options.topic !== undefined) {
          await client.setRoomTopic(spaceId, options.topic)
        }
        if (options.avatarUrl) {
          await client.setRoomAvatar(spaceId, options.avatarUrl)
        }
        logger.info(`[Space] Space 已更新（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 更新 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async deleteSpace(spaceId: string): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.deleteSpace(spaceId)
      logger.info(`[Space] Space 已删除: ${spaceId}`)
    } catch (err) {
      // Fallback to leaving the room
      logger.info(`[Space] SpaceManager 删除失败，回退到离开房间: ${err}`)
      const client = this.getClient()
      try {
        await client.leave(spaceId)
        logger.info(`[Space] Space 已删除（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 删除 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Space membership
  // ---------------------------------------------------------------------------

  async getSpaceMembers(spaceId: string): Promise<SdkSpaceMember[]> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceMembers(spaceId)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取成员失败，回退: ${err}`)
      // Fallback: return basic member info from local room data
      const client = this.getClient()
      try {
        const room = client.getRoom(spaceId)
        if (room) {
          return room.getJoinedMembers().map((m) => ({
            space_id: spaceId,
            user_id: m.userId
          }))
        }
        const memberEvents = client.getRoomMembers(spaceId)
        return memberEvents.map((m) => ({
          space_id: spaceId,
          user_id: m.userId
        }))
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取成员也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  async inviteToSpace(spaceId: string, userId: string): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.inviteToSpace(spaceId, userId)
      logger.info(`[Space] 邀请用户到 Space 成功: ${userId} -> ${spaceId}`)
    } catch (err) {
      // Fallback to raw client invite
      logger.info(`[Space] SpaceManager 邀请失败，回退到客户端调用: ${err}`)
      const client = this.getClient()
      try {
        await client.invite(spaceId, userId)
        logger.info(`[Space] 邀请用户到 Space 成功（回退）: ${userId} -> ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 邀请用户到 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async joinSpace(spaceId: string, viaServers?: string[]): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.joinSpace(spaceId, viaServers ? { via_servers: viaServers } : undefined)
      logger.info(`[Space] 加入 Space 成功: ${spaceId}`)
    } catch (err) {
      // Fallback to raw client join
      logger.info(`[Space] SpaceManager 加入失败，回退到客户端调用: ${err}`)
      const client = this.getClient()
      try {
        await client.joinRoom(spaceId, { viaServers })
        logger.info(`[Space] 加入 Space 成功（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 加入 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.leaveSpace(spaceId)
      logger.info(`[Space] 离开 Space 成功: ${spaceId}`)
    } catch (err) {
      // Fallback to raw client leave
      logger.info(`[Space] SpaceManager 离开失败，回退到客户端调用: ${err}`)
      const client = this.getClient()
      try {
        await client.leave(spaceId)
        logger.info(`[Space] 离开 Space 成功（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 离开 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Space children
  // ---------------------------------------------------------------------------

  async getSpaceChildren(spaceId: string): Promise<SdkSpaceChild[]> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceChildren(spaceId)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取子房间失败，回退: ${err}`)
      // Fallback to local Room state events
      const client = this.getClient()
      try {
        const room = client.getRoom(spaceId)
        if (!room) return []
        const childEvents = room.currentState.getStateEvents('m.space.child')
        const children: SdkSpaceChild[] = []
        for (const e of childEvents) {
          const key = e.getStateKey()
          if (!key) continue
          const content = e.getContent() as { via?: string[]; suggested?: boolean; order?: string }
          children.push({
            space_id: spaceId,
            room_id: key,
            via_servers: content.via || [],
            is_suggested: content.suggested ?? false,
            order: content.order
          })
        }
        return children
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取子房间也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  async removeChild(spaceId: string, roomId: string): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.removeChild(spaceId, roomId)
      logger.info(`[Space] 子房间已移除: ${roomId} 从 ${spaceId}`)
    } catch (err) {
      // Fallback to raw state event
      logger.info(`[Space] SpaceManager 移除子房间失败，回退到状态事件: ${err}`)
      const client = this.getClient()
      try {
        await client.sendStateEvent(spaceId, 'm.space.child', {}, roomId)
        logger.info(`[Space] 子房间已移除（回退）: ${roomId} 从 ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 移除子房间失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  /** 添加子房间（支持 via/suggested 选项，为当前唯一对外的子房间添加入口） */
  async addChildToSpace(
    spaceId: string,
    roomId: string,
    options?: { via?: string[]; suggested?: boolean }
  ): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.addChild(spaceId, {
        room_id: roomId,
        via_servers: options?.via || [],
        suggested: options?.suggested || false
      })
      logger.info(`[Space] 子房间已添加: ${roomId} 到 ${spaceId}`)
    } catch (err) {
      // Fallback to raw state event
      logger.info(`[Space] SpaceManager 添加子房间失败，回退到状态事件: ${err}`)
      const client = this.getClient()
      try {
        await client.sendStateEvent(
          spaceId,
          'm.space.child',
          {
            via: options?.via || [],
            suggested: options?.suggested || false
          },
          roomId
        )
        logger.info(`[Space] 子房间已添加（回退）: ${roomId} 到 ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 添加子房间失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  /** @deprecated Use {@link removeChild} instead. Kept for backward compatibility. */
  async removeChildFromSpace(spaceId: string, roomId: string): Promise<void> {
    return this.removeChild(spaceId, roomId)
  }

  // ---------------------------------------------------------------------------
  // Space queries
  // ---------------------------------------------------------------------------

  async getRoomParentSpaces(roomId: string): Promise<SpaceInfo[]> {
    // 统一入口：SDK SpaceManager → REST /spaces/room/:roomId/parents → 本地状态过滤
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getRoomParentSpaces(roomId)
      return spaces.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      logger.info(`[Space] SpaceManager 获取父空间失败，回退 REST: ${err}`)
    }
    try {
      const client = this.getClient()
      const result = await client.http.authedRequest('GET', `/spaces/room/${encodeURIComponent(roomId)}/parents`)
      const arr = Array.isArray(result) ? result : ((result as { spaces?: SdkSpace[] }).spaces ?? [])
      return arr.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      logger.info(`[Space] REST 获取父空间失败，回退本地过滤: ${err}`)
    }
    try {
      const client = this.getClient()
      const rooms = client.getRooms().filter((room) => room.isSpaceRoom())
      const parentSpaces: SpaceInfo[] = []
      for (const space of rooms) {
        const childIds = this.getSpaceChildIds(space)
        if (childIds.includes(roomId)) {
          parentSpaces.push(this.roomToSpaceInfo(space))
        }
      }
      return parentSpaces
    } catch (fallbackErr) {
      logger.error(`[Space] 回退获取父空间也失败: ${fallbackErr}`)
      return []
    }
  }

  async searchSpaces(query: string, limit = 10): Promise<SpaceInfo[]> {
    if (!query.trim()) return []
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.searchSpaces(query, limit)
      return spaces.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      logger.warn('SpaceManager 搜索失败，回退:', err)
      // Fallback to API + local search
      try {
        const apiResults = await this.searchSpacesViaApi(query, limit)
        if (apiResults.length > 0) return apiResults
      } catch (apiErr) {
        logger.warn('Space API 搜索也失败:', apiErr)
      }
      const client = this.getClient()
      try {
        const allSpaces = client.getRooms().filter((room) => room.isSpaceRoom())
        const q = query.toLowerCase()
        return allSpaces
          .filter((room) => (room.name || '').toLowerCase().includes(q))
          .slice(0, limit)
          .map((room) => this.roomToSpaceInfo(room))
      } catch (fallbackErr) {
        logger.error(`[Space] 本地搜索空间失败: ${fallbackErr}`)
        return []
      }
    }
  }

  async getUserSpaces(): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      // 浏览器 dev 模式下 SpaceManager 可能等待 sync 永不 resolve，加 3s 超时避免挂起
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getUserSpaces timeout')), 3000)
      )
      const spaces = await Promise.race([manager.getUserSpaces(), timeoutPromise])
      return spaces.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      // 客户端未就绪时静默返回空列表，不输出错误日志
      const client = matrixClientService.getClient()
      if (!client) {
        return []
      }
      logger.error(`[Space] SpaceManager 获取用户 Spaces 失败，回退: ${err}`)
      // Fallback to local room list
      try {
        const rooms = client.getRooms()
        return rooms.filter((room: Room) => room.isSpaceRoom()).map((room: Room) => this.roomToSpaceInfo(room))
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取用户 Spaces 也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  // 别名方法，与 getUserSpaces 功能相同
  async getSpaces(): Promise<SpaceInfo[]> {
    return this.getUserSpaces()
  }

  async getPublicSpaces(limit: number = 50): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const response = await manager.getPublicSpaces({ limit })
      const rawList = response.spaces ?? response.chunk ?? response.rooms ?? []
      return rawList.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取公开空间失败，回退: ${err}`)
      // Fallback to client.publicRooms
      const client = this.getClient()
      try {
        const result = await client.publicRooms({ limit, filter: { room_types: ['m.space'] } })
        return (result.chunk ?? []).map((room: IPublicRoomsChunkRoom) => ({
          spaceId: room.room_id,
          name: room.name || '',
          topic: room.topic || undefined,
          avatarUrl: room.avatar_url || undefined,
          memberCount: room.num_joined_members ?? 0,
          childCount: 0
        }))
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取公开空间也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Space rooms
  // ---------------------------------------------------------------------------

  async getSpaceRooms(spaceId: string): Promise<Array<{ roomId: string; name: string; avatarUrl?: string }>> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getSpaceRooms(spaceId)
      return spaces.map((s) => ({
        roomId: s.room_id,
        name: s.name || '',
        avatarUrl: s.avatar_url || undefined
      }))
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取 Space 房间列表失败，回退: ${err}`)
      // Fallback to local room lookup
      const client = this.getClient()
      try {
        const childIds: string[] = []
        const room = client.getRoom(spaceId)
        if (room) {
          childIds.push(...this.getSpaceChildIds(room))
        }
        const rooms: Array<{ roomId: string; name: string; avatarUrl?: string }> = []
        for (const childId of childIds) {
          const childRoom = client.getRoom(childId)
          if (childRoom) {
            rooms.push({
              roomId: childId,
              name: childRoom.name || '',
              avatarUrl: childRoom.getMxcAvatarUrl() || undefined
            })
          }
        }
        return rooms
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取 Space 房间列表也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Space summary & hierarchy
  // ---------------------------------------------------------------------------

  async getSpaceHierarchy(
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    try {
      const manager = this.getSpaceManager()
      return (await manager.getSpaceHierarchyPage(spaceId, {
        from: options?.from,
        limit: options?.limit,
        max_depth: options?.maxDepth,
        suggested_only: options?.suggestedOnly
      })) as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取空间层级失败，回退: ${spaceId}, ${err}`)
      // Fallback to raw HTTP
      const client = this.getClient()
      try {
        const queryParams: Record<string, string> = {}
        if (options?.from) queryParams.from = options.from
        if (options?.limit) queryParams.limit = String(options.limit)
        if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
        if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

        const result = await authedRequestWithPath<{ rooms: Array<Record<string, unknown>>; next_batch?: string }>(
          client,
          'GET',
          MATRIX_PATHS.SPACE.HIERARCHY(spaceId),
          Object.keys(queryParams).length > 0 ? queryParams : undefined
        )
        return result
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取空间层级也失败: ${spaceId}, ${fallbackErr}`)
        return { rooms: [] }
      }
    }
  }

  async getSpaceTreePath(spaceId: string): Promise<Array<{ space_id: string; name: string }>> {
    try {
      const manager = this.getSpaceManager()
      const result = (await manager.getSpaceTreePath(spaceId)) as { path?: Array<{ space_id: string; name: string }> }
      return this.normalizeSpaceTreePathItems(result.path ?? [])
    } catch (err) {
      logger.info(`[Space] SpaceManager tree_path 失败，回退: ${spaceId}, ${err}`)
      // Fallback to raw HTTP
      const client = this.getClient()
      try {
        const result = (await client.http.authedRequest('GET', MATRIX_PATHS.SPACE.TREE_PATH(spaceId))) as {
          path?: Array<{ space_id: string; name: string }>
        }
        return this.normalizeSpaceTreePathItems(result.path ?? [])
      } catch (httpErr) {
        logger.info(`[Space] HTTP tree_path 也不可用，回退到 parents 链路: ${spaceId}, ${httpErr}`)
        return await this.getSpaceTreePathViaParents(spaceId)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal REST gateway（私有，仅作 SDK 轨的内部回退，不对外暴露）
  // ---------------------------------------------------------------------------

  private async searchSpacesViaApi(query: string, limit = 10): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.searchSpaces(query, limit)
      return spaces.map((space) => this.sdkSpaceToSpaceInfo(space))
    } catch (err) {
      logger.error(`[Space] SpaceManager 搜索空间失败: ${err}`)
    }
    try {
      const client = this.getClient()
      const result = await client.http.authedRequest('GET', '/spaces/search', {
        search_term: query,
        limit: String(limit)
      })
      const spaces = (result as { spaces?: SdkSpace[] }).spaces ?? []
      return spaces.map((space) => this.sdkSpaceToSpaceInfo(space))
    } catch (err) {
      logger.error(`[Space] HTTP 搜索空间失败: ${err}`)
      return []
    }
  }
}

export const matrixSpaceService = new SpaceService()
