import type { MatrixClient } from 'matrix-js-sdk'
import { isValidMatrixRoomId } from '@/utils/inputValidation'
import { createLogger } from '@/utils/Logger'
import type { RoomInfo, RoomState, ShutdownRoomResult } from './AdminTypes'

const logger = createLogger('RoomService')

type RoomDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>
type RoomDomainClientGetter = () => MatrixClient

export class AdminRoomService {
  constructor(
    private readonly sdkAdmin: RoomDomainSdkGetter,
    private readonly getClient: RoomDomainClientGetter
  ) {}

  async getRooms(limit = 100, from?: string, searchTerm?: string): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomsPaginated({ from, limit, search: searchTerm })
      return {
        rooms: (result.items ?? []).map((room) => this.mapRoomInfo(room)),
        nextToken: result.nextToken
      }
    } catch (err) {
      logger.error(`[Admin] 获取房间列表失败: ${err}`)
      return { rooms: [] }
    }
  }

  async getRoom(roomId: string): Promise<RoomInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const room = await admin.getRoom(roomId, false)
      return room ? this.mapRoomInfo(room, roomId) : null
    } catch (err) {
      logger.error(`[Admin] 获取房间详情失败: ${err}`)
      return null
    }
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    try {
      const admin = await this.sdkAdmin()
      const members = await admin.getRoomMembers(roomId)
      return (members ?? []).map((m) => m.user_id)
    } catch (err) {
      logger.error(`[Admin] 获取房间成员失败: ${err}`)
      return []
    }
  }

  async getRoomState(roomId: string): Promise<RoomState | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomState(roomId)
      return {
        state: (result?.state ?? []).map((event) => ({
          type: event.type ?? '',
          stateKey: event.state_key ?? '',
          content: (event.content as Record<string, unknown>) ?? {}
        }))
      }
    } catch (err) {
      logger.error(`[Admin] 获取房间状态失败: ${err}`)
      return null
    }
  }

  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    if (!isValidMatrixRoomId(roomId)) throw new Error(`Invalid room ID: ${roomId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRoom(roomId, options ?? false)
      logger.info(`[Admin] 房间已删除: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 删除房间失败: ${err}`)
      throw err
    }
  }

  async blockRoom(roomId: string, block: boolean): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.blockRoom(roomId, block)
      logger.info(`[Admin] 房间${block ? '已封禁' : '已解封'}: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 封禁房间失败: ${err}`)
      throw err
    }
  }

  async shutdownRoom(roomId: string, _message?: string): Promise<ShutdownRoomResult> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.shutdownRoom({ room_id: roomId })
      logger.info(`[Admin] 房间已关闭: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        failedToKickUsers: result?.failed_to_kick_users ?? [],
        localAliases: result?.local_aliases ?? []
      }
    } catch (err) {
      logger.error(`[Admin] 关闭房间失败: ${err}`)
      throw err
    }
  }

  async forceJoinRoom(roomId: string, userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.joinRoom(roomId, userId)
      logger.info(`[Admin] 强制加入房间: ${userId} -> ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 强制加入房间失败: ${err}`)
      throw err
    }
  }

  async forceLeaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.removeRoomMember(roomId, userId)
      logger.info(`[Admin] 强制离开房间: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 强制离开房间失败: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.kick(roomId, userId, reason)
      logger.info(`[Admin] 用户已踢出房间: ${userId} ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 踢出用户失败: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.ban(roomId, userId, reason)
      logger.info(`[Admin] 用户已封禁: ${userId} ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 封禁用户失败: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.unban(roomId, userId)
      logger.info(`[Admin] 用户已解除封禁: ${userId} ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 解除封禁失败: ${err}`)
      throw err
    }
  }

  async getRoomMessages(
    roomId: string,
    limit = 100,
    from?: string,
    dir: 'b' | 'f' = 'b'
  ): Promise<{
    chunk: Array<Record<string, unknown>>
    start?: string
    end?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomMessages(roomId, { limit, from, dir })
      return {
        chunk: result.chunk.map((msg) => ({
          ...msg,
          content: msg.content as Record<string, unknown>
        })),
        start: result.start,
        end: result.end
      }
    } catch (err) {
      logger.error(`[Admin] 获取房间消息失败: ${err}`)
      return { chunk: [] }
    }
  }

  async getRoomAliases(roomId: string): Promise<string[]> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomAliases(roomId)
      return result?.aliases ?? []
    } catch (err) {
      logger.error(`[Admin] 获取房间别名失败: ${err}`)
      return []
    }
  }

  async getRoomVersion(roomId: string): Promise<string | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomVersion(roomId)
      return result?.room_version ?? null
    } catch (err) {
      logger.error(`[Admin] 获取房间版本失败: ${err}`)
      return null
    }
  }

  async getRoomBlockStatus(roomId: string): Promise<boolean> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomBlockStatus(roomId)
      return result?.block ?? false
    } catch (err) {
      logger.error(`[Admin] 获取房间封禁状态失败: ${err}`)
      return false
    }
  }

  async unblockRoom(roomId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.unblockRoom(roomId)
      logger.info(`[Admin] 房间已解封: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 解封房间失败: ${err}`)
      throw err
    }
  }

  async makeRoomAdmin(roomId: string, userId?: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.makeRoomAdmin(roomId, { user_id: userId })
      logger.info(`[Admin] 设置房间管理员: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 设置房间管理员失败: ${err}`)
      throw err
    }
  }

  async purgeHistory(
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ): Promise<{ purgeId: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.purgeRoomHistory(roomId, {
        purge_up_to_event_id: options?.purgeUpToEventId,
        purge_up_to_ts: options?.purgeUpToTs,
        delete_local_events: options?.deleteLocalEvents
      })
      logger.info(`[Admin] 清理历史: ${roomId}`)
      return { purgeId: result?.purge_id ?? '' }
    } catch (err) {
      logger.error(`[Admin] 清理历史失败: ${err}`)
      throw err
    }
  }

  async purgeRoom(roomId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.purgeRoom({ room_id: roomId })
      logger.info(`[Admin] 清空房间: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 清空房间失败: ${err}`)
      throw err
    }
  }

  async getRoomStats(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomStats(from, limit)
      return {
        stats: result.map((stat) => ({
          ...stat,
          room_id: stat.room_id,
          name: stat.name,
          member_count: stat.member_count,
          local_users: stat.local_users,
        })),
        nextToken: undefined
      }
    } catch (err) {
      logger.error(`[Admin] 获取房间统计失败: ${err}`)
      return { stats: [] }
    }
  }

  async getSingleRoomStats(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomStatsByRoom(roomId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[Admin] 获取单房间统计失败: ${err}`)
      return null
    }
  }

  async getRoomListings(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomListings(roomId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[Admin] 获取房间公开列表项失败: ${err}`)
      return null
    }
  }

  async setRoomPublicListing(roomId: string, _isPublic: boolean): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.setRoomPublicListing(roomId)
      logger.info(`[Admin] 房间公开列表已设置: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 设置房间公开列表失败: ${err}`)
      throw err
    }
  }

  async getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomEventContext(roomId, eventId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[Admin] 获取事件上下文失败: ${err}`)
      return null
    }
  }

  async searchInRoom(
    roomId: string,
    searchTerm: string,
    limit = 50
  ): Promise<{
    results: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.searchRoomEvents(roomId, { search_term: searchTerm, limit })
      return {
        results: result.results.map((e) => ({
          ...e,
          event_id: e.event_id,
          sender: e.sender,
          content: e.content as Record<string, unknown>,
        })),
        nextBatch: result.next_batch
      }
    } catch (err) {
      logger.error(`[Admin] 房间内搜索失败: ${err}`)
      return { results: [] }
    }
  }

  async searchRooms(
    searchTerm: string,
    _limit = 50
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.searchRooms({ search_term: searchTerm })
      return {
        rooms: result.results.map((e) => ({
          room_id: e.room_id,
          name: e.name,
          canonical_alias: e.canonical_alias,
          joined_members: e.joined_members,
        })),
        nextBatch: result.next_batch
      }
    } catch (err) {
      logger.error(`[Admin] 全局房间搜索失败: ${err}`)
      return { rooms: [] }
    }
  }

  async getRoomForwardExtremities(roomId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomForwardExtremities(roomId)
      if (Array.isArray(result)) return result.map((e) => ({
        event_id: e.event_id,
        type: e.type,
        sender: e.sender,
      }))
      return []
    } catch (err) {
      logger.error(`[Admin] 获取房间前向极值失败: ${err}`)
      return []
    }
  }

  async adminGetSpaces(
    limit: number = 50,
    from?: string
  ): Promise<{
    spaces: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listSpaces(from, limit)
      return {
        // biome-ignore lint/suspicious/noExplicitAny: SDK 返回类型与本地接口不完全匹配
        spaces: (result?.spaces ?? []).map((s) => s as unknown as Record<string, unknown>),
        next_batch: result?.next_batch
      }
    } catch (err) {
      logger.error(`[Admin] 获取空间列表失败: ${err}`)
      return { spaces: [] }
    }
  }

  async adminDeleteSpace(spaceId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteSpace(spaceId)
      logger.info(`[Admin] 删除空间成功: ${spaceId}`)
    } catch (err) {
      logger.error(`[Admin] 删除空间失败: ${err}`)
      throw err
    }
  }

  async getSpaceDetails(spaceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpace(spaceId)
      // biome-ignore lint/suspicious/noExplicitAny: SDK 返回类型与本地接口不完全匹配
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[Admin] 获取空间详情失败: ${err}`)
      return null
    }
  }

  async getSpaceUsers(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpaceUsers(spaceId)
      return (result?.users ?? []) as unknown as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[Admin] 获取空间用户失败: ${err}`)
      return []
    }
  }

  async getSpaceRooms(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpaceRooms(spaceId)
      return (result?.rooms ?? []) as unknown as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[Admin] 获取空间房间失败: ${err}`)
      return []
    }
  }

  async getSpaceStats(spaceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpaceStats(spaceId)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[Admin] 获取空间统计失败: ${err}`)
      return null
    }
  }

  async deleteRoomV2(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
      block?: boolean
    }
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.deleteRoomAdmin(roomId, {
        purge: options?.purge,
        force_purge: options?.force,
        new_room_user_id: options?.newRoomUserId,
        room_name: options?.roomName,
        message: options?.message,
        block: options?.block
      })
      logger.info(`[Admin] v2删除房间: ${roomId}`)
      return {
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        kickedUsers: (result as any)?.kicked_users ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        failedToKickUsers: (result as any)?.failed_to_kick_users ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        localAliases: (result as any)?.local_aliases ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        newRoomId: (result as any)?.new_room_id
      }
    } catch (err) {
      logger.error(`[Admin] v2删除房间失败: ${err}`)
      throw err
    }
  }

  async deleteRoomCompat(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
    }
  ): Promise<{ kickedUsers: string[]; newRoomId?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.deleteRoomAdmin(roomId, {
        purge: options?.purge,
        force_purge: options?.force,
        new_room_user_id: options?.newRoomUserId,
        room_name: options?.roomName,
        message: options?.message
      })
      logger.info(`[Admin] 兼容删除房间: ${roomId}`)
      return {
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        kickedUsers: (result as any)?.kicked_users ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        newRoomId: (result as any)?.new_room_id
      }
    } catch (err) {
      logger.error(`[Admin] 兼容删除房间失败: ${err}`)
      throw err
    }
  }

  private mapRoomInfo(room: RoomInfoSdk, fallbackRoomId = ''): RoomInfo {
    return {
      roomId: room.room_id || fallbackRoomId,
      name: room.name,
      topic: room.topic,
      joinedMembers: room.joined_members ?? 0,
      joinedLocalMembers: room.joined_local_members ?? 0,
      invitedMembers: room.invited_members ?? 0,
      invitedLocalMembers: 0,
      createTime: room.created_ts,
      creator: room.creator,
      public: room.public
    }
  }
}

type RoomInfoSdk = {
  room_id: string
  name?: string
  topic?: string
  joined_members?: number
  joined_local_members?: number
  invited_members?: number
  created_ts?: number
  creator?: string
  public?: boolean
}
