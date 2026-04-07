/**
 * 事件举报服务
 * 举报违规消息/事件
 */
import { matrixClientService } from './MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('EventReport')

export interface EventReport {
  reportId: number
  roomId: string
  eventId: string
  sender: string
  reason: string
  createdAt: number
  status: 'pending' | 'actioned' | 'ignored'
  userId?: string
  reasonCode?: string
}

export interface CreateReportParams {
  roomId: string
  eventId: string
  reason: string
  reasonCode?: string
}

class MatrixEventReportService {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 举报事件
   */
  async create(params: CreateReportParams): Promise<number | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'POST',
        `/_matrix/client/v1/rooms/${encodeURIComponent(params.roomId)}/report`,
        undefined,
        {
          body: JSON.stringify({
            event_id: params.eventId,
            reason: params.reason,
            reason_code: params.reasonCode
          })
        }
      )) as any
      return response.report_id
    } catch (error) {
      logger.error('举报失败:', error)
      return null
    }
  }

  /**
   * 获取举报详情
   */
  async get(reportId: number): Promise<EventReport | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/admin/1.0/room_event_reports/${reportId}`,
        undefined
      )) as any
      return this.mapReport(response)
    } catch (error) {
      logger.error('获取详情失败:', error)
      return null
    }
  }

  /**
   * 获取房间举报列表
   */
  async listByRoom(roomId: string, limit = 100, from?: number): Promise<EventReport[]> {
    try {
      let path = `/_matrix/client/v1/admin/room_event_reports?room_id=${encodeURIComponent(roomId)}&limit=${limit}`
      if (from) path += `&from=${from}`

      const response = (await this.client.http.authedRequest({}, 'GET', path, undefined)) as any

      return (response.event_reports || []).map(this.mapReport)
    } catch (error) {
      logger.error('获取房间举报失败:', error)
      return []
    }
  }

  /**
   * 获取用户举报列表
   */
  async listByUser(userId: string, limit = 100): Promise<EventReport[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v1/admin/user_event_reports?user_id=${encodeURIComponent(userId)}&limit=${limit}`,
        undefined
      )) as any

      return (response.event_reports || []).map(this.mapReport)
    } catch (error) {
      logger.error('获取用户举报失败:', error)
      return []
    }
  }

  /**
   * 处理举报 (管理员)
   */
  async resolve(reportId: number, action: 'actioned' | 'ignored'): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'PUT', `/admin/1.0/room_event_reports/${reportId}`, undefined, {
        body: JSON.stringify({ status: action })
      })
      return true
    } catch (error) {
      logger.error('处理失败:', error)
      return false
    }
  }

  private mapReport(data: any): EventReport {
    return {
      reportId: data.report_id,
      roomId: data.room_id,
      eventId: data.event_id,
      sender: data.sender,
      reason: data.reason,
      createdAt: data.created_ts,
      status: data.status || 'pending',
      userId: data.user_id,
      reasonCode: data.reason_code
    }
  }
}

export const matrixEventReportService = new MatrixEventReportService()
