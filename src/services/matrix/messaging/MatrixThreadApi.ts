/**
 * MatrixThreadApi — REST/ThreadingManager-backed thread operations.
 *
 * All `*ViaApi` methods from the original MatrixThreadService live here.
 * The methods delegate to the synapse-rust ThreadingManager extension
 * (exposed on the MatrixClient via `getThreadingManager()` method).
 *
 * 校准说明：
 * - F-8 已修复 `result?.subscribed ?? []` 取对象字段而非 `Array.isArray` 误判；
 * - 2026-09-06 fork 实现的 `getSubscribedThreads` 签名为 `() => SubscribedThreadsResponse`，
 *   而 Tjg 调用时的 `result.threads` 字段在 synapse-rust 实际返回 `threads: ThreadSummaryResponse[]`；
 * - 方法签名已校准为对象参数，与 SDK ThreadingManager 实际实现一致；
 *
 * 2026-09-10 二轮校准（返回类型）：
 * - `getRoomThread` 实际返回**嵌套**的 `ThreadDetailResponse`（root/replies/summary/...），
 *   此前误按扁平 ThreadRootResponse 声明，消费者取 `root_event_id` 会拿到 undefined；
 * - `getRoomThreadList` / `searchRoomThreads` 元素是 **snake_case** 的
 *   `ThreadSummaryResponse`，不是 camelCase 的 `ThreadListItem`；
 * - 未读接口的 `threads` 元素是 `ThreadReadReceiptResponse`（已读回执），不是线程摘要。
 *
 * 本文件**不做** camelCase 转换，保持后端原始形状透传；
 * 展示层需要 `ThreadListItem` 时请用 `threadUtils.toThreadListItem()`。
 */

import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type {
  ThreadCreateResponse,
  ThreadDetailResponse,
  ThreadLegacyChunkItem,
  ThreadReadReceiptResponse,
  ThreadReplyResponse,
  ThreadStatistics,
  ThreadSubscription,
  ThreadSubscriptionResponse,
  ThreadSummaryResponse
} from './threadTypes'
import { getThreadingManager } from './threadUtils'

const logger = createLogger('MatrixThreadApi')

export class MatrixThreadApi extends BaseMatrixService {
  /** 获取全局线程列表（MSC4267 实现的 /sync 增量 state token） */
  async getGlobalThreadListViaApi(
    limit = 50,
    from?: string
  ): Promise<{ threads: ThreadSummaryResponse[]; nextBatch?: string; total: number }> {
    const manager = getThreadingManager()
    if (!manager?.getGlobalThreadList) return { threads: [], total: 0 }
    try {
      const result = await manager.getGlobalThreadList({ limit, from })
      return { threads: result?.threads ?? [], nextBatch: result?.next_batch ?? undefined, total: result?.total ?? 0 }
    } catch (err) {
      logger.error(`[MatrixThread] 获取全局线程列表失败: ${err}`)
      return { threads: [], total: 0 }
    }
  }

  /** 创建全局线程 */
  async createGlobalThreadViaApi(
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ): Promise<ThreadCreateResponse | null> {
    const manager = getThreadingManager()
    if (!manager?.createGlobalThread) return null
    try {
      return await manager.createGlobalThread({ roomId, rootEventId, content })
    } catch (err) {
      logger.error(`[MatrixThread] 全局创建线程失败: ${err}`)
      throw err
    }
  }

  /** 通过 API 获取已订阅的话题列表
   *
   * F-8 校准：SDK `getSubscribedThreads()` 返回 `SubscribedThreadsResponse` 对象
   * `{ threads: ThreadSummaryResponse[], subscribed: ThreadSubscriptionResponse[], next_batch? }`，
   * 而非数组。调用方应取 `result.subscribed` 字段。
   */
  async getSubscribedThreadsViaApi(): Promise<ThreadSubscriptionResponse[]> {
    const manager = getThreadingManager()
    if (!manager?.getSubscribedThreads) return []
    try {
      const result = await manager.getSubscribedThreads()
      // F-8 修复：SDK 返回 SubscribedThreadsResponse 对象（{threads, subscribed, next_batch}），
      // 而非数组。此前 `Array.isArray` 恒为 false，导致订阅线程列表恒返 []。
      // 用可选链兼容 result 为 null/对象等异常形状，统一降级为空数组。
      return result?.subscribed ?? []
    } catch (err) {
      logger.error(`[MatrixThread] 获取已订阅线程失败: ${err}`)
      return []
    }
  }

  /** 通过 API 获取全局未读线程（MSC4204 实现的 /sync 集成） */
  async getGlobalUnreadThreadsViaApi(): Promise<ThreadReadReceiptResponse[]> {
    const manager = getThreadingManager()
    if (!manager?.getGlobalUnreadThreads) return []
    try {
      const result = await manager.getGlobalUnreadThreads()
      // SDK 返回 { threads: ThreadReadReceiptResponse[], total_unread, total_threads }
      return result?.threads ?? []
    } catch (err) {
      logger.error(`[MatrixThread] 获取全局未读线程失败: ${err}`)
      return []
    }
  }

  /** 创建房间线程 */
  async createRoomThreadViaApi(
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ): Promise<ThreadCreateResponse | null> {
    const manager = getThreadingManager()
    if (!manager?.createRoomThread) return null
    try {
      return await manager.createRoomThread(roomId, rootEventId, { content })
    } catch (err) {
      logger.error(`[MatrixThread] 房间内创建线程失败: ${err}`)
      throw err
    }
  }

  /** 获取房间线程列表（keyset 分页：limit + nextBatch） */
  async getRoomThreadListViaApi(
    roomId: string,
    limit = 50,
    from?: string,
    includeAll = false
  ): Promise<{ threads: ThreadSummaryResponse[]; nextBatch?: string }> {
    const manager = getThreadingManager()
    if (!manager?.getRoomThreadList) return { threads: [] }
    try {
      const result = await manager.getRoomThreadList(roomId, { limit, from, includeAll })
      return { threads: result?.threads ?? [], nextBatch: result?.next_batch ?? undefined }
    } catch (err) {
      logger.error(`[MatrixThread] 获取房间线程列表失败: ${err}`)
      return { threads: [] }
    }
  }

  /** 通过 API 搜索房间话题
   *
   * @param roomId 房间 ID
   * @param query 搜索关键词
   * @param limit 最大返回数量（默认 20）
   */
  async searchRoomThreadsViaApi(roomId: string, query: string, limit = 20): Promise<ThreadSummaryResponse[]> {
    const manager = getThreadingManager()
    if (!manager?.searchRoomThreads) return []
    try {
      return (await manager.searchRoomThreads(roomId, { q: query, limit })) ?? []
    } catch (err) {
      logger.error(`[MatrixThread] 搜索房间线程失败: ${err}`)
      return []
    }
  }

  /** 通过 API 获取房间未读话题 */
  async getRoomUnreadThreadsViaApi(roomId: string): Promise<ThreadReadReceiptResponse[]> {
    const manager = getThreadingManager()
    if (!manager?.getRoomUnreadThreads) return []
    try {
      const result = await manager.getRoomUnreadThreads(roomId)
      // SDK 返回 { threads: ThreadReadReceiptResponse[], total_unread, total_threads }
      return result?.threads ?? []
    } catch (err) {
      logger.error(`[MatrixThread] 获取房间未读线程失败: ${err}`)
      return []
    }
  }

  /** 获取房间线程详情 */
  async getRoomThreadViaApi(
    roomId: string,
    threadId: string,
    includeReplies = true,
    replyLimit = 50
  ): Promise<ThreadDetailResponse | null> {
    const manager = getThreadingManager()
    if (!manager?.getRoomThread) return null
    try {
      return await manager.getRoomThread(roomId, threadId, { includeReplies, replyLimit })
    } catch (err) {
      logger.error(`[MatrixThread] 获取线程详情失败: ${err}`)
      return null
    }
  }

  /** 通过 API 删除房间话题
   */
  async deleteRoomThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = getThreadingManager()
    if (!manager?.deleteRoomThread) throw new Error(this.t('matrix_error.messaging.threading_manager_unavailable'))
    try {
      await manager.deleteRoomThread(roomId, threadId)
    } catch (err) {
      logger.error(`[MatrixThread] 删除线程失败: ${err}`)
      throw err
    }
  }

  /** 通过 API 冻结话题
   */
  async freezeThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = getThreadingManager()
    if (!manager?.freezeThread) throw new Error(this.t('matrix_error.messaging.threading_manager_unavailable'))
    try {
      await manager.freezeThread(roomId, threadId)
    } catch (err) {
      logger.error(`[MatrixThread] 冻结线程失败: ${err}`)
      throw err
    }
  }

  /** 通过 API 解冻话题
   */
  async unfreezeThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = getThreadingManager()
    if (!manager?.unfreezeThread) throw new Error(this.t('matrix_error.messaging.threading_manager_unavailable'))
    try {
      await manager.unfreezeThread(roomId, threadId)
    } catch (err) {
      logger.error(`[MatrixThread] 解冻线程失败: ${err}`)
      throw err
    }
  }

  async addThreadReplyViaApi(
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ): Promise<ThreadReplyResponse | null> {
    const manager = getThreadingManager()
    if (!manager?.addThreadReply) return null
    try {
      // SDK addThreadReply(params) 要求 event_id + root_event_id。
      // threadId = root event event_id；eventId 以 threadId 兜底（server 端会实际生成事件）。
      const result = await manager.addThreadReply(roomId, threadId, {
        eventId: threadId,
        rootEventId: threadId,
        content,
        inReplyToEventId
      })
      return result ?? null
    } catch (err) {
      logger.error(`[MatrixThread] 添加线程回复失败: ${err}`)
      throw err
    }
  }

  /** 通过 API 获取话题回复列表
   *
   * SDK getThreadReplies 返回 ThreadReplyResponse[]（数组），Array.isArray 判定有效。
   *
   * 失败时向上抛出（与同族 addThreadReplyViaApi / subscribeToThreadViaApi 一致），
   * 让调用方能把「加载失败」与「空回复列表」区分开——否则加载错误会伪装成
   * “暂无回复”。仅当 threadingManager 不可用（客户端未暴露扩展）时，按同族
   * 只读方法（getSubscribedThreads 等）的约定返回空数组。
   */
  async getThreadRepliesViaApi(roomId: string, threadId: string, limit?: number): Promise<ThreadReplyResponse[]> {
    const manager = getThreadingManager()
    if (!manager?.getThreadReplies) return []
    try {
      const result = await manager.getThreadReplies(roomId, threadId, { limit })
      return Array.isArray(result) ? result : []
    } catch (err) {
      logger.error(`[MatrixThread] 获取线程回复失败: ${err}`)
      throw err
    }
  }

  /** 订阅线程
   *
   * SDK 返回 ThreadSubscriptionResponse（snake_case），映射为 Tjg 的 ThreadSubscription（camelCase）。
   */
  async subscribeToThreadViaApi(
    roomId: string,
    threadId: string,
    notificationLevel = 'all'
  ): Promise<ThreadSubscription | null> {
    const manager = getThreadingManager()
    if (!manager?.subscribeToThread) return null
    try {
      const result = await manager.subscribeToThread(roomId, threadId, notificationLevel)
      return result ? this.mapSubscription(result) : null
    } catch (err) {
      logger.error(`[MatrixThread] 订阅线程失败: ${err}`)
      throw err
    }
  }

  /** 通过 API 取消订阅话题
   */
  async unsubscribeFromThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = getThreadingManager()
    if (!manager?.unsubscribeFromThread) throw new Error(this.t('matrix_error.messaging.threading_manager_unavailable'))
    try {
      await manager.unsubscribeFromThread(roomId, threadId)
    } catch (err) {
      logger.error(`[MatrixThread] 取消订阅线程失败: ${err}`)
      throw err
    }
  }

  /** 通过 API 静音话题
   *
   * SDK 返回 ThreadSubscriptionResponse（snake_case），映射为 Tjg 的 ThreadSubscription（camelCase）。
   */
  async muteThreadViaApi(roomId: string, threadId: string): Promise<ThreadSubscription | null> {
    const manager = getThreadingManager()
    if (!manager?.muteThread) return null
    try {
      const result = await manager.muteThread(roomId, threadId)
      return result ? this.mapSubscription(result) : null
    } catch (err) {
      logger.error(`[MatrixThread] 静音线程失败: ${err}`)
      throw err
    }
  }

  async markThreadReadViaApi(
    roomId: string,
    threadId: string,
    eventId: string,
    originServerTs: number
  ): Promise<ThreadReadReceiptResponse | null> {
    const manager = getThreadingManager()
    if (!manager?.markThreadRead) return null
    try {
      return await manager.markThreadRead(roomId, threadId, eventId, originServerTs)
    } catch (err) {
      logger.error(`[MatrixThread] 标记线程已读失败: ${err}`)
      return null
    }
  }

  /** 通过 API 获取话题统计信息
   *
   * SDK 返回 ThreadStatisticsResponse（snake_case），映射为 Tjg 的 ThreadStatistics（camelCase）。
   */
  async getThreadStatsViaApi(roomId: string, threadId: string): Promise<ThreadStatistics | null> {
    const manager = getThreadingManager()
    if (!manager?.getThreadStats) return null
    try {
      const result = await manager.getThreadStats(roomId, threadId)
      if (!result) return null
      return {
        totalReplies: result.total_replies,
        totalParticipants: result.total_participants,
        totalEdits: result.total_edits,
        totalRedactions: result.total_redactions,
        firstReplyTs: result.first_reply_ts ?? undefined,
        lastReplyTs: result.last_reply_ts ?? undefined,
        avgReplyTimeMs: result.avg_reply_time_ms ?? undefined
      }
    } catch (err) {
      logger.error(`[MatrixThread] 获取线程统计失败: ${err}`)
      return null
    }
  }

  /** 通过 API 撤回话题回复
   */
  async redactThreadReplyViaApi(roomId: string, eventId: string): Promise<void> {
    const manager = getThreadingManager()
    if (!manager?.redactThreadReply) throw new Error(this.t('matrix_error.messaging.threading_manager_unavailable'))
    try {
      await manager.redactThreadReply(roomId, eventId)
    } catch (err) {
      logger.error(`[MatrixThread] 撤回线程回复失败: ${err}`)
      throw err
    }
  }

  async getLegacyRoomThreadList(
    userId: string,
    roomId: string,
    limit = 50,
    from?: string,
    includeAll = false
  ): Promise<{ chunk: ThreadLegacyChunkItem[]; nextBatch?: string }> {
    const manager = getThreadingManager()
    if (!manager?.getLegacyRoomThreadList) return { chunk: [] }
    try {
      const result = await manager.getLegacyRoomThreadList(userId, roomId, { limit, from, includeAll })
      return { chunk: result.chunk ?? [], nextBatch: result.next_batch ?? undefined }
    } catch (err) {
      logger.error(`[MatrixThread] 获取兼容旧版线程列表失败: ${err}`)
      return { chunk: [] }
    }
  }

  /** SDK ThreadSubscriptionResponse（snake_case）→ Tjg ThreadSubscription（camelCase） */
  private mapSubscription(result: ThreadSubscriptionResponse): ThreadSubscription {
    return {
      notificationLevel: result.notification_level,
      isMuted: result.is_muted,
      subscribedTs: result.subscribed_ts
    }
  }
}
