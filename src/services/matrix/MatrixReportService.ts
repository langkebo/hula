/**
 * Matrix 事件举报服务
 *
 * 提供内容举报功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import type { ExtendedMatrixClientForReport } from '@/types/matrix-api'
import { info } from '@tauri-apps/plugin-log'

/**
 * 举报原因
 */
export enum ReportReason {
  /** 色情内容 */
  Sexual = ' sexual',
  /** 暴力内容 */
  Violence = ' violence',
  /** 仇恨言论 */
  HateSpeech = ' hate_speech',
  /** 自杀自残 */
  SelfHarm = ' self_harm',
  /** 恐怖主义 */
  Terrorism = ' terrorism',
  /** 垃圾信息 */
  Spam = ' spam',
  /** 违规内容 */
  Violation = ' violation',
  /** 其他 */
  Other = ' other'
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
class ReportService extends BaseManager {
  private client: MatrixClient | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[Report] 服务已初始化')
  }

  /**
   * 举报事件
   */
  async reportEvent(request: ReportRequest): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const { roomId, eventId, reason, explanation } = request
    const extendedClient = this.client as unknown as ExtendedMatrixClientForReport
    await extendedClient.reportEvent(roomId, eventId, reason, explanation || '')
    info(`[Report] 举报成功: ${roomId}/${eventId}`)
  }

  /**
   * 举报用户
   */
  async reportUser(userId: string, _reason: string, _explanation?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }
    // 通过举报房间消息来举报用户
    // Matrix API 没有直接的举报用户接口
    info(`[Report] 举报用户功能需要通过房间事件举报实现: ${userId}`)
  }

  /**
   * 举报房间
   */
  async reportRoom(roomId: string, reason: string, explanation?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }
    // 获取房间的第一个事件进行举报
    const room = this.client.getRoom(roomId)
    if (room && room.timeline.length > 0) {
      const event = room.timeline[0]
      await this.reportEvent({
        roomId,
        eventId: event.getId() || '',
        reason,
        explanation
      })
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
import { ref } from 'vue'
import { BaseManager } from './BaseManager'

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
