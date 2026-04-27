/**
 * Matrix 事件举报服务
 *
 * 提供内容举报功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { ref } from 'vue'
import { info, error } from '@tauri-apps/plugin-log'
import { matrixClientService } from '../MatrixClientService'

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
 * 举报服务
 */
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
  async reportRoom(roomId: string, reason: string, explanation?: string): Promise<void> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (room && room.timeline.length > 0) {
        const event = room.timeline[0]
        await this.reportEvent({
          roomId,
          eventId: event.getId() || '',
          reason,
          explanation
        })
      }
    } catch (err) {
      error(`[Report] 举报房间失败: ${err}`)
      throw err
    }
  }

  async getAdminReports(
    roomId?: string,
    limit: number = 50,
    from?: string
  ): Promise<{
    reports: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = { limit: String(limit) }
      if (roomId) queryParams.room_id = roomId
      if (from) queryParams.from = from
      const result = await client.http.authedRequest('GET', '/_synapse/admin/v1/reports', queryParams)
      return {
        reports: (result as { reports?: Array<Record<string, unknown>> }).reports ?? [],
        next_batch: (result as { next_batch?: string }).next_batch
      }
    } catch (err) {
      error(`[Report] 获取管理端报表失败: ${err}`)
      return { reports: [] }
    }
  }

  async getAdminReport(reportId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_synapse/admin/v1/reports/${encodeURIComponent(reportId)}`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[Report] 获取报表详情失败: ${err}`)
      return null
    }
  }

  async dismissReport(reportId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('DELETE', `/_synapse/admin/v1/reports/${encodeURIComponent(reportId)}`)
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
