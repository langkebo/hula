import { DEFAULT_PAGE_LIMIT } from '@/common/constants'
import { AdminFacadeDomainMethods } from './AdminFacadeDomainMethods'
import type { AdminModerationService } from './AdminModerationService'
import type { AdminServerNotificationService } from './AdminServerNotificationService'
import type {
  AdminReport,
  ContentFilter,
  CreateContentFilterRequest,
  QuotaAlert,
  QuotaStats,
  QuotaStatus,
  Report,
  ReportFilters,
  ReportRequest,
  ReportRoomResponse,
  ResolveReportRequest,
  RetentionPolicy,
  RoomRetention,
  ScannerInfo,
  ServerNoticeInfo,
  ServerNoticeResult,
  ServerQuota,
  UserReputation
} from './AdminTypes'
import type { AdminQuotaService } from './QuotaService'
import type { AdminReportService } from './ReportService'

/**
 * AdminFacadeService 的通知 / 举报 / 审核 / 配额 / 保留策略方法片段。
 *
 * 从 `AdminFacadeService` 抽离：这些方法是对 admin 子服务的薄委托，
 * 单独成混入类可把门面文件控制在 400 行门槛以内。
 * 子类（AdminFacadeService）提供各子服务字段。
 */
export abstract class AdminFacadeTrustSafetyMethods extends AdminFacadeDomainMethods {
  abstract readonly serverNotifications: AdminServerNotificationService
  abstract readonly reports: AdminReportService
  abstract readonly moderation: AdminModerationService
  abstract readonly quota: AdminQuotaService

  // ==================== Notification Management ====================

  async sendServerNotice(userId: string, content: Record<string, unknown>): Promise<ServerNoticeResult> {
    return this.serverNotifications.sendServerNotice(userId, content)
  }

  async getServerNotices(limit = DEFAULT_PAGE_LIMIT): Promise<{ notices: ServerNoticeInfo[] } | null> {
    return this.serverNotifications.getServerNotices(limit)
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

  async getScannerInfo(roomId: string, eventId: string): Promise<ScannerInfo | null> {
    return this.reports.getScannerInfo(roomId, eventId)
  }

  /** 屏蔽被举报用户（SDK 侧 `blockUser`，按 `blockedUntil` 到期自动解除）；返回是否生效 */
  async blockReportUser(userId: string, options: { blockedUntil: number; reason: string }): Promise<boolean> {
    return this.reports.blockReportUser(userId, options)
  }

  /** 解除对举报用户的屏蔽（SDK 侧 `unblockUser`）；返回是否生效 */
  async unblockReportUser(userId: string): Promise<boolean> {
    return this.reports.unblockReportUser(userId)
  }

  async getAdminReports(
    roomId?: string,
    limit: number = 50,
    from?: string
  ): Promise<{ reports: AdminReport[]; next_batch?: string | undefined }> {
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

  async getServerQuota(): Promise<ServerQuota> {
    return this.quota.getServerQuota()
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
}
