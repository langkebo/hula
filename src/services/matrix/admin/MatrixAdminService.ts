import { matrixFederationBlacklistService } from './MatrixFederationBlacklistService'
import type { ReportFilters, ResolveReportRequest } from './MatrixModerationService'
import { matrixModerationService } from './MatrixModerationService'
import { MatrixQuotaService } from './MatrixQuotaService'
import type { ReportRequest } from './MatrixReportService'
import { reportService } from './MatrixReportService'

const quotaService = new MatrixQuotaService()

/**
 * 管理与合规聚合服务
 * 整合了举报、审计、权限、配额、联邦管理等功能
 */
class MatrixAdminService {
  /**
   * 举报事件
   */
  reportEvent(request: ReportRequest) {
    return reportService.reportEvent(request)
  }

  /**
   * 举报用户
   */
  reportUser(userId: string, reason: string, explanation?: string) {
    return reportService.reportUser(userId, reason, explanation)
  }

  /**
   * 举报房间
   */
  reportRoom(roomId: string, reason: string, explanation?: string) {
    return reportService.reportRoom(roomId, reason, explanation)
  }

  /**
   * 获取管理端举报列表
   */
  getAdminReports(roomId?: string, limit?: number, from?: string) {
    return reportService.getAdminReports(roomId, limit, from)
  }

  /**
   * 获取管理端举报详情
   */
  getAdminReport(reportId: string) {
    return reportService.getAdminReport(reportId)
  }

  /**
   * 驳回举报
   */
  dismissReport(reportId: string) {
    return reportService.dismissReport(reportId)
  }

  /**
   * 获取举报列表 (Moderation)
   */
  getModerationReports(filters?: ReportFilters) {
    return matrixModerationService.getReports(filters)
  }

  /**
   * 处理举报 (Moderation)
   */
  resolveModerationReport(reportId: string, request: ResolveReportRequest) {
    return matrixModerationService.resolveReport(reportId, request)
  }

  /**
   * 获取用户信誉 (Moderation)
   */
  getUserReputation(userId: string) {
    return matrixModerationService.getUserReputation(userId)
  }

  /**
   * 检查配额 (Quota)
   */
  checkQuota() {
    return quotaService.checkQuota()
  }

  /**
   * 获取配额统计 (Quota)
   */
  getQuotaStats() {
    return quotaService.getQuotaStats()
  }

  /**
   * 获取联邦黑名单
   */
  getFederationBlacklist() {
    return matrixFederationBlacklistService.list()
  }

  /**
   * 添加到联邦黑名单
   */
  addToFederationBlacklist(domain: string, reason?: string) {
    return matrixFederationBlacklistService.add({ domain, reason })
  }

  /**
   * 从联邦黑名单移除
   */
  removeFromFederationBlacklist(domain: string) {
    return matrixFederationBlacklistService.remove(domain)
  }
}

export const matrixAdminService = new MatrixAdminService()
