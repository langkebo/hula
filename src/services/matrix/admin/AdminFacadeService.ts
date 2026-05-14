import { error, info, warn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { ref } from 'vue'
import { TauriCommand } from '@/enums'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'
import { BaseMatrixService } from '../BaseMatrixService'
import { MATRIX_PATHS } from '../paths'
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
import { AdminMediaService } from './MediaService'
import { AdminNotificationService } from './NotificationService'
import { AdminRegistrationTokensService } from './RegistrationTokensService'
import { AdminRetentionService } from './RetentionService'
import { AdminRoomService } from './RoomService'
import { AdminSecurityService } from './SecurityService'
import { AdminServerService } from './ServerService'
import { AdminUserService } from './UserService'

export type {
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
  ReportReason,
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

interface ModerationManager {
  start(): Promise<void>
  stop(): void
  on(event: string, callback: (...args: unknown[]) => void): void
  removeAllListeners(): void
  getReports(filters?: ReportFilters): Promise<Report[]>
  resolveReport(reportId: string, request: ResolveReportRequest): Promise<void>
  getUserReputation(userId: string): Promise<UserReputation>
  setUserReputation(userId: string, score: number): Promise<void>
  getContentFilters(): Promise<ContentFilter[]>
  addContentFilter(filter: CreateContentFilterRequest): Promise<ContentFilter>
  removeContentFilter(filterId: string): Promise<void>
}

interface QuotaManager {
  checkQuota(): Promise<QuotaStatus>
  getQuotaStats(): Promise<QuotaStats>
  getUploadSizeLimit?(throwOnError?: boolean): Promise<number>
  getUploadFileSizeLimit?(throwOnError?: boolean): Promise<number>
  getUserStorageUsage?(throwOnError?: boolean): Promise<{ size: number; ntFiles: number } | null>
  hasStorageSpace?(requiredBytes: number): Promise<boolean>
  getQuotaAlerts(): Promise<QuotaAlert[]>
  getQuotaConfigs(): Promise<QuotaConfig[]>
  setUserQuota(userId: string, quota: number): Promise<void>
  getServerQuota(): Promise<ServerQuota>
}

const ModerationEvent = {
  ReportCreated: 'Moderation.report.created',
  ReportResolved: 'Moderation.report.resolved',
  UserReputationChanged: 'Moderation.reputation.changed',
  ContentFilterAdded: 'Moderation.filter.added',
  ContentFilterRemoved: 'Moderation.filter.removed',
  Error: 'Moderation.error'
} as const

class AdminFacadeService extends BaseMatrixService {
  private adminVerifiedAt = 0
  private readonly ADMIN_VERIFY_INTERVAL = 2 * 60 * 1000
  private cachedAdminStatus = false

  private moderationManager: ModerationManager | null = null
  private observedClient: ReturnType<typeof this.getClient> | null = null
  private managerStarted = false
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

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

  async checkAdminApiAvailability(): Promise<boolean> {
    try {
      await this.adminRequest('GET', '/whoami')
      return true
    } catch {
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
        warn('[Admin] 服务端权限验证: 缺少 userId 或 accessToken')
        return false
      }

      const now = Date.now()
      if (now - this.adminVerifiedAt < this.ADMIN_VERIFY_INTERVAL) {
        return this.cachedAdminStatus
      }

      const result = await invokeWithResult<{ is_admin: boolean; user_id: string }>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken,
        homeserverUrl: client.getHomeserverUrl()
      })

      if (result.isErr()) {
        error(`[Admin] 服务端权限验证异常: ${result.error}`)
        return false
      }

      this.cachedAdminStatus = result.value.is_admin
      this.adminVerifiedAt = now

      if (!result.value.is_admin) {
        warn(`[Admin] 服务端权限验证失败: userId=${result.value.user_id}, isAdmin=false`)
      }

      return result.value.is_admin
    } catch (err) {
      error(`[Admin] 服务端权限验证异常: ${err}`)
      return false
    }
  }

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

  private get quotaManager(): QuotaManager {
    const client = this.getClient()
    const manager =
      typeof client.getMediaQuotaManager === 'function'
        ? (client.getMediaQuotaManager() as QuotaManager)
        : ((client as unknown as { quotaManager?: QuotaManager }).quotaManager as QuotaManager | undefined)
    if (!manager) {
      throw new Error('[Admin] QuotaManager 未初始化')
    }
    return manager
  }

  private async ensureModerationManager(throwOnMissing = true): Promise<ModerationManager | null> {
    const client = this.getClient()
    const manager = (client as unknown as { moderationManager?: ModerationManager }).moderationManager ?? null
    if (!manager) {
      if (throwOnMissing) {
        throw new Error('[Admin] ModerationManager 未初始化')
      }
      return null
    }

    if (this.observedClient !== client || this.moderationManager !== manager) {
      if (this.moderationManager && this.moderationManager !== manager) {
        this.moderationManager.stop()
        this.moderationManager.removeAllListeners()
      }

      this.observedClient = client
      this.moderationManager = manager
      this.managerStarted = false
      this.setupModerationEventListeners(manager)
    }

    if (!this.managerStarted) {
      await manager.start()
      this.managerStarted = true
    }

    return manager
  }

  private setupModerationEventListeners(manager: ModerationManager): void {
    manager.removeAllListeners()

    manager.on(ModerationEvent.ReportCreated, (...args: unknown[]) => {
      const report = args[0] as Report
      this.emitModerationEvent('reportCreated', report)
      info(`[Admin] 新举报: ${report.id}`)
    })

    manager.on(ModerationEvent.ReportResolved, (...args: unknown[]) => {
      const report = args[0] as Report
      this.emitModerationEvent('reportResolved', report)
      info(`[Admin] 举报已处理: ${report.id}`)
    })

    manager.on(ModerationEvent.UserReputationChanged, (...args: unknown[]) => {
      const reputation = args[0] as UserReputation
      this.emitModerationEvent('reputationChanged', reputation)
      info(`[Admin] 用户信誉变更: ${reputation.userId}`)
    })

    manager.on(ModerationEvent.ContentFilterAdded, (...args: unknown[]) => {
      const filter = args[0] as ContentFilter
      this.emitModerationEvent('filterAdded', filter)
      info(`[Admin] 内容过滤器添加: ${filter.id}`)
    })

    manager.on(ModerationEvent.ContentFilterRemoved, (...args: unknown[]) => {
      const filterId = args[0] as string
      this.emitModerationEvent('filterRemoved', filterId)
      info(`[Admin] 内容过滤器移除: ${filterId}`)
    })

    manager.on(ModerationEvent.Error, (...args: unknown[]) => {
      const err = args[0] as Error
      this.emitModerationEvent('error', err)
      error(`[Admin] Moderation 错误: ${err.message}`)
    })
  }

  private emitModerationEvent(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  onModerationEvent(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  offModerationEvent(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  stopModeration(): void {
    if (this.moderationManager) {
      this.moderationManager.stop()
      this.moderationManager.removeAllListeners()
      this.moderationManager = null
    }
    this.observedClient = null
    this.managerStarted = false
    this.eventListeners.clear()
    info('[Admin] Moderation 已停止')
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

  // ==================== Federation Blacklist ====================

  private toBlacklistEntry(value: unknown): FederationBlacklistEntry | null {
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    const domain =
      typeof record.domain === 'string'
        ? record.domain
        : typeof record.server_name === 'string'
          ? record.server_name
          : null
    if (!domain) return null
    return {
      domain,
      reason: typeof record.reason === 'string' ? record.reason : undefined,
      addedBy: typeof record.added_by === 'string' ? record.added_by : undefined,
      addedAt: typeof record.added_at === 'number' ? record.added_at : undefined
    }
  }

  private async adminRequest<TResponse>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<TResponse> {
    const client = this.getClient()
    return client.http.authedRequest(
      method,
      `${MATRIX_PATHS.ADMIN.SYNAPSE_ADMIN_BASE}${path}`,
      undefined,
      method === 'GET' || method === 'DELETE' ? undefined : body
    ) as Promise<TResponse>
  }

  async getFederationBlacklist(): Promise<FederationBlacklistEntry[]> {
    try {
      const response = await this.adminRequest<{ blacklist?: unknown[]; servers?: unknown[] }>(
        'GET',
        '/federation/blacklist'
      )
      const items = Array.isArray(response.blacklist)
        ? response.blacklist
        : Array.isArray(response.servers)
          ? response.servers
          : []
      return items
        .map((item) => this.toBlacklistEntry(item))
        .filter((entry): entry is FederationBlacklistEntry => entry !== null)
    } catch (err) {
      error(`[Admin] 获取联邦黑名单失败: ${err}`)
      return []
    }
  }

  async addToFederationBlacklist(domain: string, reason?: string): Promise<boolean> {
    try {
      await this.adminRequest('POST', `/federation/blacklist/${encodeURIComponent(domain)}`, { reason })
      info(`[Admin] 添加联邦黑名单成功: ${domain}`)
      return true
    } catch (err) {
      error(`[Admin] 添加联邦黑名单失败: ${err}`)
      return false
    }
  }

  async removeFromFederationBlacklist(domain: string): Promise<boolean> {
    try {
      await this.adminRequest('DELETE', `/federation/blacklist/${encodeURIComponent(domain)}`)
      info(`[Admin] 删除联邦黑名单成功: ${domain}`)
      return true
    } catch (err) {
      error(`[Admin] 删除联邦黑名单失败: ${err}`)
      return false
    }
  }

  async getFederationStatus(): Promise<Record<string, unknown>> {
    try {
      const response = await this.adminRequest<Record<string, unknown>>('GET', '/federation/status')
      info('[Admin] 获取联邦状态成功')
      return response
    } catch (err) {
      error(`[Admin] 获取联邦状态失败: ${err}`)
      return {}
    }
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
    const client = this.getClient()
    const { roomId, eventId, reason, explanation } = request
    try {
      await client.reportEvent(roomId, eventId, reason, explanation || '')
      info(`[Admin] 举报成功: ${roomId}/${eventId}`)
    } catch (err) {
      error(`[Admin] 举报失败: ${err}`)
      throw err
    }
  }

  async reportUser(userId: string, reason: string, explanation?: string): Promise<void> {
    const client = this.getClient()
    try {
      const rooms = client.getRooms()
      for (const room of rooms) {
        if (room.timeline.length > 0) {
          for (const event of room.timeline) {
            const content = event.getContent()
            if (content && (event as unknown as { sender?: string }).sender === userId) {
              const eventId = (event as unknown as { event_id?: string }).event_id
              const roomId = (room as unknown as { roomId?: string }).roomId
              if (eventId && roomId) {
                await this.reportEvent({ roomId, eventId, reason, explanation })
                info(`[Admin] 举报用户成功: ${userId}`)
                return
              }
            }
          }
        }
      }
      info(`[Admin] 未找到用户 ${userId} 的可举报事件`)
    } catch (err) {
      error(`[Admin] 举报用户失败: ${err}`)
      throw err
    }
  }

  async reportRoom(roomId: string, reason: string, description?: string): Promise<ReportRoomResponse | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'POST',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/report`,
        undefined,
        { reason, description }
      )) as ReportRoomResponse
      info(`[Admin] 举报房间成功: ${roomId}, report_id=${result.report_id}`)
      return result
    } catch (err) {
      error(`[Admin] v3 举报房间失败，回退到事件举报: ${err}`)
      try {
        const room = client.getRoom(roomId)
        if (room && room.timeline.length > 0) {
          const event = room.timeline[0]
          await this.reportEvent({
            roomId,
            eventId: event.getId() || '',
            reason,
            explanation: description
          })
          return { report_id: '' }
        }
      } catch (fallbackErr) {
        error(`[Admin] 回退举报房间也失败: ${fallbackErr}`)
      }
      throw err
    }
  }

  async scoreReport(roomId: string, eventId: string, score: number): Promise<void> {
    const client = this.getClient()
    if (score < -100 || score > 0) {
      throw new Error('[Admin] 评分必须在 -100 到 0 之间')
    }
    try {
      await client.http.authedRequest(
        'PUT',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/score`,
        undefined,
        { score }
      )
      info(`[Admin] 举报评分成功: ${roomId}/${eventId}, score=${score}`)
    } catch (err) {
      error(`[Admin] 举报评分失败: ${err}`)
      throw err
    }
  }

  async getScannerInfo(roomId: string, eventId: string): Promise<ScannerInfo | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.ROOM.REPORT_SCANNER_INFO(roomId, eventId)
      )) as ScannerInfo
      return result
    } catch (err) {
      error(`[Admin] 获取扫描器信息失败: ${err}`)
      return null
    }
  }

  async getAdminReports(
    roomId?: string,
    limit: number = 50,
    from?: string
  ): Promise<{ reports: AdminReport[]; next_batch?: string }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = { limit: String(limit) }
      if (roomId) queryParams.room_id = roomId
      if (from) queryParams.from = from
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ADMIN.REPORTS, queryParams)
      return {
        reports: (result as { reports?: AdminReport[] }).reports ?? [],
        next_batch: (result as { next_batch?: string }).next_batch
      }
    } catch (err) {
      error(`[Admin] 获取管理端报表失败: ${err}`)
      return { reports: [] }
    }
  }

  async getAdminReport(reportId: string): Promise<AdminReport | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ADMIN.REPORT_BY_ID(reportId))
      return result as AdminReport
    } catch (err) {
      error(`[Admin] 获取报表详情失败: ${err}`)
      return null
    }
  }

  async dismissReport(reportId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('DELETE', MATRIX_PATHS.ADMIN.REPORT_BY_ID(reportId))
      info(`[Admin] 驳回报表成功: ${reportId}`)
      return true
    } catch (err) {
      error(`[Admin] 驳回报表失败: ${err}`)
      return false
    }
  }

  // ==================== Moderation ====================

  async getModerationReports(filters?: ReportFilters): Promise<Report[]> {
    const manager = (await this.ensureModerationManager())!
    try {
      const reports = await manager.getReports(filters)
      info(`[Admin] 获取举报列表: ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[Admin] 获取举报列表失败: ${err}`)
      throw err
    }
  }

  async resolveModerationReport(reportId: string, request: ResolveReportRequest): Promise<void> {
    const manager = (await this.ensureModerationManager())!
    try {
      await manager.resolveReport(reportId, request)
      info(`[Admin] 处理举报成功: ${reportId} -> ${request.action}`)
    } catch (err) {
      error(`[Admin] 处理举报失败: ${err}`)
      throw err
    }
  }

  async getUserReputation(userId: string): Promise<UserReputation> {
    const manager = (await this.ensureModerationManager())!
    try {
      const reputation = await manager.getUserReputation(userId)
      info(`[Admin] 获取用户信誉: ${userId} -> ${reputation.level}`)
      return reputation
    } catch (err) {
      error(`[Admin] 获取用户信誉失败: ${err}`)
      throw err
    }
  }

  async setUserReputation(userId: string, score: number): Promise<void> {
    const manager = (await this.ensureModerationManager())!
    try {
      await manager.setUserReputation(userId, score)
      info(`[Admin] 设置用户信誉: ${userId} -> ${score}`)
    } catch (err) {
      error(`[Admin] 设置用户信誉失败: ${err}`)
      throw err
    }
  }

  async getContentFilters(): Promise<ContentFilter[]> {
    const manager = (await this.ensureModerationManager())!
    try {
      const filters = await manager.getContentFilters()
      info(`[Admin] 获取内容过滤器: ${filters.length} 条`)
      return filters
    } catch (err) {
      error(`[Admin] 获取内容过滤器失败: ${err}`)
      throw err
    }
  }

  async addContentFilter(filter: CreateContentFilterRequest): Promise<ContentFilter> {
    const manager = (await this.ensureModerationManager())!
    try {
      const result = await manager.addContentFilter(filter)
      info(`[Admin] 添加内容过滤器: ${result.id}`)
      return result
    } catch (err) {
      error(`[Admin] 添加内容过滤器失败: ${err}`)
      throw err
    }
  }

  async removeContentFilter(filterId: string): Promise<void> {
    const manager = (await this.ensureModerationManager())!
    try {
      await manager.removeContentFilter(filterId)
      info(`[Admin] 移除内容过滤器: ${filterId}`)
    } catch (err) {
      error(`[Admin] 移除内容过滤器失败: ${err}`)
      throw err
    }
  }

  // ==================== Quota ====================

  async checkQuota(): Promise<QuotaStatus> {
    try {
      const status = await this.quotaManager.checkQuota()
      info('[Admin] 配额检查完成')
      return status
    } catch (err) {
      error(`[Admin] 配额检查失败: ${err}`)
      throw err
    }
  }

  async getQuotaStats(): Promise<QuotaStats> {
    try {
      const stats = await this.quotaManager.getQuotaStats()
      info('[Admin] 获取配额统计成功')
      return stats
    } catch (err) {
      error(`[Admin] 获取配额统计失败: ${err}`)
      throw err
    }
  }

  async getQuotaAlerts(): Promise<QuotaAlert[]> {
    try {
      const alerts = await this.quotaManager.getQuotaAlerts()
      info(`[Admin] 获取配额告警成功: ${alerts.length} 条`)
      return alerts
    } catch (err) {
      error(`[Admin] 获取配额告警失败: ${err}`)
      throw err
    }
  }

  async getQuotaConfigs(): Promise<QuotaConfig[]> {
    try {
      const configs = await this.quotaManager.getQuotaConfigs()
      info('[Admin] 获取配额配置成功')
      return configs
    } catch (err) {
      error(`[Admin] 获取配额配置失败: ${err}`)
      throw err
    }
  }

  async setUserQuota(userId: string, quota: number): Promise<void> {
    try {
      await this.quotaManager.setUserQuota(userId, quota)
      info(`[Admin] 设置用户配额成功: ${userId} -> ${quota}`)
    } catch (err) {
      error(`[Admin] 设置用户配额失败: ${err}`)
      throw err
    }
  }

  async getServerQuota(): Promise<ServerQuota> {
    try {
      const serverQuota = await this.quotaManager.getServerQuota()
      info('[Admin] 获取服务器配额成功')
      return serverQuota
    } catch (err) {
      error(`[Admin] 获取服务器配额失败: ${err}`)
      throw err
    }
  }

  async getUploadSizeLimit(throwOnError = true): Promise<number> {
    try {
      if (!this.quotaManager.getUploadSizeLimit) {
        throw new Error('[Admin] getUploadSizeLimit 不可用')
      }
      const limit = await this.quotaManager.getUploadSizeLimit(throwOnError)
      info(`[Admin] 获取上传大小限制成功: ${limit}`)
      return limit
    } catch (err) {
      error(`[Admin] 获取上传大小限制失败: ${err}`)
      if (throwOnError) throw err
      return 10 * 1024 * 1024
    }
  }

  async getUploadFileSizeLimit(throwOnError = true): Promise<number> {
    try {
      if (!this.quotaManager.getUploadFileSizeLimit) {
        throw new Error('[Admin] getUploadFileSizeLimit 不可用')
      }
      const limit = await this.quotaManager.getUploadFileSizeLimit(throwOnError)
      info(`[Admin] 获取文件上传大小限制成功: ${limit}`)
      return limit
    } catch (err) {
      error(`[Admin] 获取文件上传大小限制失败: ${err}`)
      if (throwOnError) throw err
      return 10 * 1024 * 1024
    }
  }

  async getUserStorageUsage(throwOnError = true): Promise<{ size: number; ntFiles: number } | null> {
    try {
      if (!this.quotaManager.getUserStorageUsage) {
        throw new Error('[Admin] getUserStorageUsage 不可用')
      }
      const usage = await this.quotaManager.getUserStorageUsage(throwOnError)
      info(`[Admin] 获取用户存储使用量成功: ${usage?.size ?? 0}`)
      return usage
    } catch (err) {
      error(`[Admin] 获取用户存储使用量失败: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async hasStorageSpace(requiredBytes: number): Promise<boolean> {
    try {
      if (!this.quotaManager.hasStorageSpace) {
        throw new Error('[Admin] hasStorageSpace 不可用')
      }
      const result = await this.quotaManager.hasStorageSpace(requiredBytes)
      info(`[Admin] 检查存储空间成功: ${requiredBytes} -> ${result}`)
      return result
    } catch (err) {
      error(`[Admin] 检查存储空间失败: ${err}`)
      return true
    }
  }

  // ==================== Retention (client API) ====================

  async getRoomRetention(roomId: string): Promise<RoomRetention> {
    const client = this.getClient()
    try {
      const policy = await client.getRoomStateEvent(roomId, 'm.room.retention', '')
      return {
        roomId,
        policy: policy
          ? {
              min_lifetime: policy.min_lifetime as number | undefined,
              max_lifetime: policy.max_lifetime as number | undefined
            }
          : undefined
      }
    } catch (err) {
      error(`[Admin] 获取保留策略失败: ${err}`)
      return { roomId }
    }
  }

  async setRoomRetention(roomId: string, policy: RetentionPolicy): Promise<void> {
    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.retention', policy, '')
      info(`[Admin] 设置保留策略成功: ${roomId}`)
    } catch (err) {
      error(`[Admin] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  async deleteRoomRetention(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.redact(roomId, '')
      info(`[Admin] 删除保留策略成功: ${roomId}`)
    } catch (err) {
      error(`[Admin] 删除保留策略失败: ${err}`)
      throw err
    }
  }

  async getDefaultRetention(): Promise<RetentionPolicy | null> {
    const client = this.getClient()
    try {
      const config = await client.getServerRetention()
      return config || null
    } catch (err) {
      error(`[Admin] 获取默认保留策略失败: ${err}`)
      return null
    }
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

  async shadowBan(userId: string, ban = true): Promise<void> {
    return this.users.shadowBan(userId, ban)
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

  async getUsersV2(
    limit = 100,
    from?: string,
    name?: string,
    guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.users.getUsersV2(limit, from, name, guests)
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

  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    return this.security.setExperimentalFeature(feature, enabled)
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
