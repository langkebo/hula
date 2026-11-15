/**
 * MatrixThreadApi — REST/ThreadingManager-backed thread operations.
 *
 * All `*ViaApi` methods from the original MatrixThreadService live here.
 * The methods delegate to the synapse-rust ThreadingManager extension
 * (exposed on the MatrixClient via `getThreadingManager()` method).
 *
 * 校准说明：
 * - `getRoomThread` 实际返回**嵌套**的 `ThreadDetailResponse`（root/replies/summary/...），
 *   此前误按扁平 ThreadRootResponse 声明，消费者取 `root_event_id` 会拿到 undefined；
 * - 未读接口的 `threads` 元素是 `ThreadReadReceiptResponse`（已读回执），不是线程摘要。
 *
 * 本文件**不做** camelCase 转换，保持后端原始形状透传。
 * 仅保留线程面板实际使用的方法；无 UI 调用点的列表/创建/订阅类方法已移除（ROOM-04）。
 */

import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type {
  ThreadDetailResponse,
  ThreadReadReceiptResponse,
  ThreadReplyResponse,
  ThreadStatistics,
  ThreadSubscription,
  ThreadSubscriptionResponse
} from './threadTypes'
import { getThreadingManager } from './threadUtils'

const logger = createLogger('MatrixThreadApi')

export class MatrixThreadApi extends BaseMatrixService {
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

  /** 通过 API 删除房间话题 */
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

  /** 通过 API 冻结话题 */
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

  /** 通过 API 解冻话题 */
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

  /** 通过 API 获取话题回复列表
   *
   * SDK getThreadReplies 返回 ThreadReplyResponse[]（数组），Array.isArray 判定有效。
   *
   * 失败时向上抛出（与同族 subscribeToThreadViaApi 一致），
   * 让调用方能把「加载失败」与「空回复列表」区分开——否则加载错误会伪装成
   * “暂无回复”。仅当 threadingManager 不可用（客户端未暴露扩展）时，按同族
   * 只读方法的约定返回空数组。
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

  /** 通过 API 撤回话题回复 */
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

  /** SDK ThreadSubscriptionResponse（snake_case）→ Tjg ThreadSubscription（camelCase） */
  private mapSubscription(result: ThreadSubscriptionResponse): ThreadSubscription {
    return {
      notificationLevel: result.notification_level,
      isMuted: result.is_muted,
      subscribedTs: result.subscribed_ts
    }
  }
}
