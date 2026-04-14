import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

export interface ThreadInfo {
  thread_id: string
  room_id: string
  root_event_id: string
  reply_count: number
  is_frozen: boolean
  is_subscribed: boolean
  is_muted: boolean
  last_reply_ts: number
}

export interface ThreadReply {
  event_id: string
  sender: string
  content: string
  timestamp: number
}

class MatrixThreadService extends BaseManager {
  private threadManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) return

    try {
      this.threadManager = (client as any).getThreadManager?.() ?? null
      if (this.threadManager) {
        this.initialized = true
        info('[Thread] 服务初始化成功 (SDK ThreadManager)')
      } else {
        this.initialized = true
      }
    } catch (error) {
      this.handleError(error, 'initialize', undefined, false)
    }
  }

  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  async getRoomThreads(
    roomId: string,
    limit: number = 50,
    from?: string,
    includeAll?: boolean,
    throwOnError = true
  ): Promise<ThreadInfo[]> {
    if (this.threadManager) {
      try {
        const threads = await this.threadManager.getRoomThreads(roomId, { limit, from, includeAll })
        return (threads ?? []).map((t: any) => ({
          thread_id: t.id ?? t.thread_id ?? '',
          room_id: roomId,
          root_event_id: t.rootEventId ?? t.root_event_id ?? '',
          reply_count: t.replyCount ?? t.reply_count ?? 0,
          is_frozen: t.isFrozen ?? t.is_frozen ?? false,
          is_subscribed: t.isSubscribed ?? t.is_subscribed ?? false,
          is_muted: t.isMuted ?? t.is_muted ?? false,
          last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
        }))
      } catch (error) {
        return this.handleError(error, 'getRoomThreads', [] as ThreadInfo[], throwOnError)
      }
    }

    try {
      const room = this.client.getRoom(roomId)
      if (!room) return []

      const threads: ThreadInfo[] = []
      const timeline = room.getLiveTimeline().getEvents()

      for (const event of timeline) {
        const wireContent = event.getWireContent() as any
        const relation = wireContent?.['m.relates_to']
        if (relation?.rel_type === 'm.thread') {
          const rootId = relation.event_id
          if (rootId && !threads.find((t) => t.root_event_id === rootId)) {
            threads.push({
              thread_id: rootId,
              room_id: roomId,
              root_event_id: rootId,
              reply_count: 0,
              is_frozen: false,
              is_subscribed: false,
              is_muted: false,
              last_reply_ts: event.getTs() ?? 0
            })
          }
        }
      }

      return threads.slice(0, limit)
    } catch (error) {
      return this.handleError(error, 'getRoomThreads', [] as ThreadInfo[], throwOnError)
    }
  }

  async getThreadReplies(
    roomId: string,
    threadId: string,
    limit: number = 50,
    from?: string,
    throwOnError = true
  ): Promise<ThreadReply[]> {
    if (this.threadManager) {
      try {
        const replies = await this.threadManager.getThreadReplies(roomId, threadId, { limit, from })
        return (replies ?? []).map((r: any) => ({
          event_id: r.getId?.() ?? r.event_id ?? '',
          sender: r.getSender?.() ?? r.sender ?? '',
          content: r.getContent?.()?.body ?? r.content ?? '',
          timestamp: r.getTs?.() ?? r.timestamp ?? 0
        }))
      } catch (error) {
        return this.handleError(error, 'getThreadReplies', [] as ThreadReply[], throwOnError)
      }
    }

    try {
      const room = this.client.getRoom(roomId)
      if (!room) return []

      const replies: ThreadReply[] = []
      const timeline = room.getLiveTimeline().getEvents()

      for (const event of timeline) {
        const wireContent = event.getWireContent() as any
        const relation = wireContent?.['m.relates_to']
        if (relation?.rel_type === 'm.thread' && relation.event_id === threadId) {
          replies.push({
            event_id: event.getId() ?? '',
            sender: event.getSender() ?? '',
            content: (event.getContent() as any)?.body ?? '',
            timestamp: event.getTs() ?? 0
          })
        }
      }

      return replies.slice(0, limit)
    } catch (error) {
      return this.handleError(error, 'getThreadReplies', [] as ThreadReply[], throwOnError)
    }
  }

  async subscribeToThread(
    roomId: string,
    threadId: string,
    notificationLevel: string = 'all',
    throwOnError = false
  ): Promise<boolean> {
    if (this.threadManager) {
      try {
        await this.threadManager.subscribeToThread(roomId, threadId, notificationLevel)
        info(`[Thread] 已订阅: ${threadId}`)
        return true
      } catch (error) {
        return this.handleError(error, 'subscribeToThread', false, throwOnError)
      }
    }
    return false
  }

  async unsubscribeFromThread(roomId: string, threadId: string, throwOnError = false): Promise<boolean> {
    if (this.threadManager) {
      try {
        await this.threadManager.unsubscribeFromThread(roomId, threadId)
        info(`[Thread] 已取消订阅: ${threadId}`)
        return true
      } catch (error) {
        return this.handleError(error, 'unsubscribeFromThread', false, throwOnError)
      }
    }
    return false
  }

  async muteThread(roomId: string, threadId: string, throwOnError = false): Promise<boolean> {
    if (this.threadManager) {
      try {
        await this.threadManager.muteThread(roomId, threadId)
        info(`[Thread] 已静音: ${threadId}`)
        return true
      } catch (error) {
        return this.handleError(error, 'muteThread', false, throwOnError)
      }
    }
    return false
  }

  async markThreadRead(
    roomId: string,
    threadId: string,
    eventId?: string,
    originServerTs?: number,
    throwOnError = false
  ): Promise<boolean> {
    if (this.threadManager) {
      try {
        await this.threadManager.markThreadRead(roomId, threadId, eventId, originServerTs)
        info(`[Thread] 已标记已读: ${threadId}`)
        return true
      } catch (error) {
        return this.handleError(error, 'markThreadRead', false, throwOnError)
      }
    }
    return false
  }

  async getGlobalThreadList(limit: number = 50, from?: string, throwOnError = true): Promise<ThreadInfo[]> {
    if (!this.threadManager) return []
    try {
      const threads = await this.threadManager.getGlobalThreadList({ limit, from })
      return (threads ?? []).map((t: any) => ({
        thread_id: t.id ?? t.thread_id ?? '',
        room_id: t.roomId ?? t.room_id ?? '',
        root_event_id: t.rootEventId ?? t.root_event_id ?? '',
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: t.isSubscribed ?? t.is_subscribed ?? false,
        is_muted: t.isMuted ?? t.is_muted ?? false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
      }))
    } catch (error) {
      return this.handleError(error, 'getGlobalThreadList', [] as ThreadInfo[], throwOnError)
    }
  }

  async getSubscribedThreads(throwOnError = true): Promise<ThreadInfo[]> {
    if (!this.threadManager) return []
    try {
      const threads = await this.threadManager.getSubscribedThreads()
      return (threads ?? []).map((t: any) => ({
        thread_id: t.id ?? t.thread_id ?? '',
        room_id: t.roomId ?? t.room_id ?? '',
        root_event_id: t.rootEventId ?? t.root_event_id ?? '',
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: true,
        is_muted: t.isMuted ?? t.is_muted ?? false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
      }))
    } catch (error) {
      return this.handleError(error, 'getSubscribedThreads', [] as ThreadInfo[], throwOnError)
    }
  }

  async getGlobalUnreadThreads(throwOnError = true): Promise<ThreadInfo[]> {
    if (!this.threadManager) return []
    try {
      const threads = await this.threadManager.getGlobalUnreadThreads()
      return (threads ?? []).map((t: any) => ({
        thread_id: t.id ?? t.thread_id ?? '',
        room_id: t.roomId ?? t.room_id ?? '',
        root_event_id: t.rootEventId ?? t.root_event_id ?? '',
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: t.isSubscribed ?? t.is_subscribed ?? false,
        is_muted: t.isMuted ?? t.is_muted ?? false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
      }))
    } catch (error) {
      return this.handleError(error, 'getGlobalUnreadThreads', [] as ThreadInfo[], throwOnError)
    }
  }

  async searchRoomThreads(
    roomId: string,
    query: string,
    limit: number = 50,
    throwOnError = true
  ): Promise<ThreadInfo[]> {
    if (!this.threadManager) return []
    try {
      const threads = await this.threadManager.searchRoomThreads(roomId, { query, limit })
      return (threads ?? []).map((t: any) => ({
        thread_id: t.id ?? t.thread_id ?? '',
        room_id: roomId,
        root_event_id: t.rootEventId ?? t.root_event_id ?? '',
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: t.isSubscribed ?? t.is_subscribed ?? false,
        is_muted: t.isMuted ?? t.is_muted ?? false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
      }))
    } catch (error) {
      return this.handleError(error, 'searchRoomThreads', [] as ThreadInfo[], throwOnError)
    }
  }

  async getRoomThread(roomId: string, threadId: string, throwOnError = true): Promise<ThreadInfo | null> {
    if (!this.threadManager) return null
    try {
      const t = await this.threadManager.getRoomThread(roomId, threadId)
      if (!t) return null
      return {
        thread_id: t.id ?? t.thread_id ?? threadId,
        room_id: roomId,
        root_event_id: t.rootEventId ?? t.root_event_id ?? '',
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: t.isSubscribed ?? t.is_subscribed ?? false,
        is_muted: t.isMuted ?? t.is_muted ?? false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
      }
    } catch (error) {
      return this.handleError(error, 'getRoomThread', null, throwOnError)
    }
  }

  async createRoomThread(
    roomId: string,
    rootEventId: string,
    options?: { content?: Record<string, unknown>; originServerTs?: number },
    throwOnError = false
  ): Promise<ThreadInfo | null> {
    if (!this.threadManager) return null
    try {
      const t = await this.threadManager.createRoomThread(roomId, rootEventId, options)
      if (!t) return null
      return {
        thread_id: t.id ?? t.thread_id ?? '',
        room_id: roomId,
        root_event_id: rootEventId,
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: true,
        is_muted: false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? Date.now()
      }
    } catch (error) {
      return this.handleError(error, 'createRoomThread', null, throwOnError)
    }
  }

  async deleteRoomThread(roomId: string, threadId: string, throwOnError = false): Promise<boolean> {
    if (!this.threadManager) return false
    try {
      await this.threadManager.deleteRoomThread(roomId, threadId)
      info(`[Thread] 已删除: ${threadId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'deleteRoomThread', false, throwOnError)
    }
  }

  async freezeThread(roomId: string, threadId: string, throwOnError = false): Promise<boolean> {
    if (!this.threadManager) return false
    try {
      await this.threadManager.freezeThread(roomId, threadId)
      info(`[Thread] 已冻结: ${threadId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'freezeThread', false, throwOnError)
    }
  }

  async unfreezeThread(roomId: string, threadId: string, throwOnError = false): Promise<boolean> {
    if (!this.threadManager) return false
    try {
      await this.threadManager.unfreezeThread(roomId, threadId)
      info(`[Thread] 已解冻: ${threadId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'unfreezeThread', false, throwOnError)
    }
  }

  async addThreadReply(
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    throwOnError = false
  ): Promise<string | null> {
    if (!this.threadManager) return null
    try {
      const result = await this.threadManager.addThreadReply(roomId, threadId, content)
      return result?.event_id ?? result?.eventId ?? null
    } catch (error) {
      return this.handleError(error, 'addThreadReply', null, throwOnError)
    }
  }

  async getThreadStats(
    roomId: string,
    threadId: string,
    throwOnError = true
  ): Promise<{ replyCount: number; unreadCount: number; lastReplyTs: number } | null> {
    if (!this.threadManager) return null
    try {
      return await this.threadManager.getThreadStats(roomId, threadId)
    } catch (error) {
      return this.handleError(error, 'getThreadStats', null, throwOnError)
    }
  }

  async redactThreadReply(roomId: string, eventId: string, reason?: string, throwOnError = false): Promise<boolean> {
    if (!this.threadManager) return false
    try {
      await this.threadManager.redactThreadReply(roomId, eventId, reason)
      return true
    } catch (error) {
      return this.handleError(error, 'redactThreadReply', false, throwOnError)
    }
  }

  async getRoomUnreadThreads(roomId: string, throwOnError = true): Promise<ThreadInfo[]> {
    if (!this.threadManager) return []
    try {
      const threads = await this.threadManager.getRoomUnreadThreads(roomId)
      return (threads ?? []).map((t: any) => ({
        thread_id: t.id ?? t.thread_id ?? '',
        room_id: roomId,
        root_event_id: t.rootEventId ?? t.root_event_id ?? '',
        reply_count: t.replyCount ?? t.reply_count ?? 0,
        is_frozen: t.isFrozen ?? t.is_frozen ?? false,
        is_subscribed: t.isSubscribed ?? t.is_subscribed ?? false,
        is_muted: t.isMuted ?? t.is_muted ?? false,
        last_reply_ts: t.lastReplyTs ?? t.last_reply_ts ?? 0
      }))
    } catch (error) {
      return this.handleError(error, 'getRoomUnreadThreads', [] as ThreadInfo[], throwOnError)
    }
  }
}

const matrixThreadService = new MatrixThreadService()
export default matrixThreadService
