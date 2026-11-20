import { Direction } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { resolveMxcToHttp } from '../media/mxcUrl'
import type { RoomFilesOutcome } from './timelineFileOutcomes'
import { normalizeRoomFilesPage } from './timelineFileOutcomes'
import type {
  RoomCallInfo,
  RoomEventMediaUrl,
  RoomEventMediaUrlOutcome,
  RoomEventPerspectiveOutcome,
  RoomFragmentsOutcome,
  RoomNotificationsOutcome,
  RoomReceiptsOutcome,
  RoomReducedEventsOutcome,
  RoomRenderedOutcome
} from './timelineOutcomes'
import {
  normalizeFragments,
  normalizePerspective,
  normalizeReceipts,
  normalizeReducedEvents,
  normalizeRendered,
  readErrcode,
  toMediaEntries
} from './timelineOutcomes'

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
  ): Promise<RoomNotificationsOutcome> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomNotifications(roomId, {
        ...(params?.from !== undefined ? { from: params.from } : {}),
        ...(params?.limit !== undefined ? { limit: params.limit } : {})
      })
      return result as RoomNotificationsOutcome
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
  async getRoomCall(roomId: string, callId: string): Promise<RoomCallInfo | null> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomCall(roomId, callId)
      return result as RoomCallInfo
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

  /**
   * 获取事件附件媒体地址（ROOM-03，只读）。
   *
   * 注意：该端点提取的是事件 content 里的媒体地址，不是消息永久链接；
   * 文本消息没有附件时返回 `empty`，端点缺失归 `unsupported`。
   */
  async getRoomEventMediaUrls(roomId: string, eventId: string): Promise<RoomEventMediaUrlOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomEventUrl(roomId, eventId)
      const seen = new Set<string>()
      const urls: RoomEventMediaUrl[] = []
      for (const entry of toMediaEntries(result)) {
        if (seen.has(entry.url)) continue
        seen.add(entry.url)
        urls.push({ ...entry, httpUrl: resolveMxcToHttp(client, entry.url) })
      }
      return urls.length > 0 ? { status: 'ok', urls } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持事件媒体地址提取: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取事件媒体地址失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取房间降采样事件（ROOM-03，只读）。
   *
   * `events` 为空归 `empty`，端点缺失（`M_UNRECOGNIZED`）归 `unsupported`。
   */
  async getRoomReducedEvents(roomId: string): Promise<RoomReducedEventsOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomReducedEvents(roomId)
      const snapshot = normalizeReducedEvents(result)
      return snapshot ? { status: 'ok', snapshot } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间降采样事件查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间降采样事件失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取房间渲染结果（ROOM-03，只读）。
   *
   * 只保留 `plain_text` 与逐事件渲染文本，不向前端暴露 `html`
   * （避免把服务端 HTML 直接注入 DOM）。无任何可展示内容归 `empty`。
   */
  async getRoomRendered(roomId: string): Promise<RoomRenderedOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomRendered(roomId)
      const snapshot = normalizeRendered(result)
      return snapshot ? { status: 'ok', snapshot } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间渲染结果查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间渲染结果失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取指定用户在房间内的时间线片段（ROOM-03，只读）。
   *
   * 片段缺 `start` / `end` 视为脏条目丢弃；空列表归 `empty`。
   */
  async getRoomFragments(roomId: string, userId: string): Promise<RoomFragmentsOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomFragments(roomId, userId)
      const snapshot = normalizeFragments(result, userId)
      return snapshot ? { status: 'ok', snapshot } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间时间线片段查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间时间线片段失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取某事件的已读回执明细（ROOM-03，只读）。
   *
   * 兼容后端的 `receipts[]` 与 `users` 映射两种形状；无回执用户归 `empty`。
   */
  async getRoomReceipts(roomId: string, receiptType: string, eventId: string): Promise<RoomReceiptsOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomReceipts(roomId, receiptType, eventId)
      const snapshot = normalizeReceipts(result, receiptType, eventId)
      return snapshot ? { status: 'ok', snapshot } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持已读回执明细查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取已读回执明细失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 按房间分页扫描文件消息（文件页签数据源，只读）。
   *
   * 走 SDK 的 `/messages` 分页（`EventManager.createMessagesRequest`），用
   * `types: ['m.room.message']` 收窄事件类型后在客户端筛出附件消息
   * （`IRoomEventFilter` 未声明 `contains_url`，因此不在服务端做 URL 过滤）。
   * `from` 缺省表示从房间最新处向更早翻；`nextToken` 为 null 表示已到房间开头。
   */
  async getRoomFiles(roomId: string, options?: { from?: string; limit?: number }): Promise<RoomFilesOutcome> {
    try {
      const client = this.getClient()
      const result = await client
        .getEventManager()
        .createMessagesRequest(roomId, options?.from ?? null, options?.limit ?? 50, Direction.Backward, {
          types: ['m.room.message']
        })
      const page = normalizeRoomFilesPage(result, (mxcUrl) => resolveMxcToHttp(client, mxcUrl))
      // 缺 `chunk` 属协议违例，按失败处理，不把它渲染成「没有文件」
      return page ? { status: 'ok', page } : { status: 'error' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间消息分页: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间文件列表失败: ${err}`)
      return { status: 'error' }
    }
  }
}

export const matrixRoomTimelineService = new MatrixRoomTimelineService()
