import { error, info } from '@tauri-apps/plugin-log'
import type { Room, Visibility } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'

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

class SpaceService {
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

  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

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

      info(`[Space] Space 已创建: ${room_id}`)

      return {
        spaceId: room_id,
        name: options.name,
        topic: options.topic,
        avatarUrl: options.avatarUrl,
        memberCount: 1,
        childCount: 0
      }
    } catch (err) {
      error(`[Space] 创建 Space 失败: ${err}`)
      throw err
    }
  }

  async getSpace(spaceId: string): Promise<SpaceInfo | null> {
    const client = this.getClient()
    try {
      const room = client.getRoom(spaceId)
      if (!room) return null
      return this.roomToSpaceInfo(room)
    } catch (err) {
      error(`[Space] 获取 Space 失败: ${err}`)
      return null
    }
  }

  async updateSpace(spaceId: string, options: Partial<SpaceOptions>): Promise<void> {
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
      info(`[Space] Space 已更新: ${spaceId}`)
    } catch (err) {
      error(`[Space] 更新 Space 失败: ${err}`)
      throw err
    }
  }

  async deleteSpace(spaceId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.leave(spaceId)
      info(`[Space] Space 已删除: ${spaceId}`)
    } catch (err) {
      error(`[Space] 删除 Space 失败: ${err}`)
      throw err
    }
  }

  private getSpaceChildIds(room: Room): string[] {
    const childEvents = room.currentState.getStateEvents('m.space.child')
    return childEvents.map((e) => e.getStateKey()).filter((key): key is string => !!key)
  }

  async getSpaceChildren(spaceId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(spaceId)
      if (!room) return []
      return this.getSpaceChildIds(room)
    } catch (err) {
      error(`[Space] 获取 Space 子房间失败: ${err}`)
      return []
    }
  }

  async addChildToSpace(
    spaceId: string,
    roomId: string,
    options?: { via?: string[]; suggested?: boolean }
  ): Promise<void> {
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
      info(`[Space] 子房间已添加: ${roomId} 到 ${spaceId}`)
    } catch (err) {
      error(`[Space] 添加子房间失败: ${err}`)
      throw err
    }
  }

  async removeChildFromSpace(spaceId: string, roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.sendStateEvent(spaceId, 'm.space.child', {}, roomId)
      info(`[Space] 子房间已移除: ${roomId} 从 ${spaceId}`)
    } catch (err) {
      error(`[Space] 移除子房间失败: ${err}`)
      throw err
    }
  }

  async getSpaceMembers(spaceId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(spaceId)
      if (room) {
        return room.getJoinedMembers().map((m) => m.userId)
      }
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/members`
      )) as { members?: Array<{ user_id: string }> }
      return (result.members ?? []).map((m) => m.user_id)
    } catch (err) {
      error(`[Space] 获取 Space 成员失败: ${err}`)
      return []
    }
  }

  async getSpaceMembersViaApi(spaceId: string): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/members`
      )) as { members?: Array<Record<string, unknown>> }
      return result.members ?? []
    } catch (err) {
      error(`[Space] 通过API获取 Space 成员失败: ${err}`)
      return []
    }
  }

  async getUserSpaces(): Promise<SpaceInfo[]> {
    const client = this.getClient()
    try {
      const rooms = client.getRooms()
      return rooms.filter((room) => room.isSpaceRoom()).map((room) => this.roomToSpaceInfo(room))
    } catch (err) {
      error(`[Space] 获取用户 Spaces 失败: ${err}`)
      return []
    }
  }

  // 别名方法，与 getUserSpaces 功能相同
  async getSpaces(): Promise<SpaceInfo[]> {
    return this.getUserSpaces()
  }

  async searchSpaces(_query: string, _limit = 10): Promise<SpaceInfo[]> {
    return []
  }

  async getSpaceRooms(spaceId: string): Promise<Array<{ roomId: string; name: string; avatarUrl?: string }>> {
    const client = this.getClient()
    try {
      const childIds = await this.getSpaceChildren(spaceId)
      const rooms: Array<{ roomId: string; name: string; avatarUrl?: string }> = []
      for (const childId of childIds) {
        const room = client.getRoom(childId)
        if (room) {
          rooms.push({
            roomId: childId,
            name: room.name || '',
            avatarUrl: room.getMxcAvatarUrl() || undefined
          })
        }
      }
      return rooms
    } catch (err) {
      error(`[Space] 获取 Space 房间列表失败: ${err}`)
      return []
    }
  }

  async getSpaceRoomsViaApi(spaceId: string): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/rooms`
      )) as { rooms?: Array<Record<string, unknown>> }
      return result.rooms ?? []
    } catch (err) {
      error(`[Space] 通过API获取 Space 房间列表失败: ${err}`)
      return []
    }
  }

  async getSpaceState(spaceId: string): Promise<Array<{ type: string; stateKey: string; content: unknown }>> {
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
    } catch (err) {
      error(`[Space] 获取 Space 状态失败: ${err}`)
      return []
    }
  }

  async inviteToSpace(spaceId: string, userId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.invite(spaceId, userId)
      info(`[Space] 邀请用户到 Space 成功: ${userId} -> ${spaceId}`)
    } catch (err) {
      error(`[Space] 邀请用户到 Space 失败: ${err}`)
      throw err
    }
  }

  async joinSpace(spaceId: string, viaServers?: string[]): Promise<void> {
    const client = this.getClient()
    try {
      await client.joinRoom(spaceId, { viaServers })
      info(`[Space] 加入 Space 成功: ${spaceId}`)
    } catch (err) {
      error(`[Space] 加入 Space 失败: ${err}`)
      throw err
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.leave(spaceId)
      info(`[Space] 离开 Space 成功: ${spaceId}`)
    } catch (err) {
      error(`[Space] 离开 Space 失败: ${err}`)
      throw err
    }
  }

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
      error(`[Space] 获取 Space 摘要失败: ${err}`)
      return null
    }
  }

  async getRoomParentSpaces(roomId: string): Promise<SpaceInfo[]> {
    const client = this.getClient()
    try {
      const spaces = client.getRooms().filter((room) => room.isSpaceRoom())
      const parentSpaces: SpaceInfo[] = []
      for (const space of spaces) {
        const childIds = this.getSpaceChildIds(space)
        if (childIds.includes(roomId)) {
          parentSpaces.push(this.roomToSpaceInfo(space))
        }
      }
      return parentSpaces
    } catch (err) {
      error(`[Space] 获取房间父空间失败: ${err}`)
      return []
    }
  }

  async getPublicSpaces(limit: number = 50): Promise<SpaceInfo[]> {
    const client = this.getClient()
    try {
      const result = await client.publicRooms({ limit, filter: { room_types: ['m.space'] } })
      return (result.chunk ?? []).map((room) => ({
        spaceId: room.room_id,
        name: room.name || '',
        topic: room.topic || undefined,
        avatarUrl: room.avatar_url || undefined,
        memberCount: room.joined_members ?? 0,
        childCount: 0
      }))
    } catch (err) {
      error(`[Space] 获取公开空间列表失败: ${err}`)
      return []
    }
  }

  async searchSpacesViaApi(query: string, limit = 10): Promise<SpaceInfo[]> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', '/_matrix/client/v3/spaces/search', {
        query,
        limit: String(limit)
      })) as { spaces?: Array<Record<string, unknown>> }
      return (result.spaces ?? []).map((space) => ({
        spaceId: space.space_id as string,
        name: (space.name as string) || '',
        topic: (space.topic as string) || undefined,
        avatarUrl: (space.avatar_url as string) || undefined,
        memberCount: (space.member_count as number) ?? 0,
        childCount: (space.child_count as number) ?? 0
      }))
    } catch (err) {
      error(`[Space] 搜索空间失败: ${err}`)
      return []
    }
  }

  async getSpaceStatistics(): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/spaces/statistics')
      return result as Record<string, unknown>
    } catch (err) {
      error(`[Space] 获取空间统计失败: ${err}`)
      return {}
    }
  }

  async getUserSpacesViaApi(): Promise<SpaceInfo[]> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', '/_matrix/client/v3/spaces/user')) as {
        spaces?: Array<Record<string, unknown>>
      }
      return (result.spaces ?? []).map((space) => ({
        spaceId: space.space_id as string,
        name: (space.name as string) || '',
        topic: (space.topic as string) || undefined,
        avatarUrl: (space.avatar_url as string) || undefined,
        memberCount: (space.member_count as number) ?? 0,
        childCount: (space.child_count as number) ?? 0
      }))
    } catch (err) {
      error(`[Space] 获取用户空间列表失败: ${err}`)
      return []
    }
  }

  async getSpaceHierarchy(
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
      if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/spaces/${encodeURIComponent(spaceId)}/hierarchy`,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      error(`[Space] 获取空间层级失败: ${spaceId}, ${err}`)
      return { rooms: [] }
    }
  }

  async getSpaceHierarchyV1(
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
      if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/spaces/${encodeURIComponent(spaceId)}/hierarchy/v1`,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      error(`[Space] 获取空间层级v1失败: ${spaceId}, ${err}`)
      return { rooms: [] }
    }
  }

  async getSpaceSummaryWithChildren(spaceId: string): Promise<{
    space: SpaceInfo
    children: Array<Record<string, unknown>>
  } | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/summary/with_children`
      )) as Record<string, unknown>

      const spaceData = result.space as Record<string, unknown> | undefined
      if (!spaceData) return null

      return {
        space: {
          spaceId: spaceData.space_id as string,
          name: (spaceData.name as string) || '',
          topic: (spaceData.topic as string) || undefined,
          avatarUrl: (spaceData.avatar_url as string) || undefined,
          memberCount: (spaceData.member_count as number) ?? 0,
          childCount: (spaceData.child_count as number) ?? 0
        },
        children: (result.children as Array<Record<string, unknown>>) ?? []
      }
    } catch (err) {
      error(`[Space] 获取空间摘要含子级失败: ${spaceId}, ${err}`)
      return null
    }
  }

  async getSpaceTreePath(spaceId: string): Promise<Array<{ space_id: string; name: string }>> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/tree_path`
      )) as { path?: Array<{ space_id: string; name: string }> }
      return result.path ?? []
    } catch (err) {
      error(`[Space] 获取空间树路径失败: ${spaceId}, ${err}`)
      return []
    }
  }

  async getRoomParentSpacesViaApi(roomId: string): Promise<SpaceInfo[]> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/room/${encodeURIComponent(roomId)}/parents`
      )) as Array<Record<string, unknown>>
      return result.map((space) => ({
        spaceId: space.space_id as string,
        name: (space.name as string) || '',
        topic: (space.topic as string) || undefined,
        avatarUrl: (space.avatar_url as string) || undefined,
        memberCount: (space.member_count as number) ?? 0,
        childCount: (space.child_count as number) ?? 0
      }))
    } catch (err) {
      error(`[Space] 获取房间所属空间失败: ${roomId}, ${err}`)
      return []
    }
  }

  isSpace(roomId: string): boolean {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    return room?.isSpaceRoom() ?? false
  }
}

export const matrixSpaceService = new SpaceService()
