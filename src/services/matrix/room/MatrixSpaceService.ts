import { error, info } from '@tauri-apps/plugin-log'
import type { Room, Visibility } from 'matrix-js-sdk'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { BaseMatrixService } from '../BaseMatrixService'
import { MATRIX_PATHS } from '../paths'

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

class SpaceService extends BaseMatrixService {
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
      error(`[Space] 通过父空间回退树路径失败: ${spaceId}, ${err}`)
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
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        info(`[Space] v3/spaces/members 不可用，回退到 hierarchy 端点: ${spaceId}`)
        return this.getSpaceMembersViaHierarchy(spaceId)
      }
      error(`[Space] 获取 Space 成员失败: ${err}`)
      return []
    }
  }

  private async getSpaceMembersViaHierarchy(spaceId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(spaceId)
      if (room) {
        return room.getJoinedMembers().map((m) => m.userId)
      }
      const memberEvents = client.getRoomMembers(spaceId)
      return memberEvents.map((m) => m.userId)
    } catch (hierarchyErr) {
      info(`[Space] SDK getRoomMembers 也失败，尝试标准 /members 端点: ${hierarchyErr}`)
      try {
        const result = (await client.http.authedRequest(
          'GET',
          `/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/members`
        )) as { chunk?: Array<{ user_id?: string; sender?: string; state_key?: string }> }
        return (result.chunk ?? []).map((e) => e.state_key ?? e.user_id ?? e.sender ?? '').filter(Boolean)
      } catch (finalErr) {
        error(`[Space] 所有回退端点均失败: ${finalErr}`)
        return []
      }
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
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        info(`[Space] v3/spaces/members API 不可用，回退到 SDK 本地数据: ${spaceId}`)
        const room = client.getRoom(spaceId)
        if (room) {
          return room.getJoinedMembers().map((m) => ({ user_id: m.userId, displayname: m.name || m.userId }))
        }
      }
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

  async searchSpaces(query: string, limit = 10): Promise<SpaceInfo[]> {
    if (!query.trim()) return []
    try {
      const apiResults = await this.searchSpacesViaApi(query, limit)
      if (apiResults.length > 0) return apiResults
    } catch {
      // fallback below
    }
    const client = this.getClient()
    try {
      const allSpaces = client.getRooms().filter((room) => room.isSpaceRoom())
      const q = query.toLowerCase()
      return allSpaces
        .filter((room) => (room.name || '').toLowerCase().includes(q))
        .slice(0, limit)
        .map((room) => this.roomToSpaceInfo(room))
    } catch (err) {
      error(`[Space] 本地搜索空间失败: ${err}`)
      return []
    }
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
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        info(`[Space] v3/spaces/rooms 不可用，回退到 hierarchy 端点: ${spaceId}`)
        try {
          const hierarchy = await this.getSpaceHierarchy(spaceId, { limit: 100 })
          return hierarchy.rooms.filter((r) => r.room_id !== spaceId)
        } catch (hierarchyErr) {
          info(`[Space] hierarchy 也失败，回退到标准 /state 端点: ${hierarchyErr}`)
          try {
            const stateEvents = (await client.http.authedRequest(
              'GET',
              `/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state`
            )) as Array<Record<string, unknown>>
            return stateEvents
              .filter((e) => e.type === 'm.space.child' && e.state_key)
              .map((e) => ({ room_id: e.state_key, via: (e.content as Record<string, unknown>)?.via ?? [] }))
          } catch (finalErr) {
            error(`[Space] 所有回退端点均失败: ${finalErr}`)
          }
        }
      }
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
        MATRIX_PATHS.SPACE.HIERARCHY(spaceId),
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
        MATRIX_PATHS.SPACE.HIERARCHY_V1(spaceId),
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
      return this.normalizeSpaceTreePathItems(result.path ?? [])
    } catch (err) {
      info(`[Space] tree_path 不可用，回退到 parents 链路: ${spaceId}, ${err}`)
      return await this.getSpaceTreePathViaParents(spaceId)
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

  async getRoomSpaceInfo(roomId: string): Promise<SpaceInfo | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/spaces/room/${encodeURIComponent(roomId)}`
      )) as Record<string, unknown>
      if (!result || !result.space_id) return null
      return {
        spaceId: result.space_id as string,
        name: (result.name as string) || '',
        topic: (result.topic as string) || undefined,
        avatarUrl: (result.avatar_url as string) || undefined,
        memberCount: (result.member_count as number) ?? 0,
        childCount: (result.child_count as number) ?? 0
      }
    } catch (err) {
      error(`[Space] 获取房间空间信息失败: ${roomId}, ${err}`)
      return null
    }
  }

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
      await client.http.authedRequest('GET', MATRIX_PATHS.SPACE.ROOM_HIERARCHY(spaceId), {
        max_depth: '1'
      })
      return { requiresAuth: false, accessible: true }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_UNAUTHORIZED') || errMsg.includes('401')) {
        info(`[Space] 空间 ${spaceId} 需要登录后才能访问`)
        return { requiresAuth: true, accessible: false, reason: '该空间需要登录后才能浏览' }
      }
      if (errMsg.includes('M_FORBIDDEN') || errMsg.includes('403')) {
        return { requiresAuth: true, accessible: false, reason: '您没有权限访问该空间' }
      }
      if (errMsg.includes('M_NOT_FOUND') || errMsg.includes('404')) {
        return { requiresAuth: false, accessible: false, reason: '空间不存在或已被删除' }
      }
      error(`[Space] 检查空间可访问性失败: ${err}`)
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
          info(`[Space] 匿名访问空间 ${spaceId} 需要登录`)
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
        error(`[Space] 匿名获取空间层级失败: ${err}`)
        return { rooms: [] }
      }
    }

    try {
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.maxDepth) queryParams.max_depth = String(options.maxDepth)
      if (options?.suggestedOnly) queryParams.suggested_only = String(options.suggestedOnly)

      const result = await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.SPACE.ROOM_HIERARCHY(spaceId),
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('M_UNAUTHORIZED') || errMsg.includes('401')) {
        info(`[Space] 访问空间 ${spaceId} 需要登录`)
        return { rooms: [], requiresAuth: true, authMessage: '请登录后浏览空间内容' }
      }
      if (errMsg.includes('M_FORBIDDEN') || errMsg.includes('403')) {
        return { rooms: [], requiresAuth: true, authMessage: '您没有权限访问该空间' }
      }
      error(`[Space] 获取空间层级失败: ${spaceId}, ${err}`)
      return { rooms: [] }
    }
  }

  isSpace(roomId: string): boolean {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    return room?.isSpaceRoom() ?? false
  }
}

export const matrixSpaceService = new SpaceService()
