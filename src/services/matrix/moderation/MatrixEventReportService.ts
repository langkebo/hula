import type { MatrixClient } from 'matrix-js-sdk'
import type {
  CreateReportBody,
  DismissReportBody,
  EscalateReportBody,
  EventReportCountResponse,
  EventReportManager,
  QueryParams,
  ReportResponse,
  ResolveReportBody,
  StatsResponse,
  StatusCountResponse,
  UpdateReportBody
} from 'matrix-js-sdk/event-report'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixEventReportService')

type EventReportManagerCompat = EventReportManager

class MatrixEventReportService extends BaseMatrixService {
  private eventReportManager: EventReportManagerCompat | null = null
  private observedClient: MatrixClient | null = null

  private getEventReportManager(client: MatrixClient): EventReportManagerCompat | null {
    const clientWithMethods = client as MatrixClient & Record<string, unknown>
    if (typeof clientWithMethods.getEventReportManager === 'function') {
      try {
        const manager = clientWithMethods.getEventReportManager()
        if (manager && typeof (manager as EventReportManager).createReport === 'function') {
          return manager as EventReportManagerCompat
        }
      } catch (err) {
        // FT-131-C: 记录 getEventReportManager 工厂异常，避免静默吞错导致 manager 不可用原因无法排查
        logger.warn(`[MatrixEventReport] getEventReportManager() 工厂抛出异常: ${err}`)
      }
    }
    return null
  }

  private syncEventReportManager(): EventReportManagerCompat | null {
    const client = this.getClient()
    const manager = this.getEventReportManager(client)

    if (this.observedClient !== client || this.eventReportManager !== manager) {
      this.eventReportManager = manager
      this.observedClient = client
    }

    return manager
  }

  private async requireEventReportManager(): Promise<EventReportManagerCompat> {
    const manager = this.syncEventReportManager()
    if (!manager) {
      throw new Error(this.t('matrix_error.event_report.manager_not_initialized'))
    }
    return manager
  }

  /**
   * 创建一条事件举报。
   *
   * 返回后端生成的举报记录，供后续查询与处理。
   */
  async createReport(body: CreateReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.createReport(body)
      logger.info(`[MatrixEventReport] 创建举报成功: id=${result.id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 创建举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 查询举报列表，支持分页等查询参数。
   */
  async listReports(params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.listReports(params)
      logger.info(`[MatrixEventReport] 获取举报列表成功: ${reports.length} 条`)
      return reports
    } catch (err) {
      logger.error(`[MatrixEventReport] 获取举报列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取全部举报，不受分页限制。
   */
  async getAllReports(params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getAllReports(params)
      logger.info(`[MatrixEventReport] 获取全部举报成功: ${reports.length} 条`)
      return reports
    } catch (err) {
      logger.error(`[MatrixEventReport] 获取全部举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取举报总条数。
   */
  async getReportsCount(): Promise<EventReportCountResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.getReportsCount()
      logger.info(`[MatrixEventReport] 获取举报总数成功: ${result.total_reports}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 获取举报总数失败: ${err}`)
      throw err
    }
  }

  /**
   * 按 id 获取单条举报详情。
   */
  async getReport(id: number): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.getReport(id)
      logger.info(`[MatrixEventReport] 获取举报详情成功: id=${id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 获取举报详情失败: ${err}`)
      throw err
    }
  }

  /**
   * 按事件 id 查询相关举报。
   */
  async getReportsByEvent(eventId: string): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByEvent(eventId)
      logger.info(`[MatrixEventReport] 按事件查询举报成功: eventId=${eventId}, ${reports.length} 条`)
      return reports
    } catch (err) {
      logger.error(`[MatrixEventReport] 按事件查询举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 按房间 id 查询举报。
   */
  async getReportsByRoom(roomId: string, params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByRoom(roomId, params)
      logger.info(`[MatrixEventReport] 按房间查询举报成功: roomId=${roomId}, ${reports.length} 条`)
      return reports
    } catch (err) {
      logger.error(`[MatrixEventReport] 按房间查询举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 按举报人查询其提交的举报。
   */
  async getReportsByReporter(reporterUserId: string, params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByReporter(reporterUserId, params)
      logger.info(`[MatrixEventReport] 按举报人查询举报成功: reporterUserId=${reporterUserId}, ${reports.length} 条`)
      return reports
    } catch (err) {
      logger.error(`[MatrixEventReport] 按举报人查询举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 按处理状态查询举报。
   */
  async getReportsByStatus(status: ReportResponse['status'], params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByStatus(status, params)
      logger.info(`[MatrixEventReport] 按状态查询举报成功: status=${status}, ${reports.length} 条`)
      return reports
    } catch (err) {
      logger.error(`[MatrixEventReport] 按状态查询举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取指定状态的举报计数。
   */
  async getStatusCount(status: ReportResponse['status']): Promise<StatusCountResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.getStatusCount(status)
      logger.info(`[MatrixEventReport] 获取状态计数成功: status=${status}, count=${result.count}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 获取状态计数失败: ${err}`)
      throw err
    }
  }

  /**
   * 更新举报内容。
   */
  async updateReport(id: number, body: UpdateReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.updateReport(id, body)
      logger.info(`[MatrixEventReport] 更新举报成功: id=${id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 更新举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 将举报标记为已解决。
   */
  async resolveReport(id: number, body: ResolveReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.resolveReport(id, body)
      logger.info(`[MatrixEventReport] 解决举报成功: id=${id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 解决举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 驳回举报。
   */
  async dismissReport(id: number, body: DismissReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.dismissReport(id, body)
      logger.info(`[MatrixEventReport] 驳回举报成功: id=${id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 驳回举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 升级举报，上报至更高处理层级。
   */
  async escalateReport(id: number, body?: EscalateReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.escalateReport(id, body)
      logger.info(`[MatrixEventReport] 升级举报成功: id=${id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 升级举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除举报。
   */
  async deleteReport(id: number): Promise<void> {
    try {
      const manager = await this.requireEventReportManager()
      await manager.deleteReport(id)
      logger.info(`[MatrixEventReport] 删除举报成功: id=${id}`)
    } catch (err) {
      logger.error(`[MatrixEventReport] 删除举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取举报统计概览。
   */
  async getStats(): Promise<StatsResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const stats = await manager.getStats()
      logger.info(`[MatrixEventReport] 获取举报统计成功: total=${stats.total}`)
      return stats
    } catch (err) {
      logger.error(`[MatrixEventReport] 获取举报统计失败: ${err}`)
      throw err
    }
  }

  async checkRateLimit(
    userId: string
  ): Promise<{ is_allowed: boolean; remaining_reports: number; block_reason?: string }> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.checkRateLimit(userId)
      logger.info(`[MatrixEventReport] 检查频率限制成功: userId=${userId}, is_allowed=${result.is_allowed}`)
      return result
    } catch (err) {
      logger.error(`[MatrixEventReport] 检查频率限制失败: ${err}`)
      throw err
    }
  }

  /**
   * 封禁用户在指定时间点前的举报权限。
   *
   * `blockedUntil` 为封禁截止时间戳，`reason` 记录封禁原因。
   */
  async blockUser(userId: string, blockedUntil: number, reason: string): Promise<void> {
    try {
      const manager = await this.requireEventReportManager()
      await manager.blockUser(userId, blockedUntil, reason)
      logger.info(`[MatrixEventReport] 封禁用户举报频率成功: userId=${userId}`)
    } catch (err) {
      logger.error(`[MatrixEventReport] 封禁用户举报频率失败: ${err}`)
      throw err
    }
  }

  /**
   * 解除对用户举报频率的封禁。
   */
  async unblockUser(userId: string): Promise<void> {
    try {
      const manager = await this.requireEventReportManager()
      await manager.unblockUser(userId)
      logger.info(`[MatrixEventReport] 解封用户举报频率成功: userId=${userId}`)
    } catch (err) {
      logger.error(`[MatrixEventReport] 解封用户举报频率失败: ${err}`)
      throw err
    }
  }

  /**
   * 停止服务并清空缓存的 manager 与 client 引用。
   */
  stop(): void {
    this.eventReportManager = null
    this.observedClient = null
    logger.info('[MatrixEventReport] EventReportService 已停止')
  }
}

export const matrixEventReportService = new MatrixEventReportService()
