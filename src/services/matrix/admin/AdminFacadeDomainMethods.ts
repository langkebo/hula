import { DEFAULT_PAGE_LIMIT, LARGE_PAGE_LIMIT } from '@/common/constants'
import type {
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaProtectionResponse,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  RoomStatsOverview,
  UserMediaList,
  UserMediaQuarantineResponse
} from '@/services/matrix/sdk'
import { AdminFacadeOpsMethods } from './AdminFacadeOpsMethods'
import type { AdminRoomService } from './RoomService'

/**
 * AdminFacadeService 的 Domain 方法片段。
 *
 * 从 AdminFacadeService 抽离：这些方法是对 admin 子服务（media/rooms/security/users）
 * 的薄委托，拆分为抽象基类以把门面文件控制在 800 行红线以内。
 * 子类（AdminFacadeService）提供各子服务字段。
 */
export abstract class AdminFacadeDomainMethods extends AdminFacadeOpsMethods {
  abstract readonly rooms: AdminRoomService

  // ==================== Domain Methods ====================

  async getMediaList(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    orderBy?: string,
    search?: string
  ): Promise<{
    media: Array<{
      mediaId: string
      mediaType: string
      contentUri: string
      createdAt: number
      uploadName?: string | undefined
      mediaLength?: number | undefined
    }>
    nextToken?: string | undefined
  }> {
    return this.media.getMediaList(limit, from, orderBy, search)
  }

  /** 删除指定媒体。 */
  async deleteMedia(mediaId: string): Promise<void> {
    return this.media.deleteMedia(mediaId)
  }

  /** 获取单个媒体的详情，失败时返回 null。 */
  async getMediaInfo(mediaId: string): Promise<MediaInfo | null> {
    return this.media.getMediaInfo(mediaId)
  }

  /** 按服务器获取媒体详情，失败时返回 null。 */
  async getMediaInfoByServer(serverName: string, mediaId: string): Promise<MediaInfo | null> {
    return this.media.getMediaInfoByServer(serverName, mediaId)
  }

  /** 按服务器删除媒体。 */
  async deleteMediaByServer(serverName: string, mediaId: string): Promise<void> {
    return this.media.deleteMediaByServer(serverName, mediaId)
  }

  /** 按时间/体积策略删除媒体，失败时返回 null。 */
  async deleteMediaByPolicy(options: { beforeTs?: number; maxSize?: number }): Promise<{ deleted: number } | null> {
    return this.media.deleteMediaByPolicy(options)
  }

  /** 隔离指定媒体。 */
  async quarantineMedia(serverName: string, mediaId: string): Promise<void> {
    return this.media.quarantineMedia(serverName, mediaId)
  }

  /** 取消隔离指定媒体。 */
  async unquarantineMedia(serverName: string, mediaId: string): Promise<void> {
    return this.media.unquarantineMedia(serverName, mediaId)
  }

  /** 按服务器保护媒体，失败时返回 null。 */
  async protectMedia(serverName: string, mediaId: string): Promise<MediaProtectionResponse | null> {
    return this.media.protectMedia(serverName, mediaId)
  }

  /** 按媒体 ID 保护媒体，失败时返回 null。 */
  async protectMediaById(mediaId: string): Promise<MediaProtectionResponse | null> {
    return this.media.protectMediaById(mediaId)
  }

  /** 取消媒体保护，失败时返回 null。 */
  async unprotectMedia(mediaId: string): Promise<MediaUnprotectionResponse | null> {
    return this.media.unprotectMedia(mediaId)
  }

  /** 获取全局媒体隔离变更，失败时返回 null。 */
  async getGlobalQuarantineChanges(from?: number): Promise<GlobalMediaQuarantineChangesResponse | null> {
    return this.media.getGlobalQuarantineChanges(from)
  }

  /** 获取单个媒体的隔离变更，失败时返回 null。 */
  async getMediaQuarantineChanges(
    mediaId: string,
    options?: { from?: string; limit?: number }
  ): Promise<MediaQuarantineChangesResponse | null> {
    return this.media.getMediaQuarantineChanges(mediaId, options)
  }

  /** 获取房间内的媒体列表，失败时返回 null。 */
  async getRoomMedia(roomId: string, from?: string, limit?: number): Promise<RoomMediaPage | null> {
    return this.media.getRoomMedia(roomId, from, limit)
  }

  /** 删除房间内的指定媒体。 */
  async deleteRoomMedia(roomId: string, mediaId: string): Promise<void> {
    return this.media.deleteRoomMedia(roomId, mediaId)
  }

  /** 隔离房间媒体，失败时返回 null。 */
  async quarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaQuarantineResponse | null> {
    return this.media.quarantineRoomMedia(roomId, userId)
  }

  /** 取消隔离房间媒体，失败时返回 null。 */
  async unquarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaUnquarantineResponse | null> {
    return this.media.unquarantineRoomMedia(roomId, userId)
  }

  /** 获取用户上传的媒体列表，失败时返回 null。 */
  async getUserMedia(userId: string): Promise<UserMediaList | null> {
    return this.media.getUserMedia(userId)
  }

  /** 删除用户上传的媒体，失败时返回 null。 */
  async deleteUserMedia(userId: string): Promise<{ deleted: number } | null> {
    return this.media.deleteUserMedia(userId)
  }

  /** 隔离用户媒体，失败时返回 null。 */
  async quarantineUserMedia(userId: string): Promise<UserMediaQuarantineResponse | null> {
    return this.media.quarantineUserMedia(userId)
  }

  async adminGetSpaces(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{ spaces: Array<Record<string, unknown>>; next_batch?: string | undefined }> {
    return this.rooms.adminGetSpaces(limit, from)
  }

  /** 删除指定空间。 */
  async adminDeleteSpace(spaceId: string): Promise<void> {
    return this.rooms.adminDeleteSpace(spaceId)
  }

  async getAuditLog(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<{ logs: Array<Record<string, unknown>>; next_batch?: string | undefined }> {
    return this.security.getAuditLog(limit, from, userId, eventType)
  }

  /** 获取 SAML 元数据。 */
  async getSamlMetadata(): Promise<Record<string, unknown>> {
    return this.security.getSamlMetadata()
  }

  /** 获取服务提供方（SP）元数据。 */
  async getSpMetadata(): Promise<Blob | string | null> {
    return this.security.getSpMetadata()
  }

  /** 刷新身份提供方（IdP）元数据。 */
  async refreshIdpMetadata(): Promise<Record<string, unknown>> {
    return this.security.refreshIdpMetadata()
  }

  /** 获取 SAML 配置。 */
  async getSamlConfig(): Promise<Record<string, unknown>> {
    return this.security.getSamlConfig()
  }

  /** 更新 SAML 配置。 */
  async updateSamlConfig(config: Record<string, unknown>): Promise<void> {
    return this.security.updateSamlConfig(config)
  }

  /** 获取指定用户加入的房间列表。 */
  async getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>> {
    return this.users.getUserRooms(userId)
  }

  /** 获取指定用户的统计信息。 */
  async getUserStats(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getUserStats(userId)
  }

  /** 获取用户统计列表。 */
  async getUserStatsList(): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string | undefined }> {
    return this.users.getUserStatsList()
  }

  async batchCreateUsers(
    users: Array<{
      username: string
      password: string
      displayname?: string
      admin?: boolean
    }>
  ): Promise<Array<{ userId: string; success: boolean }>> {
    return this.users.batchCreateUsers(users)
  }

  /** 批量停用用户，可选抹除其数据。 */
  async batchDeactivateUsers(userIds: string[], erase = false): Promise<Array<{ userId: string; success: boolean }>> {
    return this.users.batchDeactivateUsers(userIds, erase)
  }

  /** 将用户从服务端强制下线（evict）。 */
  async evictUser(userId: string): Promise<void> {
    return this.users.evictUser(userId)
  }

  /** 以指定用户身份登录，返回访问令牌与设备 ID。 */
  async loginUserAs(userId: string): Promise<{ accessToken: string; deviceId: string } | null> {
    return this.users.loginUserAs(userId)
  }

  /** 注销指定用户的所有会话。 */
  async logoutUserAll(userId: string): Promise<void> {
    return this.users.logoutUserAll(userId)
  }

  /** 获取指定用户的活动会话列表。 */
  async getUserSessions(userId: string): Promise<Array<Record<string, unknown>>> {
    return this.users.getUserSessions(userId)
  }

  /** 使指定用户的会话失效。 */
  async invalidateUserSession(userId: string): Promise<void> {
    return this.users.invalidateUserSession(userId)
  }

  /** 获取指定账户的信息。 */
  async getAccountInfo(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getAccountInfo(userId)
  }

  /** 更新指定账户信息。 */
  async updateAccountInfo(userId: string, updates: Record<string, unknown>): Promise<void> {
    return this.users.updateAccountInfo(userId, updates)
  }

  /** 检查指定用户是否为管理员。 */
  async checkUserAdmin(userId: string): Promise<boolean> {
    return this.users.checkUserAdmin(userId)
  }

  /** 获取指定账户的状态。 */
  async getAccountStatus(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getAccountStatus(userId)
  }

  async getLoginFailures(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{ failures: Array<Record<string, unknown>>; nextToken?: string | undefined }> {
    return this.users.getLoginFailures(limit, from)
  }

  async getRoomMessages(
    roomId: string,
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    dir: 'b' | 'f' = 'b'
  ): Promise<{
    chunk: Array<Record<string, unknown>>
    start?: string
    end?: string
  }> {
    return this.rooms.getRoomMessages(roomId, limit, from, dir)
  }

  /** 获取房间别名列表。 */
  async getRoomAliases(roomId: string): Promise<string[]> {
    return this.rooms.getRoomAliases(roomId)
  }

  /** 获取房间的版本。 */
  async getRoomVersion(roomId: string): Promise<string | null> {
    return this.rooms.getRoomVersion(roomId)
  }

  /** 获取房间的封禁状态。 */
  async getRoomBlockStatus(roomId: string): Promise<boolean> {
    return this.rooms.getRoomBlockStatus(roomId)
  }

  /** 解除房间封禁。 */
  async unblockRoom(roomId: string): Promise<void> {
    return this.rooms.unblockRoom(roomId)
  }

  /** 将指定用户设为房间管理员。 */
  async makeRoomAdmin(roomId: string, userId?: string): Promise<void> {
    return this.rooms.makeRoomAdmin(roomId, userId)
  }

  async purgeHistory(
    roomId: string,
    options?: { purgeUpToTs?: number; dryRun?: boolean }
  ): Promise<{ success: boolean; deletedEvents: number; dryRun: boolean }> {
    return this.rooms.purgeHistory(roomId, options)
  }

  /** 清除（purge）指定房间。 */
  async purgeRoom(roomId: string): Promise<void> {
    return this.rooms.purgeRoom(roomId)
  }

  /** 房间总览统计（总数、活跃数等）。 */
  async getRoomStats(): Promise<RoomStatsOverview> {
    return this.rooms.getRoomStats()
  }

  /** 获取单个房间的统计信息。 */
  async getSingleRoomStats(roomId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getSingleRoomStats(roomId)
  }

  /** 获取房间的公开目录（listing）信息。 */
  async getRoomListings(roomId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getRoomListings(roomId)
  }

  /** 设置房间是否公开列入目录。 */
  async setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void> {
    return this.rooms.setRoomPublicListing(roomId, isPublic)
  }

  /** 获取指定事件的上下文（前后事件）。 */
  async getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getRoomEventContext(roomId, eventId)
  }

  async searchInRoom(
    roomId: string,
    searchTerm: string,
    limit = DEFAULT_PAGE_LIMIT
  ): Promise<{ results: Array<Record<string, unknown>>; nextBatch?: string | undefined }> {
    return this.rooms.searchInRoom(roomId, searchTerm, limit)
  }

  async searchRooms(
    searchTerm: string
  ): Promise<{ rooms: Array<Record<string, unknown>>; nextBatch?: string | undefined }> {
    return this.rooms.searchRooms(searchTerm)
  }

  /** 获取房间的前向极值（forward extremities）。 */
  async getRoomForwardExtremities(roomId: string): Promise<Array<Record<string, unknown>>> {
    return this.rooms.getRoomForwardExtremities(roomId)
  }

  async deleteRoom(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
      block?: boolean
    }
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; newRoomId?: string | undefined }> {
    return this.rooms.deleteRoom(roomId, options)
  }

  /** 获取空间详情。 */
  async getSpaceDetails(spaceId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getSpaceDetails(spaceId)
  }

  /** 获取空间内的用户列表。 */
  async getSpaceUsers(spaceId: string): Promise<Array<Record<string, unknown>>> {
    return this.rooms.getSpaceUsers(spaceId)
  }

  /** 获取空间内的房间列表。 */
  async getSpaceRooms(spaceId: string): Promise<Array<Record<string, unknown>>> {
    return this.rooms.getSpaceRooms(spaceId)
  }

  /** 获取空间的统计信息。 */
  async getSpaceStats(spaceId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getSpaceStats(spaceId)
  }
}
