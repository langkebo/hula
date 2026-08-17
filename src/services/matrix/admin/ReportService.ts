import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { AdminReport, ReportRequest, ReportRoomResponse, ScannerInfo } from './AdminTypes'

const logger = createLogger('ReportService')

type ReportDomainSdkGetter = () => Promise<AdminManager>
type ReportDomainClientGetter = () => MatrixClient

/**
 * ReportingManager 实例类型。
 *
 * 注：`matrix-js-sdk/reporting` 子路径未在 package.json exports 中暴露，
 * 这里通过 MatrixClient 的访问器返回类型派生，避免违反 SDK 边界策略。
 */
type ReportingManagerInstance = ReturnType<NonNullable<MatrixClient['getReportingManager']>>

export class AdminReportService {
  constructor(
    readonly _sdkAdmin: ReportDomainSdkGetter,
    private readonly getClient: ReportDomainClientGetter
  ) {}

  async reportEvent(request: ReportRequest): Promise<void> {
    const { roomId, eventId, reason, explanation } = request
    try {
      const fullReason = explanation ? `${reason}: ${explanation}` : reason
      // score: -100~0, 前端无 score 概念, 用 -50 中性值
      await this.getReportingMgr().reportEvent(roomId, eventId, -50, fullReason)
      logger.info(`[Admin] 举报成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`[Admin] 举报失败: ${err}`)
      throw err
    }
  }

  private getReportingMgr(): ReportingManagerInstance {
    const client = this.getClient()
    const fn = (client as unknown as { getReportingManager?: () => ReportingManagerInstance }).getReportingManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getReportingManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  async reportUser(userId: string, reason: string, explanation?: string): Promise<void> {
    const client = this.getClient()
    try {
      const rooms = client.getRooms()
      for (const room of rooms) {
        if (room.timeline.length > 0) {
          for (const event of room.timeline) {
            const content = event.getContent()
            if (content && event.getSender() === userId) {
              const eventId = event.getId()
              const roomId = room.roomId
              if (eventId && roomId) {
                await this.reportEvent({ roomId, eventId, reason, explanation })
                logger.info(`[Admin] 举报用户成功: ${userId}`)
                return
              }
            }
          }
        }
      }
      logger.info(`[Admin] 未找到用户 ${userId} 的可举报事件`)
    } catch (err) {
      logger.error(`[Admin] 举报用户失败: ${err}`)
      throw err
    }
  }

  async reportRoom(roomId: string, reason: string, description?: string): Promise<ReportRoomResponse | null> {
    const client = this.getClient()
    try {
      const result = await this.getReportingMgr().reportRoom(roomId, reason, description)
      logger.info(`[Admin] 举报房间成功: ${roomId}, report_id=${result.report_id}`)
      return { report_id: result.report_id }
    } catch (err) {
      logger.error(`[Admin] v3 举报房间失败，回退到事件举报: ${err}`)
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
        logger.error(`[Admin] 回退举报房间也失败: ${fallbackErr}`)
      }
      throw err
    }
  }

  async scoreReport(roomId: string, eventId: string, score: number): Promise<void> {
    if (score < -100 || score > 0) {
      throw new Error('matrix_error.admin.score_range_invalid')
    }
    try {
      await this.getReportingMgr().scoreReport(roomId, eventId, score)
      logger.info(`[Admin] 举报评分成功: ${roomId}/${eventId}, score=${score}`)
    } catch (err) {
      logger.error(`[Admin] 举报评分失败: ${err}`)
      throw err
    }
  }

  async getScannerInfo(roomId: string, eventId: string, throwOnError = false): Promise<ScannerInfo | null> {
    try {
      const result = await this.getReportingMgr().getScannerInfo(roomId, eventId)
      return result as unknown as ScannerInfo
    } catch (err) {
      logger.error(`[Admin] 获取扫描器信息失败: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getAdminReports(
    roomId?: string,
    limit: number = 50,
    from?: string,
    throwOnError = false
  ): Promise<{ reports: AdminReport[]; next_batch?: string }> {
    try {
      const admin = await this._sdkAdmin()
      const result = roomId
        ? await admin.listRoomReports(roomId, { from, limit })
        : await admin.listReports({ from, limit })
      return {
        reports: ((result as unknown as { reports?: AdminReport[] }).reports ?? []) as AdminReport[],
        next_batch: (result as unknown as { next_batch?: string }).next_batch
      }
    } catch (err) {
      logger.error(`[Admin] 获取管理端报表失败: ${err}`)
      if (throwOnError) throw err
      return { reports: [] }
    }
  }

  async getAdminReport(reportId: string, throwOnError = false): Promise<AdminReport | null> {
    try {
      const admin = await this._sdkAdmin()
      return (await admin.getReport(reportId)) as unknown as AdminReport
    } catch (err) {
      logger.error(`[Admin] 获取报表详情失败: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async dismissReport(reportId: string, throwOnError = false): Promise<boolean> {
    try {
      const admin = await this._sdkAdmin()
      await admin.deleteReport(reportId)
      logger.info(`[Admin] 驳回报表成功: ${reportId}`)
      return true
    } catch (err) {
      logger.error(`[Admin] 驳回报表失败: ${err}`)
      if (throwOnError) throw err
      return false
    }
  }
}
