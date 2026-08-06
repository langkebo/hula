import type { MatrixClient } from 'matrix-js-sdk'
import { ref } from 'vue'
import { TauriCommand } from '@/enums'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'
import { BaseMatrixService } from '../BaseMatrixService'
import { MATRIX_PATHS } from '../paths'
import { AdminModerationService } from './AdminModerationService'
import type {
  AdminReport,
  ContentFilter,
  CreateContentFilterRequest,
  FederationBlacklistEntry,
  FederationDestination,
  QuotaAlert,
  QuotaConfig,
  QuotaStats,
  QuotaStatus,
  RateLimit,
  RegistrationToken,
  Report,
  ReportFilters,
  ReportRequest,
  ReportRoomResponse,
  ResolveReportRequest,
  RetentionPolicy,
  RoomInfo,
  RoomRetention,
  RoomState,
  ScannerInfo,
  ServerHealth,
  ServerNoticeInfo,
  ServerNoticeResult,
  ServerQuota,
  ServerStats,
  ServerStatus,
  ServerVersion,
  ShadowBanStatus,
  ShutdownRoomResult,
  UserDevice,
  UserInfo,
  UserReputation
} from './AdminTypes'
import { AdminApplicationService } from './ApplicationService'
import { AdminBackgroundUpdateService } from './BackgroundUpdateService'
import { AdminExternalServiceService } from './ExternalServiceService'
import { AdminFederationService } from './FederationService'
import { AdminMediaService } from './MediaService'
import { AdminNotificationService } from './NotificationService'
import { AdminQuotaService } from './QuotaService'
import { AdminRegistrationTokensService } from './RegistrationTokensService'
import { AdminReportService } from './ReportService'
import { AdminRetentionService } from './RetentionService'
import { AdminRoomService } from './RoomService'
import { type AdminFeatureFlag, type AdminFeatureFlagInput, AdminSecurityService } from './SecurityService'
import { AdminServerService } from './ServerService'
import { AdminTelemetryService } from './TelemetryService'
import { AdminUserService } from './UserService'

const logger = createLogger('AdminFacadeService')

class AdminFacadeService extends BaseMatrixService {
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
  // biome-ignore lint/suspicious/noExplicitAny: SDK admin type differs from service wrapper type
  readonly notifications = new AdminNotificationService(() => this.sdkAdmin() as Promise<any>)
  readonly retention = new AdminRetentionService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly applications = new AdminApplicationService(
    async () => this.sdkAdmin() as unknown as import('./ApplicationService').ApplicationServiceAdmin
  )
  readonly reports = new AdminReportService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly quota = new AdminQuotaService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly federation = new AdminFederationService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly moderation = new AdminModerationService(() => this.getClient())
  readonly backgroundUpdates = new AdminBackgroundUpdateService(() => this.getClient())
  readonly externalServices = new AdminExternalServiceService(() => this.getClient())
  readonly telemetry = new AdminTelemetryService(() => this.getClient())

  initialize(): void {
    logger.info('[Admin] 服务已初始化')
  }

  async checkAdminApiAvailability(): Promise<boolean> {
    try {
      await this.adminRequest('GET', '/whoami')
      return true
    } catch (err) {
      // R-14: log silent catch in checkAdminApiAvailability
      logger.warn('checkAdminApiAvailability failed:', err)
      return false
    }
  }

  clearAdminApiCache(): void {
    this.adminVerifiedAt = 0
    this.cachedAdminStatus = false
  }

  private async verifyServerSidePermission(): Promise<boolean> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()
      const accessToken = client.getAccessToken()

      if (!userId || !accessToken) {
        logger.warn('[Admin] 服务端权限验证: 缺少 userId 或 accessToken')
        return false
      }

      const now = Date.now()
      if (now - this.adminVerifiedAt < this.ADMIN_VERIFY_INTERVAL) {
        return this.cachedAdminStatus
      }

      // 浏览器 dev 模式（无 Tauri runtime）：直接走 HTTP admin API 验证
      if (!hasTauriRuntime()) {
        try {
          const userInfo = await client.http.authedRequest(
            'GET',
            `/users/${encodeURIComponent(userId)}`,
            undefined,
            undefined,
            { prefix: MATRIX_PATHS.ADMIN.SYNAPSE_ADMIN_BASE_V2 }
          )
          const isAdmin = Boolean((userInfo as { admin?: boolean }).admin)
          this.cachedAdminStatus = isAdmin
          this.adminVerifiedAt = now
          if (!isAdmin) {
            logger.warn(`[Admin] 浏览器模式权限验证失败: userId=${userId}, isAdmin=false`)
          }
          return isAdmin
        } catch (err) {
          logger.error(`[Admin] 浏览器模式权限验证异常: ${err}`)
          return false
        }
      }

      const result = await invokeWithResult<{ is_admin: boolean; user_id: string }>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken,
        homeserverUrl: client.getHomeserverUrl()
      })

      if (result.isErr()) {
        logger.error(`[Admin] 服务端权限验证异常: ${result.error}`)
        return false
      }

      this.cachedAdminStatus = result.value.is_admin
      this.adminVerifiedAt = now

      if (!result.value.is_admin) {
        logger.warn(`[Admin] 服务端权限验证失败: userId=${result.value.user_id}, isAdmin=false`)
      }

      return result.value.is_admin
    } catch (err) {
      logger.error(`[Admin] 服务端权限验证异常: ${err}`)
      return false
    }
  }

  private async sdkAdmin(): Promise<import('matrix-js-sdk/admin').AdminManager> {
    const hasPermission = await this.verifyServerSidePermission()
    if (!hasPermission) {
      logger.error('[Admin] 权限不足，拒绝访问 SDK AdminManager')
      throw new Error('ADMIN_PERMISSION_DENIED')
    }
    const client = this.getClient() as MatrixClient & {
      getAdminManager?: () => import('matrix-js-sdk/admin').AdminManager
    }
    const manager = client.getAdminManager?.()
    if (!manager) {
      throw new Error(this.t('matrix_error.admin.sdk_manager_unavailable'))
    }
    return manager
  }

  private async adminRequest<TResponse>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<TResponse> {
    const client = this.getClient()
    return client.http.authedRequest(
      method,
      path,
      undefined,
      method === 'GET' || method === 'DELETE' ? undefined : body,
      { prefix: MATRIX_PATHS.ADMIN.SYNAPSE_ADMIN_BASE }
    ) as Promise<TResponse>
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

  async updateServerConfig(config: Record<string, unknown>): Promise<void> {
    return this.server.updateServerConfig(config)
  }

  // ==================== User Management ====================

  async getUsers(
    limit = 100,
    from?: string,
    name?: string,
    _guests?: boolean
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
    return this.federation.getFederationDestinations()
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    return this.federation.getFederationDestination(destination)
  }

  async resetFederationConnection(destination: string): Promise<void> {
    return this.federation.resetFederationConnection(destination)
  }

  async getFederationBlacklist(): Promise<FederationBlacklistEntry[]> {
    return this.federation.getFederationBlacklist()
  }

  async addToFederationBlacklist(domain: string, reason?: string): Promise<boolean> {
    return this.federation.addToFederationBlacklist(domain, reason)
  }

  async removeFromFederationBlacklist(domain: string): Promise<boolean> {
    return this.federation.removeFromFederationBlacklist(domain)
  }

  async getFederationStatus(): Promise<Record<string, unknown>> {
    return this.federation.getFederationStatus()
  }

  // ==================== Notification Management ====================

  async sendServerNotice(userId: string, content: Record<string, unknown>): Promise<ServerNoticeResult> {
    return this.notifications.sendServerNotice(userId, content)
  }

  async getServerNotices(limit = 50): Promise<{ notices: ServerNoticeInfo[] } | null> {
    return this.notifications.getServerNotices(limit)
  }

  // ==================== Registration Token Management ====================

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

  // ==================== Report ====================

  async reportEvent(request: ReportRequest): Promise<void> {
    return this.reports.reportEvent(request)
  }

  async reportUser(userId: string, reason: string, explanation?: string): Promise<void> {
    return this.reports.reportUser(userId, reason, explanation)
  }

  async reportRoom(roomId: string, reason: string, description?: string): Promise<ReportRoomResponse | null> {
    return this.reports.reportRoom(roomId, reason, description)
  }

  async scoreReport(roomId: string, eventId: string, score: number): Promise<void> {
    return this.reports.scoreReport(roomId, eventId, score)
  }

  async getScannerInfo(roomId: string, eventId: string): Promise<ScannerInfo | null> {
    return this.reports.getScannerInfo(roomId, eventId)
  }

  async getAdminReports(
    roomId?: string,
    limit: number = 50,
    from?: string
  ): Promise<{ reports: AdminReport[]; next_batch?: string }> {
    return this.reports.getAdminReports(roomId, limit, from)
  }

  async getAdminReport(reportId: string): Promise<AdminReport | null> {
    return this.reports.getAdminReport(reportId)
  }

  async dismissReport(reportId: string): Promise<boolean> {
    return this.reports.dismissReport(reportId)
  }

  // ==================== Moderation ====================

  onModerationEvent(event: string, callback: (...args: unknown[]) => void): void {
    this.moderation.onModerationEvent(event, callback)
  }

  offModerationEvent(event: string, callback: (...args: unknown[]) => void): void {
    this.moderation.offModerationEvent(event, callback)
  }

  stopModeration(): void {
    this.moderation.stopModeration()
  }

  async getModerationReports(filters?: ReportFilters): Promise<Report[]> {
    return this.moderation.getModerationReports(filters)
  }

  async resolveModerationReport(reportId: string, request: ResolveReportRequest): Promise<void> {
    return this.moderation.resolveModerationReport(reportId, request)
  }

  async getUserReputation(userId: string): Promise<UserReputation> {
    return this.moderation.getUserReputation(userId)
  }

  async setUserReputation(userId: string, score: number): Promise<void> {
    return this.moderation.setUserReputation(userId, score)
  }

  async getContentFilters(): Promise<ContentFilter[]> {
    return this.moderation.getContentFilters()
  }

  async addContentFilter(filter: CreateContentFilterRequest): Promise<ContentFilter> {
    return this.moderation.addContentFilter(filter)
  }

  async removeContentFilter(filterId: string): Promise<void> {
    return this.moderation.removeContentFilter(filterId)
  }

  // ==================== Quota ====================

  async checkQuota(): Promise<QuotaStatus> {
    return this.quota.checkQuota()
  }

  async getQuotaStats(): Promise<QuotaStats> {
    return this.quota.getQuotaStats()
  }

  async getQuotaAlerts(): Promise<QuotaAlert[]> {
    return this.quota.getQuotaAlerts()
  }

  async getQuotaConfigs(): Promise<QuotaConfig[]> {
    return this.quota.getQuotaConfigs()
  }

  async setUserQuota(userId: string, quota: number): Promise<void> {
    return this.quota.setUserQuota(userId, quota)
  }

  async getServerQuota(): Promise<ServerQuota> {
    return this.quota.getServerQuota()
  }

  async getUploadSizeLimit(throwOnError = true): Promise<number> {
    return this.quota.getUploadSizeLimit(throwOnError)
  }

  async getUploadFileSizeLimit(throwOnError = true): Promise<number> {
    return this.quota.getUploadFileSizeLimit(throwOnError)
  }

  async getUserStorageUsage(throwOnError = true): Promise<{ size: number; ntFiles: number } | null> {
    return this.quota.getUserStorageUsage(throwOnError)
  }

  async hasStorageSpace(requiredBytes: number): Promise<boolean> {
    return this.quota.hasStorageSpace(requiredBytes)
  }

  // ==================== Retention (client API) ====================

  async getRoomRetention(roomId: string): Promise<RoomRetention> {
    return this.retention.getRoomRetention(roomId)
  }

  async setRoomRetention(roomId: string, policy: RetentionPolicy): Promise<void> {
    return this.retention.setRoomRetention(roomId, policy)
  }

  async deleteRoomRetention(roomId: string): Promise<void> {
    return this.retention.deleteRoomRetention(roomId)
  }

  async getDefaultRetention(): Promise<RetentionPolicy | null> {
    return this.retention.getDefaultRetention()
  }

  // ==================== Domain Methods (from AdminFacadeDomainMethods) ====================

  async getMediaList(
    limit = 100,
    from?: string,
    orderBy?: string,
    search?: string
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
    return this.media.getMediaList(limit, from, orderBy, search)
  }

  async deleteMedia(mediaId: string): Promise<void> {
    return this.media.deleteMedia(mediaId)
  }

  async purgeRemoteMedia(beforeTs: number, includeProfiles = false): Promise<{ deleted: number }> {
    return this.media.purgeRemoteMedia(beforeTs, includeProfiles)
  }

  async adminGetSpaces(
    limit = 50,
    from?: string
  ): Promise<{ spaces: Array<Record<string, unknown>>; next_batch?: string }> {
    return this.rooms.adminGetSpaces(limit, from)
  }

  async adminDeleteSpace(spaceId: string): Promise<void> {
    return this.rooms.adminDeleteSpace(spaceId)
  }

  async getRateLimits(userId?: string): Promise<Record<string, unknown>> {
    return this.users.getRateLimits(userId)
  }

  async setRateLimits(userId: string, limits: Record<string, unknown>): Promise<void> {
    return this.users.setRateLimits(userId, limits)
  }

  async getAuditLog(
    limit = 50,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<{ logs: Array<Record<string, unknown>>; next_batch?: string }> {
    return this.security.getAuditLog(limit, from, userId, eventType)
  }

  async getSamlMetadata(): Promise<Record<string, unknown>> {
    return this.security.getSamlMetadata()
  }

  async getSpMetadata(): Promise<Blob | string | null> {
    return this.security.getSpMetadata()
  }

  async refreshIdpMetadata(): Promise<Record<string, unknown>> {
    return this.security.refreshIdpMetadata()
  }

  async getSamlConfig(): Promise<Record<string, unknown>> {
    return this.security.getSamlConfig()
  }

  async updateSamlConfig(config: Record<string, unknown>): Promise<void> {
    return this.security.updateSamlConfig(config)
  }

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

  async getAccountStatus(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getAccountStatus(userId)
  }

  async getLoginFailures(
    limit = 50,
    from?: string
  ): Promise<{ failures: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.users.getLoginFailures(limit, from)
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
  ): Promise<{ results: Array<Record<string, unknown>>; nextBatch?: string }> {
    return this.rooms.searchInRoom(roomId, searchTerm, limit)
  }

  async searchRooms(
    searchTerm: string,
    limit = 50
  ): Promise<{ rooms: Array<Record<string, unknown>>; nextBatch?: string }> {
    return this.rooms.searchRooms(searchTerm, limit)
  }

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
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }> {
    return this.rooms.deleteRoom(roomId, options)
  }

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

  // ==================== Ops Methods (from AdminFacadeOpsMethods) ====================

  async restartServer(): Promise<void> {
    return this.server.restartServer()
  }

  async getExperimentalFeatures(): Promise<Record<string, unknown>> {
    return this.security.getExperimentalFeatures()
  }

  async listFeatureFlagsDetailed(): Promise<AdminFeatureFlag[]> {
    return this.security.listFeatureFlagsDetailed()
  }

  async getFeatureFlagDetail(flagKey: string): Promise<AdminFeatureFlag | null> {
    return this.security.getFeatureFlagDetail(flagKey)
  }

  async saveFeatureFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
    return this.security.saveFeatureFlag(input)
  }

  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    return this.security.setExperimentalFeature(feature, enabled)
  }

  async deleteFeatureFlag(flagKey: string): Promise<void> {
    return this.security.deleteFeatureFlag(flagKey)
  }

  async getBackups(): Promise<Array<Record<string, unknown>>> {
    return this.security.getBackups()
  }

  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    return this.security.getFederationServerStatus(serverName)
  }

  async reconnectFederation(serverName: string): Promise<void> {
    return this.security.reconnectFederation(serverName)
  }

  async getRetentionPolicies(
    limit = 50,
    from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }> {
    return this.retention.getRetentionPolicies(limit, from)
  }

  async getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null> {
    return this.retention.getRetentionPolicy(roomId)
  }

  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    return this.retention.setRetentionPolicy(roomId, maxLifetime, minLifetime)
  }

  async deleteRetentionPolicy(roomId: string): Promise<void> {
    return this.retention.deleteRetentionPolicy(roomId)
  }

  async runRetentionTask(): Promise<void> {
    return this.retention.runRetentionTask()
  }

  async getRetentionStatus(): Promise<Record<string, unknown>> {
    return this.retention.getRetentionStatus()
  }

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

  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    return this.security.getAuditEvent(eventId)
  }

  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    return this.media.purgeMediaCache(beforeTs)
  }

  async getSamlMappings(
    limit = 50,
    from?: string
  ): Promise<{ mappings: Array<Record<string, unknown>>; nextToken?: string }> {
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

  async createSystemNotification(
    content: string,
    type = 'info',
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

  async getUserRateLimit(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getUserRateLimit(userId)
  }

  async setUserRateLimit(userId: string, limit: Record<string, unknown>): Promise<void> {
    return this.users.setUserRateLimit(userId, limit)
  }

  async deleteUserRateLimit(userId: string): Promise<void> {
    return this.users.deleteUserRateLimit(userId)
  }

  async getAdminInfo(): Promise<Record<string, unknown> | null> {
    return this.server.getAdminInfo()
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

function _useAdmin() {
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
