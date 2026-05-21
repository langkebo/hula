import { error, info } from '@tauri-apps/plugin-log'
import { BaseMatrixService } from '../BaseMatrixService'
import { MATRIX_PATHS } from '../paths'

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
      info(`[MatrixRoom] 获取事件上下文成功: ${roomId}/${eventId}`)
      return result as { event: unknown; events_before: unknown[]; events_after: unknown[]; state: unknown[] }
    } catch (err) {
      error(`[MatrixRoom] 获取事件上下文失败: ${err}`)
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
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.dir) queryParams.dir = options.dir

      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/timeline`,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result as { chunk: unknown[]; start: string; end: string }
    } catch (err) {
      error(`[MatrixRoom] 获取房间时间线失败: ${err}`)
      return { chunk: [], start: '', end: '' }
    }
  }

  async getRoomUnreadCount(roomId: string): Promise<{
    unread_notifications: number
    unread_highlighted: number
  }> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/unread_count`
      )
      const unreadCountResult = result as {
        unread_notifications?: number
        unread_highlighted?: number
        notification_count?: number
        highlight_count?: number
      }
      return {
        unread_notifications: unreadCountResult.unread_notifications ?? unreadCountResult.notification_count ?? 0,
        unread_highlighted: unreadCountResult.unread_highlighted ?? unreadCountResult.highlight_count ?? 0
      }
    } catch (err) {
      error(`[MatrixRoom] 获取未读计数失败: ${err}`)
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
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ROOM.TIMESTAMP_TO_EVENT(roomId), {
        ts: String(timestamp),
        dir
      })
      return result as { event_id: string; origin_server_ts: number }
    } catch (err) {
      error(`[MatrixRoom] 时间戳反查事件失败: ${err}`)
      return null
    }
  }

  async getRoomNotifications(
    roomId: string,
    params?: { from?: string; limit?: number }
  ): Promise<{ notifications: Array<Record<string, unknown>>; next_token?: string }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = {}
      if (params?.from) queryParams.from = params.from
      if (params?.limit) queryParams.limit = String(params.limit)

      const result = await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.ROOM.NOTIFICATIONS(roomId),
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return result as { notifications: Array<Record<string, unknown>>; next_token?: string }
    } catch (err) {
      error(`[MatrixRoom] 获取房间通知失败: ${err}`)
      return { notifications: [] }
    }
  }

  async getRoomCall(roomId: string, callId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/call/${encodeURIComponent(callId)}`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取通话会话失败: ${err}`)
      return null
    }
  }
}

export const matrixRoomTimelineService = new MatrixRoomTimelineService()
