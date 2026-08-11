import type { MatrixClient } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import type { SearchEventContext } from '@/types/matrix-api'
import { createLogger } from '@/utils/Logger'
import type { SearchMessageHit } from '@/workers/matrixWorkerTypes'
import matrixClientService from './MatrixClientService'
import matrixWorkerHost from './MatrixWorkerHost'

const logger = createLogger('MatrixSearchService')

export interface UserSearchResult {
  userId: string
  displayName?: string
  avatarUrl?: string
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
  isDirect: boolean
}

interface MatrixSearchEventResult {
  result: {
    room_id: string
    event_id: string
    sender: string
    content: Record<string, unknown>
    origin_server_ts: number
  }
  context?: {
    profile_info?: Record<string, { displayname?: string }>
    events_before?: unknown[]
    events_after?: unknown[]
  }
}

interface MatrixSearchResponse {
  search_categories?: {
    room_events?: {
      results?: MatrixSearchEventResult[]
      count?: number
      highlights?: string[]
    }
  }
}

type SearchSource = 'remote' | 'local' | 'hybrid'

interface SearchMessagesOptions {
  roomId?: string
  limit?: number
  beforeLimit?: number
  afterLimit?: number
  source?: SearchSource
}

/**
 * SearchManager 实例类型。
 *
 * 注：`matrix-js-sdk/search` 子路径在 package.json exports 中未导出，
 * 但 MatrixClient.getSearchManager() 已在 matrix-client-extensions.d.ts 中声明，
 * 这里通过 MatrixClient 访问器返回类型派生，保持与其他 Manager 一致的类型模式。
 */
type SearchManagerInstance = ReturnType<NonNullable<MatrixClient['getSearchManager']>>

class MatrixSearchService {
  private getSearchMgr(): SearchManagerInstance {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }
    const fn = (client as unknown as { getSearchManager?: () => SearchManagerInstance }).getSearchManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getSearchManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  private async searchMessagesRemote(query: string, options?: SearchMessagesOptions): Promise<SearchResult[]> {
    const response = await this.getSearchMgr().searchMessageText({
      term: query,
      room_id: options?.roomId,
      limit: options?.limit || 20,
      before_limit: options?.beforeLimit || 3,
      after_limit: options?.afterLimit || 3,
      order_by_recency: true,
      include_state: true
    })
    return this.parseSearchResults(response as unknown as MatrixSearchResponse)
  }

  private mapWorkerMessageResults(results: SearchMessageHit[]): SearchResult[] {
    const client = matrixClientService.getClient()

    return results.map((result) => ({
      roomId: result.roomId,
      eventId: result.eventId,
      sender: result.sender,
      content: {
        body: result.preview,
        msgtype: 'm.text'
      },
      timestamp: result.timestamp,
      roomName: client?.getRoom(result.roomId)?.name || result.roomId
    }))
  }

  private async searchMessagesLocal(query: string, options?: SearchMessagesOptions): Promise<SearchResult[]> {
    if (!matrixWorkerHost.isStarted) {
      return []
    }

    const response = await matrixWorkerHost.querySearchIndex({
      term: query,
      scope: 'messages',
      roomId: options?.roomId,
      limit: options?.limit || 20,
      offset: 0
    })

    return this.mapWorkerMessageResults(response.messages || [])
  }

  private toUserSearchResults(
    results: Array<{ user_id: string; display_name?: string; avatar_url?: string }>
  ): UserSearchResult[] {
    return results.map((user) => ({
      userId: user.user_id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    }))
  }

  private toRoomSearchResults(
    rooms: Array<{ room_id: string; name?: string; avatar_url?: string; joined_members: number }>
  ): RoomSearchResult[] {
    return rooms.map((room) => ({
      roomId: room.room_id,
      roomName: room.name || room.room_id,
      avatarUrl: room.avatar_url,
      memberCount: room.joined_members,
      isJoined: false,
      // 公共房间搜索无 DM 信息，默认非单聊
      isDirect: false
    }))
  }

  async searchMessages(query: string, options?: SearchMessagesOptions): Promise<SearchResult[]> {
    const source = options?.source || 'remote'

    try {
      if (source === 'local') {
        const localResults = await this.searchMessagesLocal(query, options)
        logger.info(`[MatrixSearch] 本地搜索完成: "${query}" 找到 ${localResults.length} 条结果`)
        return localResults
      }

      if (source === 'hybrid') {
        const localResults = await this.searchMessagesLocal(query, options)
        const limit = options?.limit || 20
        if (localResults.length >= limit) {
          logger.info(`[MatrixSearch] 混合搜索命中本地索引: "${query}" 找到 ${localResults.length} 条结果`)
          return localResults
        }

        const remoteResults = await this.searchMessagesRemote(query, options)
        logger.info(`[MatrixSearch] 混合搜索回退远程: "${query}" 找到 ${remoteResults.length} 条结果`)
        return remoteResults
      }

      const results = await this.searchMessagesRemote(query, options)

      logger.info(`[MatrixSearch] 远程搜索完成: "${query}" 找到 ${results.length} 条结果`)
      return results
    } catch (err) {
      logger.error(`[MatrixSearch] 搜索失败: ${err}`)
      throw err
    }
  }

  private parseSearchResults(response: MatrixSearchResponse): SearchResult[] {
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
              eventsBefore: (context.events_before || []) as SearchEventContext['eventsBefore'],
              eventsAfter: (context.events_after || []) as SearchEventContext['eventsAfter']
            }
          : undefined
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

  /**
   * 在指定房间内搜索历史消息，返回结果、总数与高亮关键词。
   * 用于房间内 F2 搜索面板：结果供跳转到对应消息位置。
   */
  async searchRoomMessages(
    roomId: string,
    query: string
  ): Promise<{ results: SearchResult[]; count: number; highlights: string[] }> {
    if (!query.trim()) {
      return { results: [], count: 0, highlights: [] }
    }

    // 客户端初始化校验由 getSearchMgr() 完成
    // 调用 getSearchMgr() 仅用于在 query.trim() 通过后提前抛错
    if (!matrixClientService.getClient()) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await this.getSearchMgr().searchMessageText({
        term: query,
        room_id: roomId,
        limit: 20,
        order_by_recency: true
      })

      const typed = response as unknown as MatrixSearchResponse
      const results = this.parseSearchResults(typed)
      const roomEvents = typed.search_categories?.room_events

      logger.info(`[MatrixSearch] 房间内搜索完成: room=${roomId} query="${query}" 找到 ${results.length} 条`)

      return {
        results,
        count: roomEvents?.count ?? results.length,
        highlights: roomEvents?.highlights ?? []
      }
    } catch (err) {
      logger.error(`[MatrixSearch] 房间内搜索失败: ${err}`)
      throw err
    }
  }

  async searchUsers(query: string, limit: number = 10): Promise<UserSearchResult[]> {
    if (!matrixClientService.getClient()) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await this.getSearchMgr().searchUserDirectory({
        term: query,
        limit
      })

      const results = this.toUserSearchResults(response.results || [])

      logger.info(`[MatrixSearch] 用户搜索完成: "${query}" 找到 ${results.length} 个用户`)
      return results
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (
        errMsg.includes('M_UNAUTHORIZED') ||
        errMsg.includes('401') ||
        errMsg.includes('M_FORBIDDEN') ||
        errMsg.includes('403')
      ) {
        logger.info(`[MatrixSearch] 用户搜索需要认证 (${errMsg.includes('403') ? '403' : '401'})`)
        return []
      }
      logger.error(`[MatrixSearch] 用户搜索失败: ${err}`)
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
      .filter((room) => {
        const roomName = room.name?.toLowerCase() || ''
        const roomId = room.roomId.toLowerCase()
        return roomName.includes(lowerQuery) || roomId.includes(lowerQuery)
      })
      .map((room) => {
        const member = room.getMember(myUserId || '')
        const isSpaceRoom = typeof room.isSpaceRoom === 'function' ? (room.isSpaceRoom() as boolean) : false
        const dmInviter =
          typeof (room as unknown as Record<string, unknown>).getDMInviter === 'function'
            ? ((room as unknown as { getDMInviter: () => string | undefined }).getDMInviter() as string | undefined)
            : undefined
        return {
          roomId: room.roomId,
          roomName: room.name || room.roomId,
          avatarUrl: room.getMxcAvatarUrl() || undefined,
          memberCount: room.getJoinedMemberCount(),
          isJoined: member?.membership === 'join',
          // 与 MatrixRoomStoreAdapter 一致的 DM 判定：优先用 dmInviter，回退到成员数
          isDirect: isSpaceRoom ? false : dmInviter !== undefined || room.getJoinedMembers().length <= 2
        }
      })
      .sort((a, b) => a.roomName.localeCompare(b.roomName))
  }

  /**
   * 获取公开房间目录。SearchManager 无等价方法，保留 client.publicRooms。
   */
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
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await client.publicRooms({
        server,
        limit,
        since
      })

      const rooms = this.toRoomSearchResults(response.chunk || [])

      logger.info(`[MatrixSearch] 获取公开房间成功: ${rooms.length} 个房间`)

      return {
        rooms,
        nextBatch: response.next_batch,
        prevBatch: response.prev_batch,
        totalRooms: response.total_room_count_estimate || 0
      }
    } catch (err) {
      logger.error(`[MatrixSearch] 获取公开房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 搜索公开房间目录。SearchManager 无等价方法，保留 client.publicRooms。
   */
  async searchPublicRooms(query: string, server?: string): Promise<RoomSearchResult[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await client.publicRooms({
        server,
        filter: {
          generic_search_term: query
        }
      })

      const rooms = this.toRoomSearchResults(response.chunk || [])

      logger.info(`[MatrixSearch] 搜索公开房间成功: "${query}" 找到 ${rooms.length} 个房间`)
      return rooms
    } catch (err) {
      logger.error(`[MatrixSearch] 搜索公开房间失败: ${err}`)
      throw err
    }
  }

  async getRoomDirectoryVisibility(roomId: string): Promise<'public' | 'private'> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await client.getRoomDirectoryVisibility(roomId)
      return response.visibility as 'public' | 'private'
    } catch (err) {
      logger.error(`[MatrixSearch] 获取房间可见性失败: ${err}`)
      throw err
    }
  }

  async setRoomDirectoryVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.setRoomDirectoryVisibility(roomId, visibility)
      logger.info(`[MatrixSearch] 设置房间可见性成功: ${roomId} -> ${visibility}`)
    } catch (err) {
      logger.error(`[MatrixSearch] 设置房间可见性失败: ${err}`)
      throw err
    }
  }
}

export const matrixSearchService = new MatrixSearchService()
