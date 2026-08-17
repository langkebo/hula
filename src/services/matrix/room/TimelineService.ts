import { createLogger } from '@/utils/Logger'
import type { Direction } from '@/services/matrix/sdk'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('TimelineService')

/**
 * Room timeline / context domain service.
 *
 * Covers `/context`, `/timeline`, `/timestamp_to_event`, `/unread_count`,
 * and per-room call session lookup.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomTimelineService extends BaseMatrixService {
  async getEventContext(
    roomId: string,
    eventId: string,
    limit: number = 10
  ): Promise<{
    event: unknown
    events_before: unknown[]
    events_after: unknown[]
    state: unknown[]
  } | null> {
    const client = this.getClient()
    try {
      const result = await client.getEventContext(roomId, eventId, { limit })
      logger.info(`[MatrixRoom] 获取事件上下文成功: ${roomId}/${eventId}`)
      return result as { event: unknown; events_before: unknown[]; events_after: unknown[]; state: unknown[] }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取事件上下文失败: ${err}`)
      throw err
    }
  }

  async getRoomTimeline(
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'f' | 'b' }
  ): Promise<{
    chunk: unknown[]
    start: string
    end: string
  }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomTimeline(roomId, {
        from: options?.from,
        limit: options?.limit,
        dir: options?.dir
      })
      return result as { chunk: unknown[]; start: string; end: string }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间时间线失败: ${err}`)
      return { chunk: [], start: '', end: '' }
    }
  }

  async getRoomUnreadCount(roomId: string): Promise<{
    unread_notifications: number
    unread_highlighted: number
  }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomUnreadCount(roomId)
      return {
        unread_notifications: result.notification_count ?? 0,
        unread_highlighted: result.highlight_count ?? 0
      }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取未读计数失败: ${err}`)
      return { unread_notifications: 0, unread_highlighted: 0 }
    }
  }

  async timestampToEvent(
    roomId: string,
    timestamp: number,
    dir: 'f' | 'b' = 'b'
  ): Promise<{ event_id: string; origin_server_ts: number } | null> {
    const client = this.getClient()
    try {
      const result = await client.timestampToEvent(roomId, timestamp, dir as Direction)
      return result as { event_id: string; origin_server_ts: number }
    } catch (err) {
      logger.error(`[MatrixRoom] 时间戳反查事件失败: ${err}`)
      return null
    }
  }

  async getRoomNotifications(
    roomId: string,
    params?: { from?: string; limit?: number }
  ): Promise<{ notifications: Array<Record<string, unknown>>; next_token?: string }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomNotifications(roomId, {
        from: params?.from,
        limit: params?.limit
      })
      return result as unknown as { notifications: Array<Record<string, unknown>>; next_token?: string }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间通知失败: ${err}`)
      return { notifications: [] }
    }
  }

  /**
   * 获取房间通话会话信息。
   *
   * 调用 `GET /_matrix/client/v3/rooms/{roomId}/call/{callId}`（后端 voip_tracking 端点），
   * 通过 SDK `RoomManager.getRoomCall` 薄封装发起。请求失败时返回 `null` 而非抛出异常。
   *
   * @param roomId - 房间 ID
   * @param callId - 通话 ID
   * @returns 通话会话数据，或 null（端点不可用时）
   */
  async getRoomCall(roomId: string, callId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomCall(roomId, callId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取通话会话失败: ${err}`)
      return null
    }
  }
}

export const matrixRoomTimelineService = new MatrixRoomTimelineService()
