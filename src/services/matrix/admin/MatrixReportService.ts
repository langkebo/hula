/**
 * Matrix 事件举报服务
 *
 * 提供内容举报功能
 */

import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { ref } from 'vue'
import { matrixClientService } from '../MatrixClientService'
import { MATRIX_PATHS } from '../paths'

/**
 * 举报原因
 */
export enum ReportReason {
  /** 色情内容 */
  Sexual = 'sexual',
  /** 暴力内容 */
  Violence = 'violence',
  /** 仇恨言论 */
  HateSpeech = 'hate_speech',
  /** 自杀自残 */
  SelfHarm = 'self_harm',
  /** 恐怖主义 */
  Terrorism = 'terrorism',
  /** 垃圾信息 */
  Spam = 'spam',
  /** 违规内容 */
  Violation = 'violation',
  /** 其他 */
  Other = 'other'
}

/**
 * 举报请求
 */
export interface ReportRequest {
  /** 房间 ID */
  roomId: string
  /** 事件 ID */
  eventId: string
  /** 原因 */
  reason: string
  /** 可选：详细说明 */
  explanation?: string
}

/**
 * 管理端举报条目
 */
export interface AdminReport {
  id: number
  received_ts: number
  user_id: string
  score: number
  reason: string
  name: string
  canonical_alias?: string
  sender: string
  event_id: string
  event_json: Record<string, unknown>
}

/**
 * 举报服务
 */
export interface ReportRoomResponse {
  report_id: string
}

export interface ScannerInfo {
  scanner_id: string
  scan_result: string
  confidence: number
  scanned_at: number
}

class ReportService {
  private client: MatrixClient | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[Report] 服务已初始化')
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient() ?? this.client
    if (!client) {
      throw new Error('Client 未初始化')
    }
    if (this.client !== client) {
      this.client = client
    }
    return client
  }

  /**
   * 举报事件
   */
  async reportEvent(request: ReportRequest): Promise<void> {
    const client = this.getClient()
    const { roomId, eventId, reason, explanation } = request

    try {
      await client.reportEvent(roomId, eventId, reason, explanation || '')
      info(`[Report] 举报成功: ${roomId}/${eventId}`)
    } catch (err) {
      error(`[Report] 举报失败: ${err}`)
      throw err
    }
  }

  /**
   * 举报用户
   * Matrix 协议不支持直接举报用户，通过举报其消息事件实现
   */
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
                info(`[Report] 举报用户成功: ${userId}`)
                return
              }
            }
          }
        }
      }
      info(`[Report] 未找到用户 ${userId} 的可举报事件`)
    } catch (err) {
      error(`[Report] 举报用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 举报房间
   */
  async reportRoom(roomId: string, reason: string, description?: string): Promise<ReportRoomResponse | null> {
    const client = this.getClient()

    try {
      const result = (await client.http.authedRequest(
        'POST',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/report`,
        undefined,
        { reason, description }
      )) as ReportRoomResponse
      info(`[Report] 举报房间成功: ${roomId}, report_id=${result.report_id}`)
      return result
    } catch (err) {
      error(`[Report] v3 举报房间失败，回退到事件举报: ${err}`)
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
        error(`[Report] 回退举报房间也失败: ${fallbackErr}`)
      }
      throw err
    }
  }

  async scoreReport(roomId: string, eventId: string, score: number): Promise<void> {
    const client = this.getClient()
    if (score < -100 || score > 0) {
      throw new Error('[Report] 评分必须在 -100 到 0 之间')
    }
    try {
      await client.http.authedRequest(
        'PUT',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/score`,
        undefined,
        { score }
      )
      info(`[Report] 举报评分成功: ${roomId}/${eventId}, score=${score}`)
    } catch (err) {
      error(`[Report] 举报评分失败: ${err}`)
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
      error(`[Report] 获取扫描器信息失败: ${err}`)
      return null
    }
  }

  async getAdminReports(
    roomId?: string,
    limit: number = 50,
    from?: string
  ): Promise<{
    reports: AdminReport[]
    next_batch?: string
  }> {
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
      error(`[Report] 获取管理端报表失败: ${err}`)
      return { reports: [] }
    }
  }

  async getAdminReport(reportId: string): Promise<AdminReport | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ADMIN.REPORT_BY_ID(reportId))
      return result as AdminReport
    } catch (err) {
      error(`[Report] 获取报表详情失败: ${err}`)
      return null
    }
  }

  async dismissReport(reportId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('DELETE', MATRIX_PATHS.ADMIN.REPORT_BY_ID(reportId))
      info(`[Report] 驳回报表成功: ${reportId}`)
      return true
    } catch (err) {
      error(`[Report] 驳回报表失败: ${err}`)
      return false
    }
  }
}

/**
 * 单例实例
 */
export const reportService = new ReportService()

/**
 * Vue Composable
 */
export function useReport() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  async function report(request: ReportRequest) {
    isLoading.value = true
    error.value = null
    success.value = false
    try {
      await reportService.reportEvent(request)
      success.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '举报失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function reportRoom(roomId: string, reason: string, explanation?: string) {
    isLoading.value = true
    error.value = null
    success.value = false
    try {
      await reportService.reportRoom(roomId, reason, explanation)
      success.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '举报失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function reset() {
    error.value = null
    success.value = false
  }

  return {
    isLoading,
    error,
    success,
    report,
    reportRoom,
    reset
  }
}

export { ReportReason as ReportReasonEnum }
export default reportService
