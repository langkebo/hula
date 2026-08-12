/**
 * MatrixThreadApi — REST/ThreadingManager-backed thread operations.
 *
 * All `*ViaApi` methods from the original MatrixThreadService live here.
 * The methods delegate to the synapse-rust ThreadingManager extension
 * (exposed on the MatrixClient as `threadingManager`).
 *
 * Public method signatures are preserved verbatim so MatrixThreadService
 * can forward calls without adapting arguments.
 */

import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type { ThreadListItem, ThreadStatistics, ThreadSubscription } from './threadTypes'
import { getThreadingManager } from './threadUtils'

const logger = createLogger('MatrixThreadApi')

export class MatrixThreadApi extends BaseMatrixService {
  async getGlobalThreadListViaApi(
    limit = 50,
    from?: string
  ): Promise<{ threads: unknown[]; nextBatch?: string; total: number }> {
    const manager = getThreadingManager()
    if (!manager?.getGlobalThreadList) return { threads: [], total: 0 }
    try {
      const result = await manager.getGlobalThreadList(limit, from)
      return { threads: result.threads, nextBatch: result.next_batch, total: result.total }
    } catch (err) {
      logger.error(`[MatrixThread] 获取全局线程列表失败: ${err}`)
      return { threads: [], total: 0 }
    }
  }

  async createGlobalThreadViaApi(
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const manager = getThreadingManager()
    if (!manager?.createGlobalThread) return null
    try {
      return await manager.createGlobalThread(roomId, rootEventId, content)
    } catch (err) {
      logger.error(`[MatrixThread] 全局创建线程失败: ${err}`)
      throw err
    }
  }

  async getSubscribedThreadsViaApi(): Promise<unknown[]> {
    const manager = getThreadingManager()
    if (!manager?.getSubscribedThreads) return []
    try {
      const result = await manager.getSubscribedThreads()
      return Array.isArray(result) ? result : []
    } catch (err) {
      logger.error(`[MatrixThread] 获取已订阅线程失败: ${err}`)
      return []
    }
  }

  async getGlobalUnreadThreadsViaApi(): Promise<unknown[]> {
    const manager = getThreadingManager()
    if (!manager?.getGlobalUnreadThreads) return []
    try {
      const result = await manager.getGlobalUnreadThreads()
      return Array.isArray(result) ? result : []
    } catch (err) {
      logger.error(`[MatrixThread] 获取全局未读线程失败: ${err}`)
      return []
    }
  }

  async createRoomThreadViaApi(
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const manager = getThreadingManager()
    if (!manager?.createRoomThread) return null
    try {
      return await manager.createRoomThread(roomId, rootEventId, content)
    } catch (err) {
      logger.error(`[MatrixThread] 房间内创建线程失败: ${err}`)
      throw err
    }
  }

  async getRoomThreadListViaApi(
    roomId: string,
    limit = 50,
    from?: string,
    includeAll = false
  ): Promise<{ threads: ThreadListItem[]; nextBatch?: string }> {
    const manager = getThreadingManager()
    if (!manager?.getRoomThreadList) return { threads: [] }
    try {
      const result = await manager.getRoomThreadList(roomId, limit, from, includeAll)
      return { threads: result.threads ?? [], nextBatch: result.next_batch }
    } catch (err) {
      logger.error(`[MatrixThread] 获取房间线程列表失败: ${err}`)
      return { threads: [] }
    }
  }

  async searchRoomThreadsViaApi(roomId: string, query: string, limit = 20): Promise<ThreadListItem[]> {
    const manager = getThreadingManager()
    if (!manager?.searchRoomThreads) return []
    try {
      return (await manager.searchRoomThreads(roomId, query, limit)) ?? []
    } catch (err) {
      logger.error(`[MatrixThread] 搜索房间线程失败: ${err}`)
      return []
    }
  }

  async getRoomUnreadThreadsViaApi(roomId: string): Promise<unknown[]> {
    const manager = getThreadingManager()
    if (!manager?.getRoomUnreadThreads) return []
    try {
      const result = await manager.getRoomUnreadThreads(roomId)
      return Array.isArray(result) ? result : []
    } catch (err) {
      logger.error(`[MatrixThread] 获取房间未读线程失败: ${err}`)
      return []
    }
  }

  async getRoomThreadViaApi(
    roomId: string,
    threadId: string,
    includeReplies = true,
    replyLimit = 50
  ): Promise<Record<string, unknown> | null> {
    const manager = getThreadingManager()
    if (!manager?.getRoomThread) return null
    try {
      return await manager.getRoomThread(roomId, threadId, includeReplies, replyLimit)
    } catch (err) {
      logger.error(`[MatrixThread] 获取线程详情失败: ${err}`)
      return null
    }
  }

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
  ): Promise<Record<string, unknown> | null> {
    const manager = getThreadingManager()
    if (!manager?.addThreadReply) return null
    try {
      return await manager.addThreadReply(roomId, threadId, content, inReplyToEventId)
    } catch (err) {
      logger.error(`[MatrixThread] 添加线程回复失败: ${err}`)
      throw err
    }
  }

  async getThreadRepliesViaApi(roomId: string, threadId: string): Promise<unknown[]> {
    const manager = getThreadingManager()
    if (!manager?.getThreadReplies) return []
    try {
      const result = await manager.getThreadReplies(roomId, threadId)
      return Array.isArray(result) ? result : []
    } catch (err) {
      logger.error(`[MatrixThread] 获取线程回复失败: ${err}`)
      return []
    }
  }

  async subscribeToThreadViaApi(
    roomId: string,
    threadId: string,
    notificationLevel = 'all'
  ): Promise<ThreadSubscription | null> {
    const manager = getThreadingManager()
    if (!manager?.subscribeToThread) return null
    try {
      return await manager.subscribeToThread(roomId, threadId, notificationLevel)
    } catch (err) {
      logger.error(`[MatrixThread] 订阅线程失败: ${err}`)
      throw err
    }
  }

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

  async muteThreadViaApi(roomId: string, threadId: string): Promise<ThreadSubscription | null> {
    const manager = getThreadingManager()
    if (!manager?.muteThread) return null
    try {
      return await manager.muteThread(roomId, threadId)
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
  ): Promise<Record<string, unknown> | null> {
    const manager = getThreadingManager()
    if (!manager?.markThreadRead) return null
    try {
      return await manager.markThreadRead(roomId, threadId, eventId, originServerTs)
    } catch (err) {
      logger.error(`[MatrixThread] 标记线程已读失败: ${err}`)
      return null
    }
  }

  async getThreadStatsViaApi(roomId: string, threadId: string): Promise<ThreadStatistics | null> {
    const manager = getThreadingManager()
    if (!manager?.getThreadStats) return null
    try {
      return await manager.getThreadStats(roomId, threadId)
    } catch (err) {
      logger.error(`[MatrixThread] 获取线程统计失败: ${err}`)
      return null
    }
  }

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
  ): Promise<{ chunk: unknown[]; nextBatch?: string }> {
    const manager = getThreadingManager()
    if (!manager?.getLegacyRoomThreadList) return { chunk: [] }
    try {
      const result = await manager.getLegacyRoomThreadList(userId, roomId, limit, from, includeAll)
      return { chunk: result.chunk ?? [], nextBatch: result.next_batch }
    } catch (err) {
      logger.error(`[MatrixThread] 获取兼容旧版线程列表失败: ${err}`)
      return { chunk: [] }
    }
  }
}
