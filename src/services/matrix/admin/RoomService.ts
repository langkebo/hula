import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { isValidMatrixRoomId } from '@/utils/inputValidation'
import type { RoomInfo, RoomState, ShutdownRoomResult } from './AdminTypes'

type RoomDomainSdkGetter = () => Promise<unknown>
type RoomDomainClientGetter = () => MatrixClient

export class AdminRoomService {
  constructor(
    private readonly sdkAdmin: RoomDomainSdkGetter,
    private readonly getClient: RoomDomainClientGetter
  ) {}

  async getRooms(limit = 100, from?: string, searchTerm?: string): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRooms(
          from?: string,
          limit?: number,
          searchTerm?: string
        ): Promise<{ rooms: RoomInfoSdk[]; next_token?: string }>
      }
      const result = await admin.getRooms(from, limit, searchTerm)
      return {
        rooms: (result.rooms ?? []).map((room) => this.mapRoomInfo(room)),
        nextToken: result.next_token
      }
    } catch (err) {
      error(`[Admin] 获取房间列表失败: ${err}`)
      return { rooms: [] }
    }
  }

  async getRoom(roomId: string): Promise<RoomInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoom(roomId: string, throwOnError?: boolean): Promise<RoomInfoSdk | null>
      }
      const room = await admin.getRoom(roomId, false)
      return room ? this.mapRoomInfo(room, roomId) : null
    } catch (err) {
      error(`[Admin] 获取房间详情失败: ${err}`)
      return null
    }
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomMembers(roomId: string): Promise<string[]>
      }
      return (await admin.getRoomMembers(roomId)) ?? []
    } catch (err) {
      error(`[Admin] 获取房间成员失败: ${err}`)
      return []
    }
  }

  async getRoomState(roomId: string): Promise<RoomState | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomState(roomId: string): Promise<{ state?: Array<Record<string, unknown>> }>
      }
      const result = await admin.getRoomState(roomId)
      return {
        state: ((result?.state ?? []) as Array<Record<string, unknown>>).map((event) => ({
          type: (event.type as string) ?? '',
          stateKey: (event.state_key as string) ?? '',
          content: (event.content as Record<string, unknown>) ?? {}
        }))
      }
    } catch (err) {
      error(`[Admin] 获取房间状态失败: ${err}`)
      return null
    }
  }

  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    if (!isValidMatrixRoomId(roomId)) throw new Error(`Invalid room ID: ${roomId}`)
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void>
      }
      await admin.deleteRoom(roomId, options)
      info(`[Admin] 房间已删除: ${roomId}`)
    } catch (err) {
      error(`[Admin] 删除房间失败: ${err}`)
      throw err
    }
  }

  async blockRoom(roomId: string, block: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        blockRoom(roomId: string, block: boolean): Promise<void>
      }
      await admin.blockRoom(roomId, block)
      info(`[Admin] 房间${block ? '已封禁' : '已解封'}: ${roomId}`)
    } catch (err) {
      error(`[Admin] 封禁房间失败: ${err}`)
      throw err
    }
  }

  async shutdownRoom(roomId: string, _message?: string): Promise<ShutdownRoomResult> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        shutdownRoom(roomId: string): Promise<{
          kicked_users?: string[]
          failed_to_kick_users?: string[]
          local_aliases?: string[]
        }>
      }
      const result = await admin.shutdownRoom(roomId)
      info(`[Admin] 房间已关闭: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        failedToKickUsers: result?.failed_to_kick_users ?? [],
        localAliases: result?.local_aliases ?? []
      }
    } catch (err) {
      error(`[Admin] 关闭房间失败: ${err}`)
      throw err
    }
  }

  async forceJoinRoom(roomId: string, userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        forceJoinRoom(roomId: string, userId: string): Promise<void>
      }
      await admin.forceJoinRoom(roomId, userId)
      info(`[Admin] 强制加入房间: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[Admin] 强制加入房间失败: ${err}`)
      throw err
    }
  }

  async forceLeaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        forceLeaveRoom(roomId: string, userId: string): Promise<void>
      }
      await admin.forceLeaveRoom(roomId, userId)
      info(`[Admin] 强制离开房间: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[Admin] 强制离开房间失败: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.kick(roomId, userId, reason)
      info(`[Admin] 用户已踢出房间: ${userId} ${roomId}`)
    } catch (err) {
      error(`[Admin] 踢出用户失败: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.ban(roomId, userId, reason)
      info(`[Admin] 用户已封禁: ${userId} ${roomId}`)
    } catch (err) {
      error(`[Admin] 封禁用户失败: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.unban(roomId, userId)
      info(`[Admin] 用户已解除封禁: ${userId} ${roomId}`)
    } catch (err) {
      error(`[Admin] 解除封禁失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomMessages(
          roomId: string,
          options: { limit?: number; from?: string; dir?: 'f' | 'b' }
        ): Promise<{ chunk: Array<Record<string, unknown>>; start?: string; end?: string }>
      }
      const result = await admin.getRoomMessages(roomId, { limit, from, dir })
      return {
        chunk: result?.chunk ?? [],
        start: result?.start,
        end: result?.end
      }
    } catch (err) {
      error(`[Admin] 获取房间消息失败: ${err}`)
      return { chunk: [] }
    }
  }

  async getRoomAliases(roomId: string): Promise<string[]> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomAliases(roomId: string): Promise<{ aliases?: string[] }>
      }
      const result = await admin.getRoomAliases(roomId)
      return result?.aliases ?? []
    } catch (err) {
      error(`[Admin] 获取房间别名失败: ${err}`)
      return []
    }
  }

  async getRoomVersion(roomId: string): Promise<string | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomVersion(roomId: string, throwOnError?: boolean): Promise<{ room_version?: string } | null>
      }
      const result = await admin.getRoomVersion(roomId, false)
      return result?.room_version ?? null
    } catch (err) {
      error(`[Admin] 获取房间版本失败: ${err}`)
      return null
    }
  }

  async getRoomBlockStatus(roomId: string): Promise<boolean> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomBlockStatus(roomId: string): Promise<{ block?: boolean }>
      }
      const result = await admin.getRoomBlockStatus(roomId)
      return result?.block ?? false
    } catch (err) {
      error(`[Admin] 获取房间封禁状态失败: ${err}`)
      return false
    }
  }

  async unblockRoom(roomId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        unblockRoom(roomId: string): Promise<void>
      }
      await admin.unblockRoom(roomId)
      info(`[Admin] 房间已解封: ${roomId}`)
    } catch (err) {
      error(`[Admin] 解封房间失败: ${err}`)
      throw err
    }
  }

  async makeRoomAdmin(roomId: string, userId?: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        makeRoomAdmin(roomId: string, userId?: string): Promise<void>
      }
      await admin.makeRoomAdmin(roomId, userId)
      info(`[Admin] 设置房间管理员: ${roomId}`)
    } catch (err) {
      error(`[Admin] 设置房间管理员失败: ${err}`)
      throw err
    }
  }

  async purgeHistory(
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ): Promise<{ purgeId: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        purgeHistoryGlobal(
          roomId: string,
          options?: {
            purge_up_to_event_id?: string
            purge_up_to_ts?: number
            delete_local_events?: boolean
          }
        ): Promise<{ purge_id?: string }>
      }
      const sdkOptions: {
        purge_up_to_event_id?: string
        purge_up_to_ts?: number
        delete_local_events?: boolean
      } = {}
      if (options?.purgeUpToEventId !== undefined) sdkOptions.purge_up_to_event_id = options.purgeUpToEventId
      if (options?.purgeUpToTs !== undefined) sdkOptions.purge_up_to_ts = options.purgeUpToTs
      if (options?.deleteLocalEvents !== undefined) sdkOptions.delete_local_events = options.deleteLocalEvents
      const result = await admin.purgeHistoryGlobal(roomId, sdkOptions)
      info(`[Admin] 清理历史: ${roomId}`)
      return { purgeId: result?.purge_id ?? '' }
    } catch (err) {
      error(`[Admin] 清理历史失败: ${err}`)
      throw err
    }
  }

  async purgeRoom(roomId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        purgeRoom(roomId: string): Promise<unknown>
      }
      await admin.purgeRoom(roomId)
      info(`[Admin] 清空房间: ${roomId}`)
    } catch (err) {
      error(`[Admin] 清空房间失败: ${err}`)
      throw err
    }
  }

  async getRoomStats(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listRoomStats(params: { limit?: number; from?: string }): Promise<{
          room_stats?: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listRoomStats({ limit, from })
      return {
        stats: result?.room_stats ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取房间统计失败: ${err}`)
      return { stats: [] }
    }
  }

  async getSingleRoomStats(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomStats(roomId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getRoomStats(roomId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取单房间统计失败: ${err}`)
      return null
    }
  }

  async getRoomListings(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomListings(roomId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getRoomListings(roomId)) ?? null
    } catch (err) {
      error(`[Admin] 获取房间公开列表项失败: ${err}`)
      return null
    }
  }

  async setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void>
      }
      await admin.setRoomPublicListing(roomId, isPublic)
      info(`[Admin] 房间公开列表已${isPublic ? '设置' : '移除'}: ${roomId}`)
    } catch (err) {
      error(`[Admin] 设置房间公开列表失败: ${err}`)
      throw err
    }
  }

  async getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getRoomEventContext(roomId, eventId)) ?? null
    } catch (err) {
      error(`[Admin] 获取事件上下文失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        searchInRoom(
          roomId: string,
          searchTerm: string,
          limit?: number
        ): Promise<{ results?: Array<Record<string, unknown>>; next_batch?: string }>
      }
      const result = await admin.searchInRoom(roomId, searchTerm, limit)
      return {
        results: result?.results ?? [],
        nextBatch: result?.next_batch
      }
    } catch (err) {
      error(`[Admin] 房间内搜索失败: ${err}`)
      return { results: [] }
    }
  }

  async searchRooms(
    searchTerm: string,
    limit = 50
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        searchRooms(
          searchTerm: string,
          limit?: number
        ): Promise<{ rooms?: Array<Record<string, unknown>>; next_batch?: string }>
      }
      const result = await admin.searchRooms(searchTerm, limit)
      return {
        rooms: result?.rooms ?? [],
        nextBatch: result?.next_batch
      }
    } catch (err) {
      error(`[Admin] 全局房间搜索失败: ${err}`)
      return { rooms: [] }
    }
  }

  async getRoomForwardExtremities(roomId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomForwardExtremities(roomId: string): Promise<{
          results?: Array<Record<string, unknown>>
          forward_extremities?: Array<Record<string, unknown>> | number
        }>
      }
      const result = await admin.getRoomForwardExtremities(roomId)
      if (Array.isArray(result?.results)) return result.results
      if (Array.isArray(result?.forward_extremities)) return result.forward_extremities
      return []
    } catch (err) {
      error(`[Admin] 获取房间前向极值失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        listSpaces(params: { limit?: number; from?: string }): Promise<{
          spaces?: Array<Record<string, unknown>>
          next_batch?: string
        }>
      }
      const result = await admin.listSpaces({ limit, from })
      return {
        spaces: result?.spaces ?? [],
        next_batch: result?.next_batch
      }
    } catch (err) {
      error(`[Admin] 获取空间列表失败: ${err}`)
      return { spaces: [] }
    }
  }

  async adminDeleteSpace(spaceId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteSpace(spaceId: string): Promise<unknown>
      }
      await admin.deleteSpace(spaceId)
      info(`[Admin] 删除空间成功: ${spaceId}`)
    } catch (err) {
      error(`[Admin] 删除空间失败: ${err}`)
      throw err
    }
  }

  async getSpaceDetails(spaceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSpace(spaceId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getSpace(spaceId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取空间详情失败: ${err}`)
      return null
    }
  }

  async getSpaceUsers(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSpaceUsers(spaceId: string): Promise<{ users?: Array<Record<string, unknown>> }>
      }
      const result = await admin.listSpaceUsers(spaceId)
      return result?.users ?? []
    } catch (err) {
      error(`[Admin] 获取空间用户失败: ${err}`)
      return []
    }
  }

  async getSpaceRooms(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSpaceRooms(spaceId: string): Promise<{ rooms?: Array<Record<string, unknown>> }>
      }
      const result = await admin.listSpaceRooms(spaceId)
      return result?.rooms ?? []
    } catch (err) {
      error(`[Admin] 获取空间房间失败: ${err}`)
      return []
    }
  }

  async getSpaceStats(spaceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSpaceStats(spaceId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getSpaceStats(spaceId)) ?? null
    } catch (err) {
      error(`[Admin] 获取空间统计失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRoomV2(
          roomId: string,
          options?: {
            purge?: boolean
            force?: boolean
            new_room_user_id?: string
            room_name?: string
            message?: string
            block?: boolean
          }
        ): Promise<{
          kicked_users?: string[]
          failed_to_kick_users?: string[]
          local_aliases?: string[]
          new_room_id?: string
        }>
      }
      const sdkOptions: {
        purge?: boolean
        force?: boolean
        new_room_user_id?: string
        room_name?: string
        message?: string
        block?: boolean
      } = {}
      if (options?.purge !== undefined) sdkOptions.purge = options.purge
      if (options?.force !== undefined) sdkOptions.force = options.force
      if (options?.newRoomUserId !== undefined) sdkOptions.new_room_user_id = options.newRoomUserId
      if (options?.roomName !== undefined) sdkOptions.room_name = options.roomName
      if (options?.message !== undefined) sdkOptions.message = options.message
      if (options?.block !== undefined) sdkOptions.block = options.block
      const result = await admin.deleteRoomV2(roomId, sdkOptions)
      info(`[Admin] v2删除房间: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        failedToKickUsers: result?.failed_to_kick_users ?? [],
        localAliases: result?.local_aliases ?? [],
        newRoomId: result?.new_room_id
      }
    } catch (err) {
      error(`[Admin] v2删除房间失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRoomV2(
          roomId: string,
          options?: Record<string, unknown>
        ): Promise<{ kicked_users?: string[]; new_room_id?: string }>
      }
      const body: Record<string, unknown> = {}
      if (options?.purge) body.purge = options.purge
      if (options?.force) body.force_purge = options.force
      if (options?.newRoomUserId) body.new_room_user_id = options.newRoomUserId
      if (options?.roomName) body.room_name = options.roomName
      if (options?.message) body.message = options.message
      const result = await admin.deleteRoomV2(roomId, body)
      info(`[Admin] 兼容删除房间: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        newRoomId: result?.new_room_id
      }
    } catch (err) {
      error(`[Admin] 兼容删除房间失败: ${err}`)
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
