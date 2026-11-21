import { DEFAULT_PAGE_LIMIT, LARGE_PAGE_LIMIT } from '@/common/constants'
import type { RoomStatsOverview, SamlMetadata } from '@/services/matrix/sdk'
import { AdminFacadeMediaMethods } from './AdminFacadeMediaMethods'
import type {
  AdminAccountInfo,
  AdminAccountInfoUpdate,
  AdminAccountStatusInfo,
  AdminAuditLogPage,
  AdminLoginFailure,
  AdminRoomEventContextInfo,
  AdminRoomEventItem,
  AdminRoomForwardExtremitiesInfo,
  AdminRoomListingsInfo,
  AdminRoomMessageChunkItem,
  AdminRoomSearchResultItem,
  AdminRoomStatsInfo,
  AdminRoomTokenSync,
  AdminSpaceInfo,
  AdminSpaceRoom,
  AdminSpaceStatsInfo,
  AdminSpaceUser,
  AdminUserSession,
  AdminUserStats,
  AdminUserStatsOverview,
  UserInfo
} from './AdminTypes'
import type { AdminRoomService } from './RoomService'
import type { SamlConfigResponse, SamlMetadataResponse } from './SecurityService'

/**
 * AdminFacadeService 的 Domain 方法片段。
 *
 * 从 AdminFacadeService 抽离：这些方法是对 admin 子服务（rooms/security/users）的薄委托，
 * 拆分为抽象基类以把门面文件控制在 800 行红线以内。媒体相关委托见
 * `AdminFacadeMediaMethods`。子类（AdminFacadeService）提供各子服务字段。
 */
export abstract class AdminFacadeDomainMethods extends AdminFacadeMediaMethods {
  abstract readonly rooms: AdminRoomService

  // ==================== Domain Methods ====================

  async adminGetSpaces(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{ spaces: AdminSpaceInfo[]; next_batch?: string | undefined }> {
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
  ): Promise<AdminAuditLogPage> {
    return this.security.getAuditLog(limit, from, userId, eventType)
  }

  /** 获取 SAML 元数据。 */
  async getSamlMetadata(): Promise<SamlMetadataResponse> {
    return this.security.getSamlMetadata()
  }

  /** 获取服务提供方（SP）元数据。 */
  async getSpMetadata(): Promise<Blob | string | null> {
    return this.security.getSpMetadata()
  }

  /** 刷新身份提供方（IdP）元数据。 */
  async refreshIdpMetadata(): Promise<SamlMetadataResponse> {
    return this.security.refreshIdpMetadata()
  }

  /** 获取 SAML 配置。 */
  async getSamlConfig(): Promise<SamlConfigResponse> {
    return this.security.getSamlConfig()
  }

  /** 更新 SAML 配置。 */
  async updateSamlConfig(config: Partial<SamlMetadata>): Promise<void> {
    return this.security.updateSamlConfig(config)
  }

  /** 获取指定用户加入的房间列表。 */
  async getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>> {
    return this.users.getUserRooms(userId)
  }

  /** 获取指定用户的统计信息。 */
  async getUserStats(userId: string): Promise<AdminUserStats | null> {
    return this.users.getUserStats(userId)
  }

  /** 获取用户统计列表。 */
  async getUserStatsList(): Promise<{ stats: AdminUserStatsOverview[]; nextToken?: string | undefined }> {
    return this.users.getUserStatsList()
  }

  /** 获取指定用户的完整信息（用于详情刷新）。 */
  async getUserById(userId: string): Promise<UserInfo | null> {
    return this.users.getUserById(userId)
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
  async getUserSessions(userId: string): Promise<AdminUserSession[]> {
    return this.users.getUserSessions(userId)
  }

  /** 使指定用户的会话失效。 */
  async invalidateUserSession(userId: string): Promise<void> {
    return this.users.invalidateUserSession(userId)
  }

  /** 获取指定账户的信息。 */
  async getAccountInfo(userId: string): Promise<AdminAccountInfo | null> {
    return this.users.getAccountInfo(userId)
  }

  /** 更新指定账户信息。 */
  async updateAccountInfo(userId: string, updates: AdminAccountInfoUpdate): Promise<void> {
    return this.users.updateAccountInfo(userId, updates)
  }

  /** 检查指定用户是否为管理员。 */
  async checkUserAdmin(userId: string): Promise<boolean> {
    return this.users.checkUserAdmin(userId)
  }

  /** 获取指定账户的状态。 */
  async getAccountStatus(userId: string): Promise<AdminAccountStatusInfo | null> {
    return this.users.getAccountStatus(userId)
  }

  async getLoginFailures(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{ failures: AdminLoginFailure[]; nextToken?: string | undefined }> {
    return this.users.getLoginFailures(limit, from)
  }

  async getRoomMessages(
    roomId: string,
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    dir: 'b' | 'f' = 'b'
  ): Promise<{
    chunk: AdminRoomMessageChunkItem[]
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
  async getSingleRoomStats(roomId: string): Promise<AdminRoomStatsInfo | null> {
    return this.rooms.getSingleRoomStats(roomId)
  }

  /** 获取房间的公开目录（listing）信息。 */
  async getRoomListings(roomId: string): Promise<AdminRoomListingsInfo | null> {
    return this.rooms.getRoomListings(roomId)
  }

  /** 设置房间是否公开列入目录。 */
  async setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void> {
    return this.rooms.setRoomPublicListing(roomId, isPublic)
  }

  /** 读取房间 token 同步信息。 */
  async getRoomTokenSync(roomId: string): Promise<AdminRoomTokenSync | null> {
    return this.rooms.getRoomTokenSync(roomId)
  }

  /** 级联撤回指定事件及其关联链，返回被删除事件数。 */
  async cascadeRedactEvent(
    roomId: string,
    eventId: string,
    options?: { maxDepth?: number; reason?: string }
  ): Promise<number> {
    return this.rooms.cascadeRedactEvent(roomId, eventId, options)
  }

  /** 获取指定事件的上下文（前后事件）。 */
  async getRoomEventContext(roomId: string, eventId: string): Promise<AdminRoomEventContextInfo | null> {
    return this.rooms.getRoomEventContext(roomId, eventId)
  }

  async searchInRoom(
    roomId: string,
    searchTerm: string,
    limit = DEFAULT_PAGE_LIMIT
  ): Promise<{ results: AdminRoomEventItem[]; nextBatch?: string | undefined }> {
    return this.rooms.searchInRoom(roomId, searchTerm, limit)
  }

  async searchRooms(
    searchTerm: string
  ): Promise<{ rooms: AdminRoomSearchResultItem[]; nextBatch?: string | undefined }> {
    return this.rooms.searchRooms(searchTerm)
  }

  /** 获取房间的前向极点数（后端返回的是计数，不是极点对象数组）。 */
  async getRoomForwardExtremities(roomId: string): Promise<AdminRoomForwardExtremitiesInfo | null> {
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
  async getSpaceDetails(spaceId: string): Promise<AdminSpaceInfo | null> {
    return this.rooms.getSpaceDetails(spaceId)
  }

  /** 获取空间内的用户列表。 */
  async getSpaceUsers(spaceId: string): Promise<AdminSpaceUser[]> {
    return this.rooms.getSpaceUsers(spaceId)
  }

  /** 获取空间内的房间列表。 */
  async getSpaceRooms(spaceId: string): Promise<AdminSpaceRoom[]> {
    return this.rooms.getSpaceRooms(spaceId)
  }

  /** 获取空间的统计信息。 */
  async getSpaceStats(spaceId: string): Promise<AdminSpaceStatsInfo | null> {
    return this.rooms.getSpaceStats(spaceId)
  }
}
