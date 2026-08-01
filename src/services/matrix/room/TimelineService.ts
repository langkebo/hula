import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'

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
      const result = await client.getRoomSummaryManager().eventOps.getRoomTimeline(roomId, options as never)
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
      const result = await client.getRoomSummaryManager().eventOps.getRoomUnreadCount(roomId)
      return {
        unread_notifications: result.unread_notifications ?? result.notification_count ?? 0,
        unread_highlighted: result.unread_highlight_count ?? result.highlight_count ?? 0
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
      const result = await authedRequestWithPath<{ event_id: string; origin_server_ts: number }>(
        client,
        'GET',
        MATRIX_PATHS.ROOM.TIMESTAMP_TO_EVENT(roomId),
        {
          ts: String(timestamp),
          dir
        }
      )
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
      const result = await client.getRoomSummaryManager().eventOps.getRoomNotifications(roomId, params as never)
      return {
        notifications: result.notifications as unknown as Array<Record<string, unknown>>,
        next_token: result.next_batch ?? result.next_token ?? undefined
      }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间通知失败: ${err}`)
      return { notifications: [] }
    }
  }

  /**
   * 获取房间通话会话信息。
   *
   * **注意：** 此方法调用的 `GET /_matrix/client/v3/rooms/{roomId}/call/{callId}` 端点
   * 当前后端尚未实现。请求失败时会返回 `null` 而非抛出异常。
   *
   * @param roomId - 房间 ID
   * @param callId - 通话 ID
   * @returns 通话会话数据，或 null（端点不可用时）
   * @todo 等待后端实现 `/call/{callId}` 路由
   */
  async getRoomCall(roomId: string, callId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      // Not migrated to SDK: no SDK manager method available for /rooms/{roomId}/call/{callId}.
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ROOM.CALL(roomId, callId))
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取通话会话失败: ${err}`)
      return null
    }
  }
}

export const matrixRoomTimelineService = new MatrixRoomTimelineService()
