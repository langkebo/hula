import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { info, error, warn } from '@tauri-apps/plugin-log'
import { invoke } from '@tauri-apps/api/core'
import { TauriCommand } from '@/enums'
import { AdminRoomService } from './RoomService'
import { AdminRegistrationTokensService } from './RegistrationTokensService'
import { AdminSecurityService } from './SecurityService'
import { AdminUserService } from './UserService'
import { AdminServerService } from './ServerService'
import { AdminMediaService } from './MediaService'
import { AdminNotificationService } from './NotificationService'
import { AdminRetentionService } from './RetentionService'
import { AdminApplicationService } from './ApplicationService'
import type {
  ServerStats,
  ServerStatus,
  ServerHealth,
  ServerVersion,
  UserInfo,
  UserDevice,
  RateLimit,
  ShadowBanStatus,
  RoomInfo,
  RoomState,
  ShutdownRoomResult,
  FederationDestination,
  ServerNoticeResult,
  ServerNoticeInfo,
  RegistrationToken
} from './AdminTypes'
export type {
  ServerStats,
  ServerStatus,
  ServerHealth,
  ServerInfo,
  ServerVersion,
  UserInfo,
  UserDevice,
  RateLimit,
  ShadowBanStatus,
  RoomInfo,
  RoomState,
  ShutdownRoomResult,
  FederationDestination,
  FederationBlacklistEntry,
  ServerNoticeResult,
  ServerNoticeInfo,
  RegistrationToken
} from './AdminTypes'

class AdminFacadeService {
  private adminVerifiedAt = 0
  private readonly ADMIN_VERIFY_INTERVAL = 2 * 60 * 1000
  private cachedAdminStatus = false

  readonly registrationTokens = new AdminRegistrationTokensService(() => this.sdkAdmin())
  readonly users = new AdminUserService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly rooms = new AdminRoomService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly security = new AdminSecurityService(() => this.sdkAdmin())
  readonly server = new AdminServerService(() => this.sdkAdmin())
  readonly media = new AdminMediaService(() => this.sdkAdmin())
  readonly notifications = new AdminNotificationService(() => this.sdkAdmin())
  readonly retention = new AdminRetentionService(() => this.sdkAdmin())
  readonly applications = new AdminApplicationService(() => this.sdkAdmin())

  initialize(): void {
    info('[Admin] 服务已初始化')
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private async verifyServerSidePermission(): Promise<boolean> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()
      const accessToken = client.getAccessToken()

      if (!userId || !accessToken) {
        warn('[Admin] 服务端权限验证: 缺少 userId 或 accessToken')
        return false
      }

      const now = Date.now()
      if (now - this.adminVerifiedAt < this.ADMIN_VERIFY_INTERVAL) {
        return this.cachedAdminStatus
      }

      const result = await invoke<{ is_admin: boolean; user_id: string }>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken
      })

      this.cachedAdminStatus = result.is_admin
      this.adminVerifiedAt = now

      if (!result.is_admin) {
        warn(`[Admin] 服务端权限验证失败: userId=${result.user_id}, isAdmin=false`)
      }

      return result.is_admin
    } catch (err) {
      error(`[Admin] 服务端权限验证异常: ${err}`)
      return false
    }
  }

  /**
   * Returns the SDK `AdminManager` after running local permission verification.
   *
   * Phase B migration helper: all admin methods delegate here. The SDK owns
   * the HTTP contract (path / parameters / types) so Hula cannot drift from
   * the backend.
   *
   * @throws Error('ADMIN_PERMISSION_DENIED') if permission check fails.
   */
  private async sdkAdmin() {
    const hasPermission = await this.verifyServerSidePermission()
    if (!hasPermission) {
      error('[Admin] 权限不足，拒绝访问 SDK AdminManager')
      throw new Error('ADMIN_PERMISSION_DENIED')
    }
    const client = this.getClient() as MatrixClient & {
      getAdminManager?: () => import('matrix-js-sdk/admin').AdminManager
    }
    const manager = client.getAdminManager?.()
    if (!manager) {
      throw new Error('SDK AdminManager 不可用')
    }
    return manager
  }

  // ==================== Server Management ====================

  async getServerStats(): Promise<ServerStats> {
    return this.server.getServerStats()
  }

  async getServerStatus(): Promise<ServerStatus | null> {
    return this.server.getServerStatus()
  }

  async getServerHealth(): Promise<ServerHealth | null> {
    return this.server.getServerHealth()
  }

  async getServerVersion(): Promise<ServerVersion | null> {
    return this.server.getServerVersion()
  }

  async getServerConfig(): Promise<Record<string, unknown> | null> {
    return this.server.getServerConfig()
  }

  // ==================== User Management ====================

  async getUsers(
    limit = 100,
    from?: string,
    name?: string,
    _guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.users.getUsers(limit, from, name, _guests)
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    return this.users.getUser(userId)
  }

  async createUser(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    return this.users.createUser(username, password, options)
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    return this.users.resetPassword(userId, newPassword)
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    return this.users.setAdmin(userId, isAdmin)
  }

  async deactivateUser(userId: string): Promise<void> {
    return this.users.deactivateUser(userId)
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return this.users.getUserDevices(userId)
  }

  async deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    return this.users.deleteUserDevice(userId, deviceId)
  }

  async deleteUserDevices(userId: string, deviceIds: string[]): Promise<void> {
    return this.users.deleteUserDevices(userId, deviceIds)
  }

  async getRateLimit(userId: string): Promise<RateLimit | null> {
    return this.users.getRateLimit(userId)
  }

  async setRateLimit(userId: string, _limit: RateLimit): Promise<void> {
    return this.users.setRateLimit(userId, _limit)
  }

  async deleteRateLimit(userId: string): Promise<void> {
    return this.users.deleteRateLimit(userId)
  }

  async shadowBanUser(userId: string): Promise<void> {
    return this.users.shadowBanUser(userId)
  }

  async unshadowBanUser(userId: string): Promise<void> {
    return this.users.unshadowBanUser(userId)
  }

  async getShadowBanStatus(userId: string): Promise<ShadowBanStatus | null> {
    return this.users.getShadowBanStatus(userId)
  }

  async getWhois(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getWhois(userId)
  }

  // ==================== Room Management ====================

  async getRooms(limit = 100, from?: string, searchTerm?: string): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
    return this.rooms.getRooms(limit, from, searchTerm)
  }

  async getRoom(roomId: string): Promise<RoomInfo | null> {
    return this.rooms.getRoom(roomId)
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    return this.rooms.getRoomMembers(roomId)
  }

  async getRoomState(roomId: string): Promise<RoomState | null> {
    return this.rooms.getRoomState(roomId)
  }

  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    return this.rooms.deleteRoom(roomId, options)
  }

  async blockRoom(roomId: string, block: boolean): Promise<void> {
    return this.rooms.blockRoom(roomId, block)
  }

  async shutdownRoom(roomId: string, _message?: string): Promise<ShutdownRoomResult> {
    return this.rooms.shutdownRoom(roomId, _message)
  }

  async forceJoinRoom(roomId: string, userId: string): Promise<void> {
    return this.rooms.forceJoinRoom(roomId, userId)
  }

  async forceLeaveRoom(roomId: string, userId: string): Promise<void> {
    return this.rooms.forceLeaveRoom(roomId, userId)
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return this.rooms.kickUser(roomId, userId, reason)
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return this.rooms.banUser(roomId, userId, reason)
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    return this.rooms.unbanUser(roomId, userId)
  }

  // ==================== Federation Management ====================

  async getFederationDestinations(): Promise<FederationDestination[]> {
    return this.security.getFederationDestinations()
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    return this.security.getFederationDestination(destination)
  }

  async resetFederationConnection(destination: string): Promise<void> {
    return this.security.resetFederationConnection(destination)
  }

  // ==================== Notification Management ====================

  async sendServerNotice(userId: string, content: Record<string, unknown>): Promise<ServerNoticeResult> {
    return this.notifications.sendServerNotice(userId, content)
  }

  async getServerNotices(limit = 50): Promise<{ notices: ServerNoticeInfo[] } | null> {
    return this.notifications.getServerNotices(limit)
  }

  // ==================== Registration Token Management ====================
  // Delegated to ./admin/RegistrationTokensService.ts — see `this.registrationTokens`.

  async getRegistrationTokens(_valid?: boolean): Promise<RegistrationToken[]> {
    return this.registrationTokens.list()
  }

  async getRegistrationToken(token: string): Promise<RegistrationToken | null> {
    return this.registrationTokens.get(token)
  }

  async createRegistrationToken(options?: {
    token?: string
    usesAllowed?: number
    expiryTime?: number
    length?: number
  }): Promise<RegistrationToken | null> {
    return this.registrationTokens.create(options)
  }

  async updateRegistrationToken(
    token: string,
    updates: { usesAllowed?: number; expiryTime?: number }
  ): Promise<RegistrationToken | null> {
    return this.registrationTokens.update(token, updates)
  }

  async deleteRegistrationToken(token: string): Promise<void> {
    return this.registrationTokens.delete(token)
  }

  // ==================== Media Management ====================

  async getMediaList(
    limit = 100,
    from?: string,
    _orderBy?: string,
    _search?: string
  ): Promise<{
    media: Array<{
      mediaId: string
      mediaType: string
      contentUri: string
      createdAt: number
      uploadName?: string
      mediaLength?: number
    }>
    nextToken?: string
  }> {
    return this.media.getMediaList(limit, from, _orderBy, _search)
  }

  async deleteMedia(mediaId: string): Promise<void> {
    return this.media.deleteMedia(mediaId)
  }

  async purgeRemoteMedia(beforeTs: number, includeProfiles: boolean = false): Promise<{ deleted: number }> {
    return this.media.purgeRemoteMedia(beforeTs, includeProfiles)
  }

  async adminGetSpaces(
    limit: number = 50,
    from?: string
  ): Promise<{
    spaces: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    return this.rooms.adminGetSpaces(limit, from)
  }

  async adminDeleteSpace(spaceId: string): Promise<void> {
    return this.rooms.adminDeleteSpace(spaceId)
  }

  async shadowBan(userId: string, ban: boolean = true): Promise<void> {
    return this.users.shadowBan(userId, ban)
  }

  async getRateLimits(userId?: string): Promise<Record<string, unknown>> {
    return this.users.getRateLimits(userId)
  }

  async setRateLimits(userId: string, _limits: Record<string, unknown>): Promise<void> {
    return this.users.setRateLimits(userId, _limits)
  }

  async getAuditLog(
    limit: number = 50,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<{
    logs: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    return this.security.getAuditLog(limit, from, userId, eventType)
  }

  async getSamlConfig(): Promise<Record<string, unknown>> {
    return this.security.getSamlConfig()
  }

  async updateSamlConfig(config: Record<string, unknown>): Promise<void> {
    return this.security.updateSamlConfig(config)
  }

  // ==================== v2 User Management ====================

  async getUsersV2(
    limit = 100,
    from?: string,
    name?: string,
    _guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.users.getUsersV2(limit, from, name, _guests)
  }

  async getUserV2(userId: string): Promise<UserInfo | null> {
    return this.users.getUserV2(userId)
  }

  async createUserV2(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    return this.users.createUserV2(username, password, options)
  }

  // ==================== Extended User Management ====================

  async getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>> {
    return this.users.getUserRooms(userId)
  }

  async getUserStats(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getUserStats(userId)
  }

  async getUserStatsList(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.users.getUserStatsList(limit, from)
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

  async batchDeactivateUsers(userIds: string[], erase = false): Promise<Array<{ userId: string; success: boolean }>> {
    return this.users.batchDeactivateUsers(userIds, erase)
  }

  async evictUser(userId: string): Promise<void> {
    return this.users.evictUser(userId)
  }

  async loginUserAs(userId: string): Promise<{ accessToken: string; deviceId: string } | null> {
    return this.users.loginUserAs(userId)
  }

  async logoutUserAll(userId: string): Promise<void> {
    return this.users.logoutUserAll(userId)
  }

  async getUserSessions(userId: string): Promise<Array<Record<string, unknown>>> {
    return this.users.getUserSessions(userId)
  }

  async invalidateUserSession(userId: string): Promise<void> {
    return this.users.invalidateUserSession(userId)
  }

  async getAccountInfo(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getAccountInfo(userId)
  }

  async updateAccountInfo(userId: string, updates: Record<string, unknown>): Promise<void> {
    return this.users.updateAccountInfo(userId, updates)
  }

  async checkUserAdmin(userId: string): Promise<boolean> {
    return this.users.checkUserAdmin(userId)
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    return this.users.setUserAdmin(userId, isAdmin)
  }

  async deactivateUserV2(userId: string): Promise<void> {
    return this.users.deactivateUserV2(userId)
  }

  async resetPasswordV2(userId: string, newPassword: string): Promise<void> {
    return this.users.resetPasswordV2(userId, newPassword)
  }

  async getAccountStatus(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getAccountStatus(userId)
  }

  async getLoginFailures(
    limit = 50,
    from?: string
  ): Promise<{
    failures: Array<Record<string, unknown>>
    nextToken?: string
  }> {
    return this.users.getLoginFailures(limit, from)
  }

  // ==================== Extended Room Management ====================

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
    return this.rooms.getRoomMessages(roomId, limit, from, dir)
  }

  async getRoomAliases(roomId: string): Promise<string[]> {
    return this.rooms.getRoomAliases(roomId)
  }

  async getRoomVersion(roomId: string): Promise<string | null> {
    return this.rooms.getRoomVersion(roomId)
  }

  async getRoomBlockStatus(roomId: string): Promise<boolean> {
    return this.rooms.getRoomBlockStatus(roomId)
  }

  async unblockRoom(roomId: string): Promise<void> {
    return this.rooms.unblockRoom(roomId)
  }

  async makeRoomAdmin(roomId: string, userId?: string): Promise<void> {
    return this.rooms.makeRoomAdmin(roomId, userId)
  }

  async purgeHistory(
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ): Promise<{ purgeId: string }> {
    return this.rooms.purgeHistory(roomId, options)
  }

  async purgeRoom(roomId: string): Promise<void> {
    return this.rooms.purgeRoom(roomId)
  }

  async getRoomStats(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.rooms.getRoomStats(limit, from)
  }

  async getSingleRoomStats(roomId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getSingleRoomStats(roomId)
  }

  async getRoomListings(roomId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getRoomListings(roomId)
  }

  async setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void> {
    return this.rooms.setRoomPublicListing(roomId, isPublic)
  }

  async getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getRoomEventContext(roomId, eventId)
  }

  async searchInRoom(
    roomId: string,
    searchTerm: string,
    limit = 50
  ): Promise<{
    results: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    return this.rooms.searchInRoom(roomId, searchTerm, limit)
  }

  async searchRooms(
    searchTerm: string,
    limit = 50
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    return this.rooms.searchRooms(searchTerm, limit)
  }

  async getRoomForwardExtremities(roomId: string): Promise<Array<Record<string, unknown>>> {
    return this.rooms.getRoomForwardExtremities(roomId)
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
    return this.rooms.deleteRoomV2(roomId, options)
  }

  // ==================== Space Management Extended ====================

  async getSpaceDetails(spaceId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getSpaceDetails(spaceId)
  }

  async getSpaceUsers(spaceId: string): Promise<Array<Record<string, unknown>>> {
    return this.rooms.getSpaceUsers(spaceId)
  }

  async getSpaceRooms(spaceId: string): Promise<Array<Record<string, unknown>>> {
    return this.rooms.getSpaceRooms(spaceId)
  }

  async getSpaceStats(spaceId: string): Promise<Record<string, unknown> | null> {
    return this.rooms.getSpaceStats(spaceId)
  }

  // ==================== Server Management Extended ====================

  async restartServer(): Promise<void> {
    return this.server.restartServer()
  }

  async getExperimentalFeatures(): Promise<Record<string, unknown>> {
    return this.security.getExperimentalFeatures()
  }

  /**
   * Toggle an experimental feature flag.
   *
   * Backend has no PUT on `/experimental_features`; it is driven by the
   * feature-flag service. This wrapper delegates to SDK `updateFeatureFlag`.
   */
  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    return this.security.setExperimentalFeature(feature, enabled)
  }

  async getBackups(): Promise<Array<Record<string, unknown>>> {
    return this.security.getBackups()
  }

  // ==================== Federation Extended ====================

  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    return this.security.getFederationServerStatus(serverName)
  }

  async reconnectFederation(serverName: string): Promise<void> {
    return this.security.reconnectFederation(serverName)
  }

  // ==================== Retention Policy ====================

  /**
   * Returns the server-global retention policy wrapped as a single-entry list
   * for UI compatibility. Backend only exposes the global policy; there is no
   * list endpoint. Per-room policies are fetched via {@link getRetentionPolicy}.
   */
  async getRetentionPolicies(
    _limit = 50,
    _from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.retention.getRetentionPolicies(_limit, _from)
  }

  async getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null> {
    return this.retention.getRetentionPolicy(roomId)
  }

  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    return this.retention.setRetentionPolicy(roomId, maxLifetime, minLifetime)
  }

  /**
   * @deprecated backend has no DELETE on `/retention/policy/{room_id}`. No-op
   * stub retained so existing callers do not throw; consider removing the UI
   * affordance instead.
   */
  async deleteRetentionPolicy(_roomId: string): Promise<void> {
    return this.retention.deleteRetentionPolicy(_roomId)
  }

  async runRetentionTask(): Promise<void> {
    return this.retention.runRetentionTask()
  }

  async getRetentionStatus(): Promise<Record<string, unknown>> {
    return this.retention.getRetentionStatus()
  }

  // ==================== Admin Registration ====================

  async getRegistrationNonce(): Promise<string> {
    return this.users.getRegistrationNonce()
  }

  async adminRegister(
    username: string,
    password: string,
    nonce: string,
    admin = false,
    mac?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string } | null> {
    return this.users.adminRegister(username, password, nonce, admin, mac)
  }

  // ==================== Audit Extended ====================

  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    return this.security.getAuditEvent(eventId)
  }

  // ==================== Media Extended ====================

  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    return this.media.purgeMediaCache(beforeTs)
  }

  // ==================== SAML Extended ====================

  async getSamlMappings(
    limit = 50,
    from?: string
  ): Promise<{
    mappings: Array<Record<string, unknown>>
    nextToken?: string
  }> {
    return this.security.getSamlMappings(limit, from)
  }

  async getSamlMapping(nameId: string): Promise<Record<string, unknown> | null> {
    return this.security.getSamlMapping(nameId)
  }

  async updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void> {
    return this.security.updateSamlMapping(nameId, updates)
  }

  async deleteSamlMapping(nameId: string): Promise<void> {
    return this.security.deleteSamlMapping(nameId)
  }

  async samlLogout(userId: string): Promise<void> {
    return this.security.samlLogout(userId)
  }

  // ==================== Notification Extended ====================

  async getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null> {
    return this.notifications.getUserNotificationSettings(userId)
  }

  async setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    return this.notifications.setUserNotificationSettings(userId, settings)
  }

  async getUserPushers(userId: string): Promise<Array<Record<string, unknown>>> {
    return this.notifications.getUserPushers(userId)
  }

  async deleteUserPusher(userId: string, pushkey: string, appId: string): Promise<void> {
    return this.notifications.deleteUserPusher(userId, pushkey, appId)
  }

  // ==================== Application Services ====================

  async getApplicationServices(
    limit = 50,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.applications.getApplicationServices(limit, from)
  }

  async registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.applications.registerApplicationService(asToken, config)
  }

  async getApplicationService(serviceId: string): Promise<Record<string, unknown> | null> {
    return this.applications.getApplicationService(serviceId)
  }

  async updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void> {
    return this.applications.updateApplicationService(serviceId, config)
  }

  async deleteApplicationService(serviceId: string): Promise<void> {
    return this.applications.deleteApplicationService(serviceId)
  }

  async pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number }> {
    return this.applications.pingApplicationService(serviceId)
  }

  // ==================== System Notifications CRUD ====================

  async createSystemNotification(
    content: string,
    type: string = 'info',
    targetUsers?: string[]
  ): Promise<{ notificationId: string }> {
    return this.notifications.createSystemNotification(content, type, targetUsers)
  }

  async getSystemNotifications(
    limit = 50,
    from?: string
  ): Promise<{ notifications: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.notifications.getSystemNotifications(limit, from)
  }

  async getSystemNotification(notificationId: string): Promise<Record<string, unknown> | null> {
    return this.notifications.getSystemNotification(notificationId)
  }

  async updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void> {
    return this.notifications.updateSystemNotification(notificationId, updates)
  }

  async deleteSystemNotification(notificationId: string): Promise<void> {
    return this.notifications.deleteSystemNotification(notificationId)
  }

  // ==================== Room Delete Compatible ====================

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
    return this.rooms.deleteRoomCompat(roomId, options)
  }

  // ==================== User Rate Limit ====================

  async getUserRateLimit(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getUserRateLimit(userId)
  }

  async setUserRateLimit(userId: string, limit: Record<string, unknown>): Promise<void> {
    return this.users.setUserRateLimit(userId, limit)
  }

  async deleteUserRateLimit(userId: string): Promise<void> {
    return this.users.deleteUserRateLimit(userId)
  }

  // ==================== Admin Info ====================

  /**
   * Aggregate admin info. Delegates to SDK `AdminManager.getServerInfo`,
   * which merges `/status` + `/config` + `/server_version` server-side.
   */
  async getAdminInfo(): Promise<Record<string, unknown> | null> {
    return this.server.getAdminInfo()
  }

  async deleteUser(userId: string): Promise<void> {
    return this.users.deleteUser(userId)
  }

  async getSecurityEvents(
    limit = 100,
    from?: string,
    filters?: Record<string, unknown>
  ): Promise<{ events: Array<Record<string, unknown>>; nextToken?: string } | null> {
    return this.security.getSecurityEvents(limit, from, filters)
  }

  async getIpBlocks(): Promise<Array<Record<string, unknown>> | null> {
    return this.security.getIpBlocks()
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null> {
    return this.security.blockIp(ip, options)
  }

  async unblockIp(ip: string): Promise<void> {
    return this.security.unblockIp(ip)
  }

  async getIpReputation(ip: string): Promise<Record<string, unknown> | null> {
    return this.security.getIpReputation(ip)
  }

  async getServerLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit = 100
  ): Promise<Array<Record<string, unknown>> | null> {
    return this.server.getServerLogs(level, limit)
  }

  async getMediaStats(): Promise<Record<string, unknown> | null> {
    return this.media.getMediaStats()
  }
}

export const adminService = new AdminFacadeService()

import { ref } from 'vue'

export function useAdmin() {
  const stats = ref<ServerStats | null>(null)
  const users = ref<UserInfo[]>([])
  const rooms = ref<RoomInfo[]>([])
  const isLoading = ref(false)

  function initialize() {
    adminService.initialize()
  }

  async function loadStats() {
    isLoading.value = true
    try {
      stats.value = await adminService.getServerStats()
    } finally {
      isLoading.value = false
    }
  }

  async function loadUsers(limit?: number) {
    isLoading.value = true
    try {
      const result = await adminService.getUsers(limit)
      users.value = result.users
    } finally {
      isLoading.value = false
    }
  }

  async function loadRooms(limit?: number) {
    isLoading.value = true
    try {
      const result = await adminService.getRooms(limit)
      rooms.value = result.rooms
    } finally {
      isLoading.value = false
    }
  }

  return { stats, users, rooms, isLoading, initialize, loadStats, loadUsers, loadRooms }
}

export default adminService
