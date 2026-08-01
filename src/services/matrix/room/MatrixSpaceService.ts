import type { IPublicRoomsChunkRoom, Room, Visibility } from 'matrix-js-sdk'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
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
      const parentSpaces = await this.getRoomParentSpacesViaApi(spaceId)
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
      const { room_id } = await client.createRoom({
        name: options.name,
        topic: options.topic,
        visibility: options.visibility,
        room_types: ['m.space'],
        initial_state: [
          {
            type: 'm.room.create',
            state_key: '',
            content: { type: 'm.space' }
          },
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

  async addChild(spaceId: string, roomId: string, order?: string): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.addChild(spaceId, { room_id: roomId, via_servers: [], suggested: false })
      logger.info(`[Space] 子房间已添加: ${roomId} 到 ${spaceId}`)
    } catch (err) {
      // Fallback to raw state event
      logger.info(`[Space] SpaceManager 添加子房间失败，回退到状态事件: ${err}`)
      const client = this.getClient()
      try {
        await client.sendStateEvent(spaceId, 'm.space.child', { via: [], suggested: false, order }, roomId)
        logger.info(`[Space] 子房间已添加（回退）: ${roomId} 到 ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 添加子房间失败: ${fallbackErr}`)
        throw fallbackErr
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

  /** @deprecated Use {@link addChild} instead. Kept for backward compatibility. */
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

  async getSpaceByRoom(roomId: string): Promise<SpaceInfo | null> {
    try {
      const manager = this.getSpaceManager()
      const space = await manager.getSpaceByRoom(roomId)
      return this.sdkSpaceToSpaceInfo(space)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        return null
      }
      logger.error(`[Space] SpaceManager 获取房间所属空间失败: ${err}`)
      return null
    }
  }

  async getRoomParentSpaces(roomId: string): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getRoomParentSpaces(roomId)
      return spaces.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取父空间失败，回退: ${err}`)
      // Fallback to local filtering
      const client = this.getClient()
      try {
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
      const spaces = await manager.getUserSpaces()
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

  async getSpaceRoomsViaApi(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getSpaceRooms(spaceId)
      return spaces as unknown as Array<Record<string, unknown>>
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        logger.info(`[Space] v3/spaces/rooms 不可用，回退到 hierarchy 端点: ${spaceId}`)
        try {
          const hierarchy = await this.getSpaceHierarchy(spaceId, { limit: 100 })
          return hierarchy.rooms.filter((r) => r.room_id !== spaceId)
        } catch (hierarchyErr) {
          logger.info(`[Space] hierarchy 也失败，回退到标准 /state 端点: ${hierarchyErr}`)
          try {
            const stateEvents = await this.getClient().getSpaceManager().getRoomStateEventsRaw(spaceId)
            return stateEvents
              .filter((e) => e.type === 'm.space.child' && e.state_key)
              .map((e) => ({ room_id: e.state_key, via: (e.content as Record<string, unknown>)?.via ?? [] }))
          } catch (finalErr) {
            logger.error(`[Space] 所有回退端点均失败: ${finalErr}`)
          }
        }
      }
      logger.error(`[Space] 通过API获取 Space 房间列表失败: ${err}`)
      return []
    }
  }

  // ---------------------------------------------------------------------------
  // Space state
  // ---------------------------------------------------------------------------

  async getSpaceState(spaceId: string): Promise<Array<{ type: string; stateKey: string; content: unknown }>> {
    try {
      const manager = this.getSpaceManager()
      const events = await manager.getSpaceState(spaceId)
      return (Array.isArray(events) ? events : []).map((e) => {
        const evt = e as Record<string, unknown>
        return {
          type: (evt.type as string) || '',
          stateKey: (evt.state_key as string) ?? '',
          content: evt.content
        }
      })
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取 Space 状态失败，回退: ${err}`)
      const client = this.getClient()
      try {
        const room = client.getRoom(spaceId)
        if (!room) return []
        const stateEvents = room.currentState.getStateEvents('m.space.child')
        return stateEvents.map((e) => ({
          type: e.getType(),
          stateKey: e.getStateKey() ?? '',
          content: e.getContent()
        }))
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取 Space 状态也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Space summary & hierarchy
  // ---------------------------------------------------------------------------

  async getSpaceSummary(spaceId: string): Promise<{
    space: SpaceInfo
    children: Array<{ roomId: string; name: string; avatarUrl?: string; memberCount: number; joinRule?: string }>
  } | null> {
    const client = this.getClient()
    try {
      const room = client.getRoom(spaceId)
      if (!room) return null
      const spaceInfo = this.roomToSpaceInfo(room)
      const childIds = this.getSpaceChildIds(room)
      const children = childIds.map((childId) => {
        const childRoom = client.getRoom(childId)
        return {
          roomId: childId,
          name: childRoom?.name || '',
          avatarUrl: childRoom?.getMxcAvatarUrl() || undefined,
          memberCount: childRoom?.getJoinedMembers().length ?? 0,
          joinRule: childRoom?.getJoinRule() ?? undefined
        }
      })
      return { space: spaceInfo, children }
    } catch (err) {
      logger.error(`[Space] 获取 Space 摘要失败: ${err}`)
      return null
    }
  }

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

        // 未迁移到 SDK SpaceManager.hierarchy.getSpaceHierarchyPage：前端路径使用
        // /_matrix/client/v1 前缀 (MATRIX_PATHS.SPACE.HIERARCHY)，而 SDK 使用
        // /_matrix/client/v3 前缀，路径不匹配，故保留 HTTP 调用。
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

  async getSpaceHierarchyV1(
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    try {
      const manager = this.getSpaceManager()
      return (await manager.getSpaceHierarchyV1(spaceId, {
        from: options?.from,
        limit: options?.limit,
        max_depth: options?.maxDepth,
        suggested_only: options?.suggestedOnly
      })) as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取空间层级v1失败，回退: ${spaceId}, ${err}`)
      // Fallback to raw HTTP
      const client = this.getClient()
      try {
        const queryParams: Record<string, string> = {}
        if (options?.from) queryParams.from = options.from
        if (options?.limit) queryParams.limit = String(options.limit)
        if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
        if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

        // 未迁移到 SDK SpaceManager.hierarchy.getSpaceHierarchyV1：前端路径使用
        // /_matrix/client/v1 前缀 (MATRIX_PATHS.SPACE.HIERARCHY_V1)，而 SDK 使用
        // /_matrix/client/v3 前缀，路径不匹配，故保留 HTTP 调用。
        const result = await authedRequestWithPath<{ rooms: Array<Record<string, unknown>>; next_batch?: string }>(
          client,
          'GET',
          MATRIX_PATHS.SPACE.HIERARCHY_V1(spaceId),
          Object.keys(queryParams).length > 0 ? queryParams : undefined
        )
        return result
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取空间层级v1也失败: ${spaceId}, ${fallbackErr}`)
        return { rooms: [] }
      }
    }
  }

  async getSpaceSummaryWithChildren(spaceId: string): Promise<{
    space: SpaceInfo
    children: Array<Record<string, unknown>>
  } | null> {
    try {
      const manager = this.getSpaceManager()
      const result = (await manager.getSpaceSummaryWithChildren(spaceId)) as Record<string, unknown>

      const spaceData = result.space as Record<string, unknown> | undefined
      if (!spaceData) return null

      return {
        space: {
          spaceId: (spaceData.space_id as string) || (spaceData.room_id as string) || '',
          name: (spaceData.name as string) || '',
          topic: (spaceData.topic as string) || undefined,
          avatarUrl: (spaceData.avatar_url as string) || undefined,
          memberCount: (spaceData.member_count as number) ?? 0,
          childCount: (spaceData.child_count as number) ?? 0
        },
        children: (result.children as Array<Record<string, unknown>>) ?? []
      }
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取空间摘要含子级失败: ${spaceId}, ${err}`)
      return null
    }
  }

  async getSpaceTreePath(spaceId: string): Promise<Array<{ space_id: string; name: string }>> {
    try {
      const manager = this.getSpaceManager()
      const result = (await manager.getSpaceTreePath(spaceId)) as { path?: Array<{ space_id: string; name: string }> }
      return this.normalizeSpaceTreePathItems(result.path ?? [])
    } catch (err) {
      logger.info(`[Space] SpaceManager tree_path 失败，回退到 parents 链路: ${spaceId}, ${err}`)
      return await this.getSpaceTreePathViaParents(spaceId)
    }
  }

  // ---------------------------------------------------------------------------
  // API-based methods (kept for backward compatibility and as fallback paths)
  // ---------------------------------------------------------------------------

  async getSpaceMembersViaApi(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const manager = this.getSpaceManager()
      const members = await manager.getSpaceMembers(spaceId)
      return members as unknown as Array<Record<string, unknown>>
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        logger.info(`[Space] v3/spaces/members API 不可用，回退到 SDK 本地数据: ${spaceId}`)
        const client = this.getClient()
        const room = client.getRoom(spaceId)
        if (room) {
          return room.getJoinedMembers().map((m) => ({ user_id: m.userId, displayname: m.name || m.userId }))
        }
      }
      logger.error(`[Space] 通过API获取 Space 成员失败: ${err}`)
      return []
    }
  }

  async searchSpacesViaApi(query: string, limit = 10): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.searchSpaces(query, limit)
      return spaces.map((space) => this.sdkSpaceToSpaceInfo(space))
    } catch (err) {
      logger.error(`[Space] SpaceManager 搜索空间失败: ${err}`)
      return []
    }
  }

  async getSpaceStatistics(): Promise<Record<string, unknown>> {
    try {
      const manager = this.getSpaceManager()
      return (await manager.getSpaceStatistics()) as Record<string, unknown>
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取空间统计失败: ${err}`)
      return {}
    }
  }

  async getUserSpacesViaApi(): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getUserSpaces()
      return spaces.map((space) => this.sdkSpaceToSpaceInfo(space))
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取用户空间列表失败: ${err}`)
      return []
    }
  }

  async getRoomParentSpacesViaApi(roomId: string): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getRoomParentSpaces(roomId)
      return spaces.map((s) => this.sdkSpaceToSpaceInfo(s))
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取房间所属空间失败: ${roomId}, ${err}`)
      return []
    }
  }

  async getRoomSpaceInfo(roomId: string): Promise<SpaceInfo | null> {
    try {
      const manager = this.getSpaceManager()
      const space = await manager.getSpaceByRoom(roomId)
      return this.sdkSpaceToSpaceInfo(space)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        return null
      }
      logger.error(`[Space] SpaceManager 获取房间空间信息失败: ${roomId}, ${err}`)
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // Auth & public access
  // ---------------------------------------------------------------------------

  async checkSpaceRequiresAuth(spaceId: string): Promise<{
    requiresAuth: boolean
    accessible: boolean
    reason?: string
  }> {
    const client = this.getClient()
    if (!client) {
      return { requiresAuth: true, accessible: false, reason: '客户端未初始化，需要登录后浏览空间' }
    }

    try {
      // 未迁移到 SDK SpaceManager.hierarchy：前端路径为 /_matrix/client/v1/rooms/{id}/hierarchy
      // (ROOM_HIERARCHY)，而 SDK getSpaceHierarchyPage 为 /_matrix/client/v3/spaces/{id}/hierarchy，
      // 前缀与路径段均不匹配，故保留 HTTP 调用。
      await authedRequestWithPath(client, 'GET', MATRIX_PATHS.SPACE.ROOM_HIERARCHY(spaceId), {
        max_depth: '1'
      })
      return { requiresAuth: false, accessible: true }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_UNAUTHORIZED') || errMsg.includes('401')) {
        logger.info(`[Space] 空间 ${spaceId} 需要登录后才能访问`)
        return { requiresAuth: true, accessible: false, reason: '该空间需要登录后才能浏览' }
      }
      if (errMsg.includes('M_FORBIDDEN') || errMsg.includes('403')) {
        return { requiresAuth: true, accessible: false, reason: '您没有权限访问该空间' }
      }
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        return { requiresAuth: false, accessible: false, reason: '空间不存在或已被删除' }
      }
      logger.error(`[Space] 检查空间可访问性失败: ${err}`)
      return { requiresAuth: false, accessible: false, reason: '空间访问检测失败' }
    }
  }

  async getSpaceHierarchyPublic(
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    next_batch?: string
    requiresAuth?: boolean
    authMessage?: string
  }> {
    const client = this.getClient()
    if (!client) {
      try {
        const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
        const queryParams: Record<string, string> = {}
        if (options?.from) queryParams.from = options.from
        if (options?.limit) queryParams.limit = String(options.limit)
        if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
        if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

        const qs = Object.keys(queryParams).length > 0 ? '?' + new URLSearchParams(queryParams).toString() : ''
        const response = await getRuntimeAwareFetch()(
          `${homeserverUrl}${MATRIX_PATHS.SPACE.ROOM_HIERARCHY(spaceId)}${qs}`
        )

        if (response.status === 401) {
          logger.info(`[Space] 匿名访问空间 ${spaceId} 需要登录`)
          return { rooms: [], requiresAuth: true, authMessage: '请登录后浏览空间内容' }
        }
        if (response.status === 403) {
          return { rooms: [], requiresAuth: true, authMessage: '您没有权限访问该空间' }
        }
        if (!response.ok) {
          return { rooms: [] }
        }

        return (await response.json()) as { rooms: Array<Record<string, unknown>>; next_batch?: string }
      } catch (err) {
        logger.error(`[Space] 匿名获取空间层级失败: ${err}`)
        return { rooms: [] }
      }
    }

    try {
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
      if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

      // 未迁移到 SDK SpaceManager.hierarchy.getSpaceHierarchyPage：前端路径为
      // /_matrix/client/v1/rooms/{id}/hierarchy (ROOM_HIERARCHY)，而 SDK 为
      // /_matrix/client/v3/spaces/{id}/hierarchy，前缀与路径段均不匹配，故保留 HTTP 调用。
      const result = await authedRequestWithPath<{ rooms: Array<Record<string, unknown>>; next_batch?: string }>(
        client,
        'GET',
        MATRIX_PATHS.SPACE.ROOM_HIERARCHY(spaceId),
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_UNAUTHORIZED') || errMsg.includes('401')) {
        logger.info(`[Space] 访问空间 ${spaceId} 需要登录`)
        return { rooms: [], requiresAuth: true, authMessage: '请登录后浏览空间内容' }
      }
      if (errMsg.includes('M_FORBIDDEN') || errMsg.includes('403')) {
        return { rooms: [], requiresAuth: true, authMessage: '您没有权限访问该空间' }
      }
      logger.error(`[Space] 获取空间层级失败: ${spaceId}, ${err}`)
      return { rooms: [] }
    }
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  isSpace(roomId: string): boolean {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    return room?.isSpaceRoom() ?? false
  }
}

export const matrixSpaceService = new SpaceService()
