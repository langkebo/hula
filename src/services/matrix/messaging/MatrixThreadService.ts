/** MatrixThreadService — orchestrator for the thread subsystem. Delegates *ViaApi to MatrixThreadApi, state to MatrixThreadState. */

import type { EventType, MatrixEvent } from 'matrix-js-sdk'
import { DEFAULT_PAGE_LIMIT, DEFAULT_SEARCH_LIMIT } from '@/common/constants'
import {
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType,
  MatrixRelType
} from '@/common/matrixConstants'
import type { Room } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { resolveMxcToHttp } from '../media/mxcUrl'
import { MatrixThreadApi } from './MatrixThreadApi'
import { MatrixThreadState } from './MatrixThreadState'
import type {
  MessageContent,
  Thread,
  ThreadDisplayMessage,
  ThreadMessage,
  ThreadReplyResponse,
  ThreadViewData
} from './threadTypes'
import { buildDisplayMessage, extractMediaMeta } from './threadUtils'

export type { Thread, ThreadDisplayMessage } from './threadTypes'

const logger = createLogger('MatrixThreadService')

class MatrixThreadService extends BaseMatrixService {
  private readonly api = new MatrixThreadApi()
  private readonly state = new MatrixThreadState((roomId, threadRootId) => this.getThreadReplies(roomId, threadRootId))

  // === Core: create / reply ===

  async createThread(
    roomId: string,
    rootEventId: string,
    initialReply?: { body: string; html?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      if (!initialReply) {
        return rootEventId
      }

      const content: MessageContent = {
        msgtype: MatrixMsgType.TEXT,
        body: initialReply.body,
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: rootEventId
        }
      }

      if (initialReply.html) {
        content.format = MatrixFormat.HTML
        content.formatted_body = initialReply.html
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE as EventType, content)
      logger.info(`[MatrixThread] 创建线程成功: ${rootEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MatrixThread] 创建线程失败: ${err}`)
      throw err
    }
  }

  async sendThreadReply(
    roomId: string,
    threadRootId: string,
    content: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const messageContent: MessageContent = {
        msgtype: (content.msgtype || MatrixMsgType.TEXT) as string,
        body: content.body,
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        }
      }

      if (content.html) {
        messageContent.format = MatrixFormat.HTML
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE as EventType, messageContent)
      logger.info(`[MatrixThread] 发送线程回复成功: ${threadRootId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MatrixThread] 发送线程回复失败: ${err}`)
      throw err
    }
  }

  // === Query methods (timeline-backed) ===

  getThread(roomId: string, threadRootId: string): Thread | null {
    const client = matrixClientService.getClient()
    if (!client) return null

    const room = client.getRoom(roomId)
    if (!room) return null

    const replies = this.getThreadReplies(roomId, threadRootId)
    const participants = new Set<string>()
    let lastReply: Thread['lastReply']

    for (const reply of replies) {
      const sender = reply.getSender()
      if (sender) participants.add(sender)

      if (!lastReply || reply.getTs() > lastReply.timestamp) {
        lastReply = {
          eventId: reply.getId()!,
          sender: reply.getSender()!,
          timestamp: reply.getTs(),
          content: reply.getContent()
        }
      }
    }

    return {
      id: threadRootId,
      rootEventId: threadRootId,
      roomId,
      replyCount: replies.length,
      lastReply,
      participants: Array.from(participants)
    }
  }

  getThreadReplies(roomId: string, threadRootId: string): MatrixEvent[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    // D14：开启 threadSupport 后 thread 回复不再进入房间主 timeline，
    // 必须优先读 SDK 的 Thread 模型：liveTimeline 持有回复，
    // createThread 时还会把 relations store 中该 root 的子事件一并合并。
    const sdkThread = room.getThread(threadRootId)
    if (sdkThread && sdkThread.events.length > 0) {
      return [...sdkThread.events].sort((a, b) => a.getTs() - b.getTs())
    }

    // fallback：threadSupport 关闭，或 Thread 尚未建立时仍从房间 timeline 扫描。
    const replies: MatrixEvent[] = []
    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const event of events) {
      const content = event.getContent() as MessageContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

      if (relatesTo?.rel_type === MatrixRelType.THREAD && relatesTo.event_id === threadRootId) {
        replies.push(event)
      }
    }

    return replies.sort((a, b) => a.getTs() - b.getTs())
  }

  getThreadMessages(roomId: string, threadRootId: string): ThreadMessage[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const messages: ThreadMessage[] = []
    const rootEvent = room.findEventById(threadRootId)

    if (rootEvent) {
      messages.push({
        eventId: threadRootId,
        sender: rootEvent.getSender()!,
        content: rootEvent.getContent(),
        timestamp: rootEvent.getTs()
      })
    }

    const replies = this.getThreadReplies(roomId, threadRootId)
    for (const reply of replies) {
      const content = reply.getContent() as MessageContent
      messages.push({
        eventId: reply.getId()!,
        sender: reply.getSender()!,
        content: reply.getContent(),
        timestamp: reply.getTs(),
        inReplyTo: content?.[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id
      })
    }

    return messages.sort((a, b) => a.timestamp - b.timestamp)
  }

  getThreadViewData(roomId: string, threadRootId: string): ThreadViewData {
    const client = matrixClientService.getClient()
    const room = client?.getRoom(roomId)
    if (!room) {
      return { thread: null, rootMessage: null, replies: [] }
    }

    const thread = this.getThread(roomId, threadRootId)
    const rootEvent = room.findEventById(threadRootId)
    const replies = this.getThreadReplies(roomId, threadRootId).map((reply) => buildDisplayMessage(room, reply))

    return {
      thread,
      rootMessage: rootEvent ? buildDisplayMessage(room, rootEvent) : null,
      replies
    }
  }

  /**
   * 分页拉取线程回复（移动端线程页使用）。
   *
   * matrix-js-sdk 的 Thread 只持有 live timeline，不支持线程级 back pagination；
   * synapse-rust 的 `getRoomThread` 支持 `replyLimit`，因此按窗口递增向服务端取
   * 更多回复，再与本地 SDK 事件按 eventId 合并去重。
   */
  async loadThreadRepliesPage(
    roomId: string,
    threadRootId: string,
    limit: number
  ): Promise<{ replies: ThreadDisplayMessage[]; total: number }> {
    const client = matrixClientService.getClient()
    const room = client?.getRoom(roomId)
    const local = room
      ? this.getThreadReplies(roomId, threadRootId).map((reply) => buildDisplayMessage(room, reply))
      : []

    let remoteReplies: ThreadDisplayMessage[] = []
    let total = local.length

    try {
      const detail = await this.api.getRoomThreadViaApi(roomId, threadRootId, true, limit)
      if (detail) {
        total = detail.reply_count ?? total
        remoteReplies = detail.replies
          .filter((reply) => !reply.is_redacted)
          .map((reply) => this.buildDisplayMessageFromReply(room ?? undefined, reply))
      }
    } catch (err) {
      logger.warn(`[MatrixThread] 分页拉取线程回复失败，回退本地缓存: ${err}`)
    }

    const merged = new Map<string, ThreadDisplayMessage>()
    for (const item of remoteReplies) merged.set(item.eventId, item)
    for (const item of local) {
      if (!merged.has(item.eventId)) merged.set(item.eventId, item)
    }

    const replies = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp)
    return { replies, total: Math.max(total, replies.length) }
  }

  /** 解析线程内媒体地址（mxc:// → https），供端上直接作为图片 src 使用 */
  resolveMediaUrl(mxcUrl?: string, size = 320): string | null {
    if (!mxcUrl) return null
    return resolveMxcToHttp(matrixClientService.getClient(), mxcUrl, size, size)
  }

  private buildDisplayMessageFromReply(room: Room | undefined, reply: ThreadReplyResponse): ThreadDisplayMessage {
    const content = reply.content as MessageContent
    const member = room?.getMember(reply.sender)

    return {
      eventId: reply.event_id,
      sender: reply.sender,
      senderName: member?.name || reply.sender,
      avatarUrl: member?.getMxcAvatarUrl() || undefined,
      content: typeof content.body === 'string' ? content.body : '',
      timestamp: reply.origin_server_ts,
      inReplyTo: reply.in_reply_to_event_id ?? undefined,
      ...extractMediaMeta(content)
    }
  }

  getThreadsInRoom(roomId: string): Thread[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    // D14：优先使用 SDK Thread 列表（含 fetchRoomThreads 为历史房间建好的讨论串）。
    const sdkThreads = room.getThreads()
    if (sdkThreads.length > 0) {
      return sdkThreads
        .map((sdkThread) => this.getThread(roomId, sdkThread.id))
        .filter((thread): thread is Thread => thread !== null)
        .sort((a, b) => (b.lastReply?.timestamp ?? 0) - (a.lastReply?.timestamp ?? 0))
    }

    // fallback：threadSupport 关闭，或 Thread 尚未建立时仍扫描房间 timeline 聚合。
    const threadRoots = new Map<string, Thread>()
    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const event of events) {
      const content = event.getContent() as MessageContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

      if (relatesTo?.rel_type === MatrixRelType.THREAD) {
        const threadRootId = relatesTo.event_id
        if (!threadRootId) continue

        if (!threadRoots.has(threadRootId)) {
          const rootEvent = room.findEventById(threadRootId)
          if (rootEvent) {
            threadRoots.set(threadRootId, {
              id: threadRootId,
              rootEventId: threadRootId,
              roomId,
              replyCount: 0,
              participants: []
            })
          }
        }

        const thread = threadRoots.get(threadRootId)
        if (thread) {
          thread.replyCount++
          const sender = event.getSender()
          if (sender && !thread.participants.includes(sender)) {
            thread.participants.push(sender)
          }

          if (!thread.lastReply || event.getTs() > thread.lastReply.timestamp) {
            thread.lastReply = {
              eventId: event.getId()!,
              sender: event.getSender()!,
              timestamp: event.getTs(),
              content: event.getContent()
            }
          }
        }
      }
    }

    return Array.from(threadRoots.values()).sort((a, b) => {
      const aTime = a.lastReply?.timestamp || 0
      const bTime = b.lastReply?.timestamp || 0
      return bTime - aTime
    })
  }

  async getUnreadThreads(roomId?: string): Promise<Thread[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const threads = roomId ? this.getThreadsInRoom(roomId) : []

    const unreadThreads: Thread[] = []
    const myUserId = client.getUserId()
    if (!myUserId) return []

    for (const thread of threads) {
      const unreadCount = await this.state.getThreadNotificationCount(roomId!, thread.id)
      if (unreadCount > 0) {
        unreadThreads.push(thread)
      }
    }

    logger.info(`[MatrixThread] 获取未读线程: ${unreadThreads.length} 个`)
    return unreadThreads
  }

  isThreadRoot(event: MatrixEvent) {
    return this.state.isThreadRoot(event)
  }
  isInThread(event: MatrixEvent) {
    return this.state.isInThread(event)
  }
  isBodyInThread(body: Record<string, unknown>) {
    return this.state.isBodyInThread(body)
  }
  getThreadRootId(event: MatrixEvent) {
    return this.state.getThreadRootId(event)
  }
  async markThreadAsRead(roomId: string, threadRootId: string) {
    return this.state.markThreadAsRead(roomId, threadRootId)
  }
  async getThreadNotificationCount(roomId: string, threadRootId: string) {
    return this.state.getThreadNotificationCount(roomId, threadRootId)
  }

  /** 通过 API 获取全局话题列表 */
  async getGlobalThreadListViaApi(limit = DEFAULT_PAGE_LIMIT, from?: string) {
    return this.api.getGlobalThreadListViaApi(limit, from)
  }
  async getSubscribedThreadsViaApi() {
    return this.api.getSubscribedThreadsViaApi()
  }
  async getGlobalUnreadThreadsViaApi() {
    return this.api.getGlobalUnreadThreadsViaApi()
  }
  async getRoomUnreadThreadsViaApi(roomId: string) {
    return this.api.getRoomUnreadThreadsViaApi(roomId)
  }
  async freezeThreadViaApi(roomId: string, threadId: string) {
    return this.api.freezeThreadViaApi(roomId, threadId)
  }
  async unfreezeThreadViaApi(roomId: string, threadId: string) {
    return this.api.unfreezeThreadViaApi(roomId, threadId)
  }
  async muteThreadViaApi(roomId: string, threadId: string) {
    return this.api.muteThreadViaApi(roomId, threadId)
  }
  async getThreadStatsViaApi(roomId: string, threadId: string) {
    return this.api.getThreadStatsViaApi(roomId, threadId)
  }
  async redactThreadReplyViaApi(roomId: string, eventId: string) {
    return this.api.redactThreadReplyViaApi(roomId, eventId)
  }
  async deleteRoomThreadViaApi(roomId: string, threadId: string) {
    return this.api.deleteRoomThreadViaApi(roomId, threadId)
  }
  async getThreadRepliesViaApi(roomId: string, threadId: string) {
    return this.api.getThreadRepliesViaApi(roomId, threadId)
  }
  async unsubscribeFromThreadViaApi(roomId: string, threadId: string) {
    return this.api.unsubscribeFromThreadViaApi(roomId, threadId)
  }
  /** 通过 API 创建全局话题 */
  async createGlobalThreadViaApi(roomId: string, rootEventId: string, content?: Record<string, unknown>) {
    return this.api.createGlobalThreadViaApi(roomId, rootEventId, content)
  }
  /** 通过 API 创建房间话题 */
  async createRoomThreadViaApi(roomId: string, rootEventId: string, content?: Record<string, unknown>) {
    return this.api.createRoomThreadViaApi(roomId, rootEventId, content)
  }
  async searchRoomThreadsViaApi(roomId: string, query: string, limit = DEFAULT_SEARCH_LIMIT) {
    return this.api.searchRoomThreadsViaApi(roomId, query, limit)
  }
  /** 通过 API 获取房间话题详情 */
  async getRoomThreadViaApi(roomId: string, threadId: string, includeReplies = true, replyLimit = 50) {
    return this.api.getRoomThreadViaApi(roomId, threadId, includeReplies, replyLimit)
  }
  /** 通过 API 获取房间话题列表 */
  async getRoomThreadListViaApi(roomId: string, limit = DEFAULT_PAGE_LIMIT, from?: string, includeAll = false) {
    return this.api.getRoomThreadListViaApi(roomId, limit, from, includeAll)
  }
  async addThreadReplyViaApi(
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ) {
    return this.api.addThreadReplyViaApi(roomId, threadId, content, inReplyToEventId)
  }
  /** 通过 API 订阅话题 */
  async subscribeToThreadViaApi(roomId: string, threadId: string, notificationLevel = 'all') {
    return this.api.subscribeToThreadViaApi(roomId, threadId, notificationLevel)
  }
  /** 通过 API 标记话题为已读 */
  async markThreadReadViaApi(roomId: string, threadId: string, eventId: string, originServerTs: number) {
    return this.api.markThreadReadViaApi(roomId, threadId, eventId, originServerTs)
  }
  /** 获取旧版房间话题列表 */
  async getLegacyRoomThreadList(
    userId: string,
    roomId: string,
    limit = DEFAULT_PAGE_LIMIT,
    from?: string,
    includeAll = false
  ) {
    return this.api.getLegacyRoomThreadList(userId, roomId, limit, from, includeAll)
  }
}

export const matrixThreadService = new MatrixThreadService()
