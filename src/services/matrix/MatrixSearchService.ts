import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface SearchResult {
  roomId: string
  eventId: string
  sender: string
  content: any
  timestamp: number
  roomName?: string
  context?: {
    eventsBefore: any[]
    eventsAfter: any[]
  }
}

export interface RoomSearchResult {
  roomId: string
  roomName: string
  avatarUrl?: string
  memberCount: number
  isJoined: boolean
}

class MatrixSearchService {
  async searchMessages(
    query: string,
    options?: {
      roomId?: string
      limit?: number
      beforeLimit?: number
      afterLimit?: number
    }
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
      const results = this.parseSearchResults(response as any)
      
      info(`[MatrixSearch] 搜索完成: "${query}" 找到 ${results.length} 条结果`)
      return results
    } catch (err) {
      error(`[MatrixSearch] 搜索失败: ${err}`)
      throw err
    }
  }

  private parseSearchResults(response: any): SearchResult[] {
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
        context: context ? {
          eventsBefore: context.events_before || [],
          eventsAfter: context.events_after || []
        } : undefined
      })
    }

    return results
  }

  async searchInRoom(roomId: string, query: string, limit: number = 20): Promise<SearchResult[]> {
    return this.searchMessages(query, {
      roomId,
      limit,
      beforeLimit: 5,
      afterLimit: 5
    })
  }

  async searchUsers(query: string, limit: number = 10): Promise<any[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const response = await client.searchUserDirectory({
        term: query,
        limit
      })

      info(`[MatrixSearch] 用户搜索完成: "${query}" 找到 ${response.results?.length || 0} 个用户`)
      return response.results || []
    } catch (err) {
      error(`[MatrixSearch] 用户搜索失败: ${err}`)
      throw err
    }
  }

  async searchRooms(query: string): Promise<RoomSearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    const myUserId = client.getUserId()
    const lowerQuery = query.toLowerCase()

    return rooms
      .filter(room => {
        const roomName = room.name?.toLowerCase() || ''
        const roomId = room.roomId.toLowerCase()
        return roomName.includes(lowerQuery) || roomId.includes(lowerQuery)
      })
      .map(room => {
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
    since?: string
  ): Promise<{
    rooms: RoomSearchResult[]
    nextBatch?: string
    prevBatch?: string
    totalRooms: number
  }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const response = await client.publicRooms({
        server,
        limit,
        since
      })

      const rooms: RoomSearchResult[] = (response.chunk || []).map((room: any) => ({
        roomId: room.room_id,
        roomName: room.name || room.room_id,
        avatarUrl: room.avatar_url,
        memberCount: room.num_joined_members,
        isJoined: false
      }))

      info(`[MatrixSearch] 获取公开房间成功: ${rooms.length} 个房间`)

      return {
        rooms,
        nextBatch: response.next_batch,
        prevBatch: response.prev_batch,
        totalRooms: response.total_room_count_estimate || 0
      }
    } catch (err) {
      error(`[MatrixSearch] 获取公开房间失败: ${err}`)
      throw err
    }
  }

  async searchPublicRooms(query: string, server?: string): Promise<RoomSearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
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
        memberCount: room.num_joined_members,
        isJoined: false
      }))

      info(`[MatrixSearch] 搜索公开房间成功: "${query}" 找到 ${rooms.length} 个房间`)
      return rooms
    } catch (err) {
      error(`[MatrixSearch] 搜索公开房间失败: ${err}`)
      throw err
    }
  }

  async getRoomDirectoryVisibility(roomId: string): Promise<'public' | 'private'> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      const response = await client.getRoomDirectoryVisibility(roomId)
      return response.visibility as 'public' | 'private'
    } catch (err) {
      error(`[MatrixSearch] 获取房间可见性失败: ${err}`)
      throw err
    }
  }

  async setRoomDirectoryVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSearch] 客户端未初始化')
    }

    try {
      await client.setRoomDirectoryVisibility(roomId, visibility as any)
      info(`[MatrixSearch] 设置房间可见性成功: ${roomId} -> ${visibility}`)
    } catch (err) {
      error(`[MatrixSearch] 设置房间可见性失败: ${err}`)
      throw err
    }
  }
}

export const matrixSearchService = new MatrixSearchService()
export default matrixSearchService
