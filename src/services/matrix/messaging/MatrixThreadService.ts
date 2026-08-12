/** MatrixThreadService — orchestrator for the thread subsystem. Delegates *ViaApi to MatrixThreadApi, state to MatrixThreadState. */

import type { EventType, MatrixEvent } from 'matrix-js-sdk'
import {
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType,
  MatrixRelType
} from '@/common/matrixConstants'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { MatrixThreadApi } from './MatrixThreadApi'
import { MatrixThreadState } from './MatrixThreadState'
import type { MessageContent, Thread, ThreadMessage, ThreadViewData } from './threadTypes'
import { buildDisplayMessage } from './threadUtils'

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

  getThreadsInRoom(roomId: string): Thread[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

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
  isThreadMuted(threadRootId: string) {
    return this.state.isThreadMuted(threadRootId)
  }
  isThreadFrozen(threadRootId: string) {
    return this.state.isThreadFrozen(threadRootId)
  }
  async freezeThread(roomId: string, threadRootId: string) {
    return this.state.freezeThread(roomId, threadRootId)
  }
  async unfreezeThread(roomId: string, threadRootId: string) {
    return this.state.unfreezeThread(roomId, threadRootId)
  }
  async markThreadAsRead(roomId: string, threadRootId: string) {
    return this.state.markThreadAsRead(roomId, threadRootId)
  }
  async muteThread(roomId: string, threadRootId: string, mute: boolean) {
    return this.state.muteThread(roomId, threadRootId, mute)
  }
  async getThreadNotificationCount(roomId: string, threadRootId: string) {
    return this.state.getThreadNotificationCount(roomId, threadRootId)
  }

  async getGlobalThreadListViaApi(limit = 50, from?: string) {
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
  async createGlobalThreadViaApi(roomId: string, rootEventId: string, content?: Record<string, unknown>) {
    return this.api.createGlobalThreadViaApi(roomId, rootEventId, content)
  }
  async createRoomThreadViaApi(roomId: string, rootEventId: string, content?: Record<string, unknown>) {
    return this.api.createRoomThreadViaApi(roomId, rootEventId, content)
  }
  async searchRoomThreadsViaApi(roomId: string, query: string, limit = 20) {
    return this.api.searchRoomThreadsViaApi(roomId, query, limit)
  }
  async getRoomThreadViaApi(roomId: string, threadId: string, includeReplies = true, replyLimit = 50) {
    return this.api.getRoomThreadViaApi(roomId, threadId, includeReplies, replyLimit)
  }
  async getRoomThreadListViaApi(roomId: string, limit = 50, from?: string, includeAll = false) {
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
  async subscribeToThreadViaApi(roomId: string, threadId: string, notificationLevel = 'all') {
    return this.api.subscribeToThreadViaApi(roomId, threadId, notificationLevel)
  }
  async markThreadReadViaApi(roomId: string, threadId: string, eventId: string, originServerTs: number) {
    return this.api.markThreadReadViaApi(roomId, threadId, eventId, originServerTs)
  }
  async getLegacyRoomThreadList(userId: string, roomId: string, limit = 50, from?: string, includeAll = false) {
    return this.api.getLegacyRoomThreadList(userId, roomId, limit, from, includeAll)
  }
}

export const matrixThreadService = new MatrixThreadService()
