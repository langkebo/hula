import type { Direction } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('TimelineService')

/**
 * 消息视角统计（G-08）。
 *
 * 后端 `GET /_matrix/vendor/v1/rooms/{roomId}/event_perspective` 在 anchor 事件外
 * 附带 `perspective`：anchor 前 99 条 + anchor 的窗口统计。SDK 类型声明里没有
 * 该字段，因此在此归一化。
 */
export interface RoomEventPerspectiveStats {
  /** 窗口内事件总数 */
  eventCount: number
  /** 窗口内最新事件 ID */
  latestEventId: string | null
  /** 发送者活跃度（按条数降序） */
  senderActivity: Array<{ userId: string; count: number }>
  /** 事件类型分布（按条数降序） */
  eventTypes: Array<{ type: string; count: number }>
}

export type RoomEventPerspectiveOutcome =
  /** 端点存在且返回了 perspective */
  | { status: 'ok'; stats: RoomEventPerspectiveStats }
  /** 端点存在，但响应里没有 perspective 字段 */
  | { status: 'empty' }
  /** 端点不存在（该 homeserver 不支持） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（如 anchor 不可见、网络错误） */
  | { status: 'error' }

function toCountMap(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const entries = Object.entries(value as Record<string, unknown>)
  return Object.fromEntries(
    entries.filter(([, count]) => typeof count === 'number' && Number.isFinite(count) && count > 0)
  ) as Record<string, number>
}

function toSortedCountRows(map: Record<string, number>): Array<[string, number]> {
  return Object.entries(map).sort(([, a], [, b]) => b - a)
}

function normalizePerspective(raw: unknown): RoomEventPerspectiveStats | null {
  if (typeof raw !== 'object' || raw === null) return null
  const perspective = (raw as Record<string, unknown>).perspective
  if (typeof perspective !== 'object' || perspective === null) return null
  const record = perspective as Record<string, unknown>

  const senderActivity = toSortedCountRows(toCountMap(record.sender_activity)).map(([userId, count]) => ({
    userId,
    count
  }))
  const eventTypes = toSortedCountRows(toCountMap(record.event_types)).map(([type, count]) => ({ type, count }))

  return {
    eventCount: typeof record.event_count === 'number' && Number.isFinite(record.event_count) ? record.event_count : 0,
    latestEventId: typeof record.latest_event_id === 'string' ? record.latest_event_id : null,
    senderActivity,
    eventTypes
  }
}

/** 从 SDK 抛出的错误中提取 Matrix errcode（部分错误把 errcode 塞在 message 的 JSON 里）。 */
function readErrcode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const record = err as { errcode?: unknown; code?: unknown; message?: unknown }
  if (typeof record.errcode === 'string') return record.errcode
  if (typeof record.code === 'string') return record.code
  if (typeof record.message === 'string') {
    const jsonMatch = record.message.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { errcode?: unknown }
        if (typeof parsed.errcode === 'string') return parsed.errcode
      } catch {
        return null
      }
    }
  }
  return null
}

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
      logger.debug(`[MatrixRoom] 获取事件上下文成功: ${roomId}/${eventId}`)
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
        ...(options?.from !== undefined ? { from: options.from } : {}),
        ...(options?.limit !== undefined ? { limit: options.limit } : {}),
        ...(options?.dir !== undefined ? { dir: options.dir } : {})
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
        ...(params?.from !== undefined ? { from: params.from } : {}),
        ...(params?.limit !== undefined ? { limit: params.limit } : {})
      })
      return result as typeof result & { notifications: Array<Record<string, unknown>>; next_token?: string }
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

  /**
   * 获取消息视角统计（G-08，只读）。
   *
   * 端点缺失（`M_UNRECOGNIZED`）归为 `unsupported`；其余错误归为 `error`，
   * 由浮层展示明确状态，避免出现必然失败的死按钮。
   */
  async getRoomEventPerspective(roomId: string, eventId: string): Promise<RoomEventPerspectiveOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomEventPerspective(roomId, eventId)
      const stats = normalizePerspective(result)
      return stats ? { status: 'ok', stats } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持消息视角统计: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取消息视角统计失败: ${err}`)
      return { status: 'error' }
    }
  }
}

export const matrixRoomTimelineService = new MatrixRoomTimelineService()
