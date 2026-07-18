import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { stripMatrixPrefix } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import type { AdminReport, ReportRequest, ReportRoomResponse, ScannerInfo } from './AdminTypes'

const logger = createLogger('ReportService')

type ReportDomainSdkGetter = () => Promise<AdminManager>
type ReportDomainClientGetter = () => MatrixClient

export class AdminReportService {
  constructor(
    readonly _sdkAdmin: ReportDomainSdkGetter,
    private readonly getClient: ReportDomainClientGetter
  ) {}

  /**
   * 调用 authedRequest 前先用 stripMatrixPrefix 剥离已知前缀，
   * 避免 SDK 默认 ClientPrefix.V3 与路径中的前缀重复拼接。
   */
  private async prefixedAuthedRequest<T>(
    client: MatrixClient,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    fullPath: string,
    queryParams?: Record<string, string>,
    body?: Record<string, unknown>
  ): Promise<T> {
    const { path, prefix } = stripMatrixPrefix(fullPath)
    const opts = prefix ? { prefix } : undefined
    return (await client.http.authedRequest(method, path, queryParams, body, opts)) as T
  }

  async reportEvent(request: ReportRequest): Promise<void> {
    const client = this.getClient()
    const { roomId, eventId, reason, explanation } = request
    try {
      await client.reportEvent(roomId, eventId, reason, explanation || '')
      logger.info(`[Admin] 举报成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`[Admin] 举报失败: ${err}`)
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
      const result = (await client.http.authedRequest(
        'POST',
        `/rooms/${encodeURIComponent(roomId)}/report`,
        undefined,
        { reason, description }
      )) as ReportRoomResponse
      logger.info(`[Admin] 举报房间成功: ${roomId}, report_id=${result.report_id}`)
      return result
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
    const client = this.getClient()
    if (score < -100 || score > 0) {
      throw new Error('matrix_error.admin.score_range_invalid')
    }
    try {
      await client.http.authedRequest(
        'PUT',
        `/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/score`,
        undefined,
        { score }
      )
      logger.info(`[Admin] 举报评分成功: ${roomId}/${eventId}, score=${score}`)
    } catch (err) {
      logger.error(`[Admin] 举报评分失败: ${err}`)
      throw err
    }
  }

  async getScannerInfo(roomId: string, eventId: string): Promise<ScannerInfo | null> {
    const client = this.getClient()
    try {
      const result = await this.prefixedAuthedRequest<ScannerInfo>(
        client,
        'GET',
        MATRIX_PATHS.ROOM.REPORT_SCANNER_INFO(roomId, eventId)
      )
      return result
    } catch (err) {
      logger.error(`[Admin] 获取扫描器信息失败: ${err}`)
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
      const result = await this.prefixedAuthedRequest<{ reports?: AdminReport[]; next_batch?: string }>(
        client,
        'GET',
        MATRIX_PATHS.ADMIN.REPORTS,
        queryParams
      )
      return {
        reports: (result as { reports?: AdminReport[] }).reports ?? [],
        next_batch: (result as { next_batch?: string }).next_batch
      }
    } catch (err) {
      logger.error(`[Admin] 获取管理端报表失败: ${err}`)
      return { reports: [] }
    }
  }

  async getAdminReport(reportId: string): Promise<AdminReport | null> {
    const client = this.getClient()
    try {
      const result = await this.prefixedAuthedRequest<AdminReport>(
        client,
        'GET',
        MATRIX_PATHS.ADMIN.REPORT_BY_ID(reportId)
      )
      return result as AdminReport
    } catch (err) {
      logger.error(`[Admin] 获取报表详情失败: ${err}`)
      return null
    }
  }

  async dismissReport(reportId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await this.prefixedAuthedRequest<void>(client, 'DELETE', MATRIX_PATHS.ADMIN.REPORT_BY_ID(reportId))
      logger.info(`[Admin] 驳回报表成功: ${reportId}`)
      return true
    } catch (err) {
      logger.error(`[Admin] 驳回报表失败: ${err}`)
      return false
    }
  }
}
