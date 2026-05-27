import { error, info } from '@tauri-apps/plugin-log'
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
import { BaseMatrixService } from '../BaseMatrixService'

type EventReportManagerCompat = EventReportManager

class MatrixEventReportService extends BaseMatrixService {
  private eventReportManager: EventReportManagerCompat | null = null
  private observedClient: MatrixClient | null = null

  private getEventReportManager(client: MatrixClient): EventReportManagerCompat | null {
    const clientWithMethods = client as unknown as Record<string, unknown>
    if (typeof clientWithMethods.getEventReportManager === 'function') {
      try {
        const manager = clientWithMethods.getEventReportManager()
        if (manager && typeof (manager as EventReportManager).createReport === 'function') {
          return manager as EventReportManagerCompat
        }
      } catch {
        // getEventReportManager() 可能抛出异常
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

  async createReport(body: CreateReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.createReport(body)
      info(`[MatrixEventReport] 创建举报成功: id=${result.id}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 创建举报失败: ${err}`)
      throw err
    }
  }

  async listReports(params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.listReports(params)
      info(`[MatrixEventReport] 获取举报列表成功: ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixEventReport] 获取举报列表失败: ${err}`)
      throw err
    }
  }

  async getAllReports(params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getAllReports(params)
      info(`[MatrixEventReport] 获取全部举报成功: ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixEventReport] 获取全部举报失败: ${err}`)
      throw err
    }
  }

  async getReportsCount(): Promise<EventReportCountResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.getReportsCount()
      info(`[MatrixEventReport] 获取举报总数成功: ${result.total_reports}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 获取举报总数失败: ${err}`)
      throw err
    }
  }

  async getReport(id: number): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.getReport(id)
      info(`[MatrixEventReport] 获取举报详情成功: id=${id}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 获取举报详情失败: ${err}`)
      throw err
    }
  }

  async getReportsByEvent(eventId: string): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByEvent(eventId)
      info(`[MatrixEventReport] 按事件查询举报成功: eventId=${eventId}, ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixEventReport] 按事件查询举报失败: ${err}`)
      throw err
    }
  }

  async getReportsByRoom(roomId: string, params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByRoom(roomId, params)
      info(`[MatrixEventReport] 按房间查询举报成功: roomId=${roomId}, ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixEventReport] 按房间查询举报失败: ${err}`)
      throw err
    }
  }

  async getReportsByReporter(reporterUserId: string, params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByReporter(reporterUserId, params)
      info(`[MatrixEventReport] 按举报人查询举报成功: reporterUserId=${reporterUserId}, ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixEventReport] 按举报人查询举报失败: ${err}`)
      throw err
    }
  }

  async getReportsByStatus(status: ReportResponse['status'], params?: QueryParams): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const reports = await manager.getReportsByStatus(status, params)
      info(`[MatrixEventReport] 按状态查询举报成功: status=${status}, ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixEventReport] 按状态查询举报失败: ${err}`)
      throw err
    }
  }

  async getStatusCount(status: ReportResponse['status']): Promise<StatusCountResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.getStatusCount(status)
      info(`[MatrixEventReport] 获取状态计数成功: status=${status}, count=${result.count}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 获取状态计数失败: ${err}`)
      throw err
    }
  }

  async updateReport(id: number, body: UpdateReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.updateReport(id, body)
      info(`[MatrixEventReport] 更新举报成功: id=${id}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 更新举报失败: ${err}`)
      throw err
    }
  }

  async resolveReport(id: number, body?: ResolveReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.resolveReport(id, body)
      info(`[MatrixEventReport] 解决举报成功: id=${id}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 解决举报失败: ${err}`)
      throw err
    }
  }

  async dismissReport(id: number, body?: DismissReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.dismissReport(id, body)
      info(`[MatrixEventReport] 驳回举报成功: id=${id}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 驳回举报失败: ${err}`)
      throw err
    }
  }

  async escalateReport(id: number, body?: EscalateReportBody): Promise<ReportResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.escalateReport(id, body)
      info(`[MatrixEventReport] 升级举报成功: id=${id}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 升级举报失败: ${err}`)
      throw err
    }
  }

  async deleteReport(id: number): Promise<void> {
    try {
      const manager = await this.requireEventReportManager()
      await manager.deleteReport(id)
      info(`[MatrixEventReport] 删除举报成功: id=${id}`)
    } catch (err) {
      error(`[MatrixEventReport] 删除举报失败: ${err}`)
      throw err
    }
  }

  async getReportHistory(id: number): Promise<ReportResponse[]> {
    try {
      const manager = await this.requireEventReportManager()
      const history = await manager.getReportHistory(id)
      info(`[MatrixEventReport] 获取举报历史成功: id=${id}, ${history.length} 条`)
      return history
    } catch (err) {
      error(`[MatrixEventReport] 获取举报历史失败: ${err}`)
      throw err
    }
  }

  async getStats(): Promise<StatsResponse> {
    try {
      const manager = await this.requireEventReportManager()
      const stats = await manager.getStats()
      info(`[MatrixEventReport] 获取举报统计成功: total=${stats.total}`)
      return stats
    } catch (err) {
      error(`[MatrixEventReport] 获取举报统计失败: ${err}`)
      throw err
    }
  }

  async checkRateLimit(
    userId: string
  ): Promise<{ is_allowed: boolean; remaining_reports: number; block_reason?: string }> {
    try {
      const manager = await this.requireEventReportManager()
      const result = await manager.checkRateLimit(userId)
      info(`[MatrixEventReport] 检查频率限制成功: userId=${userId}, is_allowed=${result.is_allowed}`)
      return result
    } catch (err) {
      error(`[MatrixEventReport] 检查频率限制失败: ${err}`)
      throw err
    }
  }

  async blockUser(userId: string, blockedUntil: number, reason: string): Promise<void> {
    try {
      const manager = await this.requireEventReportManager()
      await manager.blockUser(userId, blockedUntil, reason)
      info(`[MatrixEventReport] 封禁用户举报频率成功: userId=${userId}`)
    } catch (err) {
      error(`[MatrixEventReport] 封禁用户举报频率失败: ${err}`)
      throw err
    }
  }

  async unblockUser(userId: string): Promise<void> {
    try {
      const manager = await this.requireEventReportManager()
      await manager.unblockUser(userId)
      info(`[MatrixEventReport] 解封用户举报频率成功: userId=${userId}`)
    } catch (err) {
      error(`[MatrixEventReport] 解封用户举报频率失败: ${err}`)
      throw err
    }
  }

  stop(): void {
    this.eventReportManager = null
    this.observedClient = null
    info('[MatrixEventReport] EventReportService 已停止')
  }
}

export const matrixEventReportService = new MatrixEventReportService()
export default matrixEventReportService
