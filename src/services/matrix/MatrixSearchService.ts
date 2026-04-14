import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import type { SearchResponse } from '@/types/matrix-api'
import { info } from '@tauri-apps/plugin-log'

export interface SearchEventContext {
  eventsBefore: Array<{
    eventId: string
    sender: string
    content: Record<string, unknown>
    timestamp: number
  }>
  eventsAfter: Array<{
    eventId: string
    sender: string
    content: Record<string, unknown>
    timestamp: number
  }>
  profileInfo?: {
    displayName?: string
    avatarUrl?: string
  }
}

export interface SearchResult {
  roomId: string
  eventId: string
  sender: string
  content: Record<string, unknown>
  timestamp: number
  roomName?: string
  context?: SearchEventContext
}

export interface RoomSearchResult {
  roomId: string
  roomName: string
  avatarUrl?: string
  memberCount: number
  isJoined: boolean
  roomType?: string
  isSpace?: boolean
  isEncrypted?: boolean
  canonicalAlias?: string
  joinRule?: string
}

export interface UserSearchResultItem {
  userId: string
  displayName?: string
  avatarUrl?: string
}

export interface PublicRoomsResponse {
  rooms: RoomSearchResult[]
  nextBatch?: string
  prevBatch?: string
  totalRooms: number
}

class MatrixSearchService extends BaseManager {
  async searchMessages(
    query: string,
    options?: {
      roomId?: string
      limit?: number
      beforeLimit?: number
      afterLimit?: number
    },
    throwOnError = true
  ): Promise<SearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const searchParams: any = {
        search_categories: {
          room_events: {
            search_term: query,
            filter: {
              limit: options?.limit || 20,
              rooms: options?.roomId ? [options.roomId] : undefined
            },
            order_by: 'recent',
            event_context: {
              before_limit: options?.beforeLimit || 3,
              after_limit: options?.afterLimit || 3,
              include_profile: true
            }
          }
        }
      }

      const response = await client.search(searchParams)
      const results = this.parseSearchResults(response as SearchResponse)

      info(`[MatrixSearch] 搜索完成: "${query}" 找到 ${results.length} 条结果`)
      return results
    } catch (err) {
      return this.handleError(err, 'searchMessages', [] as SearchResult[], throwOnError)
    }
  }

  private parseSearchResults(response: SearchResponse): SearchResult[] {
    const results: SearchResult[] = []
    const roomEvents = response.search_categories?.room_events

    if (!roomEvents?.results) return results

    for (const result of roomEvents.results) {
      const event = result.result
      const context = result.context

      results.push({
        roomId: event.room_id,
        eventId: event.event_id,
        sender: event.sender,
        content: event.content,
        timestamp: event.origin_server_ts,
        roomName: context?.profile_info?.[event.room_id]?.displayname,
        context: context
          ? {
              eventsBefore: (context.events_before || []).map((e: any) => ({
                eventId: e.event_id || '',
                sender: e.sender || '',
                content: e.content || {},
                timestamp: e.origin_server_ts || 0
              })),
              eventsAfter: (context.events_after || []).map((e: any) => ({
                eventId: e.event_id || '',
                sender: e.sender || '',
                content: e.content || {},
                timestamp: e.origin_server_ts || 0
              }))
            }
          : undefined
      })
    }

    return results
  }

  async searchInRoom(roomId: string, query: string, limit: number = 20, throwOnError = true): Promise<SearchResult[]> {
    return this.searchMessages(
      query,
      {
        roomId,
        limit,
        beforeLimit: 5,
        afterLimit: 5
      },
      throwOnError
    )
  }

  async searchUsers(query: string, limit: number = 10, throwOnError = true): Promise<UserSearchResultItem[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const response = await client.searchUserDirectory({
        term: query,
        limit
      })

      const results: UserSearchResultItem[] = (response.results || []).map(
        (user: { user_id: string; display_name?: string; avatar_url?: string }) => ({
          userId: user.user_id,
          displayName: user.display_name,
          avatarUrl: user.avatar_url
        })
      )

      info(`[MatrixSearch] 用户搜索完成: "${query}" 找到 ${results.length} 个用户`)
      return results
    } catch (err) {
      return this.handleError(err, 'searchUsers', [] as UserSearchResultItem[], throwOnError)
    }
  }

  async searchRooms(query: string): Promise<RoomSearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    const myUserId = client.getUserId()
    const lowerQuery = query.toLowerCase()

    return rooms
      .filter((room) => {
        const roomName = room.name?.toLowerCase() || ''
        const roomId = room.roomId.toLowerCase()
        return roomName.includes(lowerQuery) || roomId.includes(lowerQuery)
      })
      .map((room) => {
        const member = room.getMember(myUserId || '')
        return {
          roomId: room.roomId,
          roomName: room.name || room.roomId,
          avatarUrl: room.getMxcAvatarUrl() || undefined,
          memberCount: room.getJoinedMemberCount(),
          isJoined: member?.membership === 'join'
        }
      })
      .sort((a, b) => a.roomName.localeCompare(b.roomName))
  }

  async getPublicRooms(
    server?: string,
    limit: number = 20,
    since?: string,
    throwOnError = true
  ): Promise<PublicRoomsResponse> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const manager = (client as any).getRoomSummaryManager?.() as any
      if (manager?.getPublicRooms) {
        const response = await manager.getPublicRooms(server ?? '', {
          limit,
          since
        })

        if (!response) {
          return { rooms: [], totalRooms: 0 }
        }

        const rooms: RoomSearchResult[] = (response.chunk || []).map((room: any) => ({
          roomId: room.room_id,
          roomName: room.name || room.room_id,
          avatarUrl: room.avatar_url,
          memberCount: room.num_joined_members ?? 0,
          isJoined: false,
          roomType: room.room_type,
          isSpace: room.room_type === 'm.space',
          canonicalAlias: room.canonical_alias,
          joinRule: room.join_rule
        }))

        info(`[MatrixSearch] 获取公开房间成功: ${rooms.length} 个房间`)

        return {
          rooms,
          nextBatch: response.next_batch,
          prevBatch: response.prev_batch,
          totalRooms: response.total_room_count_estimate || 0
        }
      }

      const response = await client.publicRooms({
        server,
        limit,
        since
      })

      const rooms: RoomSearchResult[] = (response.chunk || []).map((room: any) => ({
        roomId: room.room_id,
        roomName: room.name || room.room_id,
        avatarUrl: room.avatar_url,
        memberCount: room.num_joined_members ?? 0,
        isJoined: false,
        roomType: room.room_type,
        isSpace: room.room_type === 'm.space',
        canonicalAlias: room.canonical_alias,
        joinRule: room.join_rule
      }))

      info(`[MatrixSearch] 获取公开房间成功: ${rooms.length} 个房间`)

      return {
        rooms,
        nextBatch: response.next_batch,
        prevBatch: response.prev_batch,
        totalRooms: response.total_room_count_estimate || 0
      }
    } catch (err) {
      return this.handleError(err, 'getPublicRooms', { rooms: [], totalRooms: 0 } as PublicRoomsResponse, throwOnError)
    }
  }

  async searchPublicRooms(
    query: string,
    server?: string,
    limit: number = 20,
    throwOnError = true
  ): Promise<RoomSearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const manager = (client as any).getRoomSummaryManager?.() as any
      if (manager?.searchPublicRooms) {
        const rooms = await manager.searchPublicRooms(query, server ?? '', limit)

        return (rooms || []).map((room: any) => ({
          roomId: room.room_id,
          roomName: room.name || room.room_id,
          avatarUrl: room.avatar_url,
          memberCount: room.num_joined_members ?? 0,
          isJoined: false,
          roomType: room.room_type,
          isSpace: room.room_type === 'm.space',
          canonicalAlias: room.canonical_alias,
          joinRule: room.join_rule
        }))
      }

      const response = await client.publicRooms({
        server,
        filter: {
          generic_search_term: query
        }
      })

      const rooms: RoomSearchResult[] = (response.chunk || []).map((room: any) => ({
        roomId: room.room_id,
        roomName: room.name || room.room_id,
        avatarUrl: room.avatar_url,
        memberCount: room.num_joined_members ?? 0,
        isJoined: false,
        roomType: room.room_type,
        isSpace: room.room_type === 'm.space',
        canonicalAlias: room.canonical_alias,
        joinRule: room.join_rule
      }))

      info(`[MatrixSearch] 搜索公开房间成功: "${query}" 找到 ${rooms.length} 个房间`)
      return rooms
    } catch (err) {
      return this.handleError(err, 'searchPublicRooms', [] as RoomSearchResult[], throwOnError)
    }
  }

  async getRoomDirectoryVisibility(roomId: string, throwOnError = true): Promise<'public' | 'private'> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const response = await client.getRoomDirectoryVisibility(roomId)
      return response.visibility as 'public' | 'private'
    } catch (err) {
      return this.handleError(err, 'getRoomDirectoryVisibility', 'private' as 'public' | 'private', throwOnError)
    }
  }

  async setRoomDirectoryVisibility(
    roomId: string,
    visibility: 'public' | 'private',
    throwOnError = false
  ): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      await client.setRoomDirectoryVisibility(roomId, visibility)
      info(`[MatrixSearch] 设置房间可见性成功: ${roomId} -> ${visibility}`)
    } catch (err) {
      this.handleError(err, 'setRoomDirectoryVisibility', undefined as void, throwOnError)
    }
  }
}

export const matrixSearchService = new MatrixSearchService()
export default matrixSearchService
