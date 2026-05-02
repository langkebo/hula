import { error, info } from '@tauri-apps/plugin-log'
import type { EventType, MatrixEvent, Room } from 'matrix-js-sdk'
import {
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType,
  MatrixRelType
} from '@/common/matrixConstants'
import matrixClientService from '../MatrixClientService'
import { matrixReceiptService } from './MatrixReceiptService'

type MsgType = string

interface IContent {
  [key: string]: unknown
}

interface RelatesTo {
  rel_type: string
  event_id?: string
  'm.in_reply_to'?: {
    event_id?: string
  }
}

interface MessageContent {
  msgtype?: MsgType
  body: string
  format?: string
  formatted_body?: string
  'm.relates_to'?: RelatesTo
  mute?: boolean
  frozen?: boolean
  freeze?: boolean
  [key: string]: unknown
}

export interface Thread {
  id: string
  rootEventId: string
  roomId: string
  replyCount: number
  lastReply?: {
    eventId: string
    sender: string
    timestamp: number
    content: IContent
  }
  participants: string[]
}

export interface ThreadMessage {
  eventId: string
  sender: string
  content: IContent
  timestamp: number
  inReplyTo?: string
}

export interface ThreadDisplayMessage {
  eventId: string
  sender: string
  senderName: string
  avatarUrl?: string
  content: string
  timestamp: number
  inReplyTo?: string
}

export interface ThreadViewData {
  thread: Thread | null
  rootMessage: ThreadDisplayMessage | null
  replies: ThreadDisplayMessage[]
}

export interface ThreadListItem {
  id: string
  roomId: string
  threadId: string
  rootEventId: string
  rootSender: string
  rootContent: unknown
  rootOriginServerTs: number
  latestEventId: string
  latestSender: string
  latestContent: unknown
  latestOriginServerTs: number
  replyCount: number
  participants: string[]
  isFrozen: boolean
  createdTs: number
  updatedTs?: number
}

export interface ThreadStatistics {
  totalReplies: number
  totalParticipants: number
  totalEdits: number
  totalRedactions: number
  firstReplyTs?: number
  lastReplyTs?: number
  avgReplyTimeMs?: number
}

export interface ThreadSubscription {
  notificationLevel: string
  isMuted: boolean
  subscribedTs?: number
}

interface ThreadingManagerCompat {
  getGlobalThreadList?: (
    limit?: number,
    from?: string
  ) => Promise<{ threads: unknown[]; next_batch?: string; total: number }>
  createGlobalThread?: (
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  getSubscribedThreads?: () => Promise<unknown[]>
  getGlobalUnreadThreads?: () => Promise<unknown[]>
  createRoomThread?: (
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  getRoomThreadList?: (
    roomId: string,
    limit?: number,
    from?: string,
    includeAll?: boolean
  ) => Promise<{ threads: ThreadListItem[]; next_batch?: string }>
  searchRoomThreads?: (roomId: string, query: string, limit?: number) => Promise<ThreadListItem[]>
  getRoomUnreadThreads?: (roomId: string) => Promise<unknown[]>
  getRoomThread?: (
    roomId: string,
    threadId: string,
    includeReplies?: boolean,
    replyLimit?: number
  ) => Promise<Record<string, unknown> | null>
  deleteRoomThread?: (roomId: string, threadId: string) => Promise<void>
  freezeThread?: (roomId: string, threadId: string) => Promise<void>
  unfreezeThread?: (roomId: string, threadId: string) => Promise<void>
  addThreadReply?: (
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ) => Promise<Record<string, unknown>>
  getThreadReplies?: (roomId: string, threadId: string) => Promise<unknown[]>
  subscribeToThread?: (roomId: string, threadId: string, notificationLevel: string) => Promise<ThreadSubscription>
  unsubscribeFromThread?: (roomId: string, threadId: string) => Promise<void>
  muteThread?: (roomId: string, threadId: string) => Promise<ThreadSubscription>
  markThreadRead?: (
    roomId: string,
    threadId: string,
    eventId: string,
    originServerTs: number
  ) => Promise<Record<string, unknown>>
  getThreadStats?: (roomId: string, threadId: string) => Promise<ThreadStatistics | null>
  redactThreadReply?: (roomId: string, eventId: string) => Promise<void>
  getLegacyRoomThreadList?: (
    userId: string,
    roomId: string,
    limit?: number,
    from?: string,
    includeAll?: boolean
  ) => Promise<{ chunk: unknown[]; next_batch?: string }>
}

class MatrixThreadService {
  private getThreadingManager(): ThreadingManagerCompat | null {
    const client = matrixClientService.getClient()
    if (!client) return null
    return (client as unknown as { threadingManager?: ThreadingManagerCompat }).threadingManager ?? null
  }

  private buildDisplayMessage(room: Room, event: MatrixEvent): ThreadDisplayMessage {
    const sender = event.getSender() || ''
    const member = room.getMember(sender)
    const content = event.getContent() as MessageContent

    return {
      eventId: event.getId() || '',
      sender,
      senderName: member?.name || sender,
      avatarUrl: member?.getMxcAvatarUrl() || undefined,
      content: content.body || '',
      timestamp: event.getTs(),
      inReplyTo: content?.[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id
    }
  }

  async createThread(
    roomId: string,
    rootEventId: string,
    initialReply?: { body: string; html?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixThread] 客户端未初始化')
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
      info(`[MatrixThread] 创建线程成功: ${rootEventId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixThread] 创建线程失败: ${err}`)
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
      throw new Error('[MatrixThread] 客户端未初始化')
    }

    try {
      const messageContent: MessageContent = {
        msgtype: (content.msgtype || MatrixMsgType.TEXT) as MsgType,
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
      info(`[MatrixThread] 发送线程回复成功: ${threadRootId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixThread] 发送线程回复失败: ${err}`)
      throw err
    }
  }

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
    if (!client) {
      return {
        thread: null,
        rootMessage: null,
        replies: []
      }
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return {
        thread: null,
        rootMessage: null,
        replies: []
      }
    }

    const thread = this.getThread(roomId, threadRootId)
    const rootEvent = room.findEventById(threadRootId)
    const replies = this.getThreadReplies(roomId, threadRootId).map((reply) => this.buildDisplayMessage(room, reply))

    return {
      thread,
      rootMessage: rootEvent ? this.buildDisplayMessage(room, rootEvent) : null,
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

  isThreadRoot(event: MatrixEvent): boolean {
    const client = matrixClientService.getClient()
    if (!client) return false

    const room = client.getRoom(event.getRoomId()!)
    if (!room) return false

    const eventId = event.getId()
    if (!eventId) return false

    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const e of events) {
      const content = e.getContent() as MessageContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

      if (relatesTo?.rel_type === MatrixRelType.THREAD && relatesTo.event_id === eventId) {
        return true
      }
    }

    return false
  }

  isInThread(event: MatrixEvent): boolean {
    const content = event.getContent() as MessageContent
    const relatesTo = content?.[MatrixContentField.RELATES_TO]
    return relatesTo?.rel_type === MatrixRelType.THREAD
  }

  isBodyInThread(body: Record<string, unknown>): boolean {
    const relatesTo = body[MatrixContentField.RELATES_TO] as { rel_type?: string } | undefined
    return relatesTo?.rel_type === MatrixRelType.THREAD
  }

  getThreadRootId(event: MatrixEvent): string | null {
    const content = event.getContent() as MessageContent
    const relatesTo = content?.[MatrixContentField.RELATES_TO]
    if (relatesTo?.rel_type === MatrixRelType.THREAD) {
      return relatesTo.event_id || null
    }
    return null
  }

  async getThreadNotificationCount(roomId: string, threadRootId: string): Promise<number> {
    const client = matrixClientService.getClient()
    if (!client) return 0

    const room = client.getRoom(roomId)
    if (!room) return 0

    const myUserId = client.getUserId()
    if (!myUserId) return 0

    const receipt = room.getEventReadUpTo(myUserId, false)
    const replies = this.getThreadReplies(roomId, threadRootId)

    let unreadCount = 0
    for (const reply of replies) {
      if (reply.getId() === receipt) break
      if (reply.getSender() !== myUserId) {
        unreadCount++
      }
    }

    return unreadCount
  }

  async markThreadAsRead(roomId: string, threadRootId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) return

    const replies = this.getThreadReplies(roomId, threadRootId)
    const lastReply = replies[replies.length - 1]

    if (lastReply) {
      await matrixReceiptService.sendReadReceiptByEventId(roomId, lastReply.getId()!)
      info(`[MatrixThread] 标记线程已读: ${threadRootId}`)
    }
  }

  async muteThread(roomId: string, threadRootId: string, mute: boolean): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixThread] 客户端未初始化')
    }

    try {
      await client.sendEvent(roomId, 'm.thread_mute' as EventType, {
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        },
        mute: mute
      })
      info(`[MatrixThread] ${mute ? '静音' : '取消静音'}线程成功: ${threadRootId}`)
    } catch (err) {
      error(`[MatrixThread] ${mute ? '静音' : '取消静音'}线程失败: ${err}`)
      throw err
    }
  }

  async freezeThread(roomId: string, threadRootId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixThread] 客户端未初始化')
    }

    try {
      await client.sendEvent(roomId, 'm.thread_freeze' as EventType, {
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        }
      })
      info(`[MatrixThread] 冻结线程成功: ${threadRootId}`)
    } catch (err) {
      error(`[MatrixThread] 冻结线程失败: ${err}`)
      throw err
    }
  }

  async unfreezeThread(roomId: string, threadRootId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixThread] 客户端未初始化')
    }

    try {
      await client.sendEvent(roomId, 'm.thread_unfreeze' as EventType, {
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        }
      })
      info(`[MatrixThread] 解冻线程成功: ${threadRootId}`)
    } catch (err) {
      error(`[MatrixThread] 解冻线程失败: ${err}`)
      throw err
    }
  }

  async getUnreadThreads(roomId?: string): Promise<Thread[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const threads = roomId ? this.getThreadsInRoom(roomId) : []

    const unreadThreads: Thread[] = []
    const myUserId = client.getUserId()
    if (!myUserId) return []

    for (const thread of threads) {
      const unreadCount = await this.getThreadNotificationCount(roomId!, thread.id)
      if (unreadCount > 0) {
        unreadThreads.push(thread)
      }
    }

    info(`[MatrixThread] 获取未读线程: ${unreadThreads.length} 个`)
    return unreadThreads
  }

  isThreadMuted(threadRootId: string): boolean {
    const client = matrixClientService.getClient()
    if (!client) return false

    const rooms = client.getRooms()
    for (const room of rooms) {
      const timelineSet = room.getUnfilteredTimelineSet()
      const events = timelineSet.getLiveTimeline().getEvents()

      for (const event of events) {
        const content = event.getContent() as MessageContent
        const relatesTo = content[MatrixContentField.RELATES_TO]

        if (
          relatesTo?.rel_type === MatrixRelType.THREAD &&
          relatesTo.event_id === threadRootId &&
          content.mute === true
        ) {
          return true
        }
      }
    }

    return false
  }

  isThreadFrozen(threadRootId: string): boolean {
    const client = matrixClientService.getClient()
    if (!client) return false

    const rooms = client.getRooms()
    for (const room of rooms) {
      const timelineSet = room.getUnfilteredTimelineSet()
      const events = timelineSet.getLiveTimeline().getEvents()

      for (const event of events) {
        const content = event.getContent() as MessageContent
        const relatesTo = content[MatrixContentField.RELATES_TO]

        if (
          relatesTo?.rel_type === MatrixRelType.THREAD &&
          relatesTo.event_id === threadRootId &&
          (content.frozen !== undefined || content.freeze !== undefined)
        ) {
          return true
        }
      }
    }

    return false
  }

  async getGlobalThreadListViaApi(
    limit = 50,
    from?: string
  ): Promise<{ threads: unknown[]; nextBatch?: string; total: number }> {
    const manager = this.getThreadingManager()
    if (!manager?.getGlobalThreadList) return { threads: [], total: 0 }
    try {
      const result = await manager.getGlobalThreadList(limit, from)
      return { threads: result.threads, nextBatch: result.next_batch, total: result.total }
    } catch (err) {
      error(`[MatrixThread] 获取全局线程列表失败: ${err}`)
      return { threads: [], total: 0 }
    }
  }

  async createGlobalThreadViaApi(
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const manager = this.getThreadingManager()
    if (!manager?.createGlobalThread) return null
    try {
      return await manager.createGlobalThread(roomId, rootEventId, content)
    } catch (err) {
      error(`[MatrixThread] 全局创建线程失败: ${err}`)
      throw err
    }
  }

  async getSubscribedThreadsViaApi(): Promise<unknown[]> {
    const manager = this.getThreadingManager()
    if (!manager?.getSubscribedThreads) return []
    try {
      const result = await manager.getSubscribedThreads()
      return Array.isArray(result) ? result : []
    } catch (err) {
      error(`[MatrixThread] 获取已订阅线程失败: ${err}`)
      return []
    }
  }

  async getGlobalUnreadThreadsViaApi(): Promise<unknown[]> {
    const manager = this.getThreadingManager()
    if (!manager?.getGlobalUnreadThreads) return []
    try {
      const result = await manager.getGlobalUnreadThreads()
      return Array.isArray(result) ? result : []
    } catch (err) {
      error(`[MatrixThread] 获取全局未读线程失败: ${err}`)
      return []
    }
  }

  async createRoomThreadViaApi(
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const manager = this.getThreadingManager()
    if (!manager?.createRoomThread) return null
    try {
      return await manager.createRoomThread(roomId, rootEventId, content)
    } catch (err) {
      error(`[MatrixThread] 房间内创建线程失败: ${err}`)
      throw err
    }
  }

  async getRoomThreadListViaApi(
    roomId: string,
    limit = 50,
    from?: string,
    includeAll = false
  ): Promise<{ threads: ThreadListItem[]; nextBatch?: string }> {
    const manager = this.getThreadingManager()
    if (!manager?.getRoomThreadList) return { threads: [] }
    try {
      const result = await manager.getRoomThreadList(roomId, limit, from, includeAll)
      return { threads: result.threads ?? [], nextBatch: result.next_batch }
    } catch (err) {
      error(`[MatrixThread] 获取房间线程列表失败: ${err}`)
      return { threads: [] }
    }
  }

  async searchRoomThreadsViaApi(roomId: string, query: string, limit = 20): Promise<ThreadListItem[]> {
    const manager = this.getThreadingManager()
    if (!manager?.searchRoomThreads) return []
    try {
      return (await manager.searchRoomThreads(roomId, query, limit)) ?? []
    } catch (err) {
      error(`[MatrixThread] 搜索房间线程失败: ${err}`)
      return []
    }
  }

  async getRoomUnreadThreadsViaApi(roomId: string): Promise<unknown[]> {
    const manager = this.getThreadingManager()
    if (!manager?.getRoomUnreadThreads) return []
    try {
      const result = await manager.getRoomUnreadThreads(roomId)
      return Array.isArray(result) ? result : []
    } catch (err) {
      error(`[MatrixThread] 获取房间未读线程失败: ${err}`)
      return []
    }
  }

  async getRoomThreadViaApi(
    roomId: string,
    threadId: string,
    includeReplies = true,
    replyLimit = 50
  ): Promise<Record<string, unknown> | null> {
    const manager = this.getThreadingManager()
    if (!manager?.getRoomThread) return null
    try {
      return await manager.getRoomThread(roomId, threadId, includeReplies, replyLimit)
    } catch (err) {
      error(`[MatrixThread] 获取线程详情失败: ${err}`)
      return null
    }
  }

  async deleteRoomThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = this.getThreadingManager()
    if (!manager?.deleteRoomThread) throw new Error('[MatrixThread] ThreadingManager 不可用')
    try {
      await manager.deleteRoomThread(roomId, threadId)
    } catch (err) {
      error(`[MatrixThread] 删除线程失败: ${err}`)
      throw err
    }
  }

  async freezeThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = this.getThreadingManager()
    if (!manager?.freezeThread) throw new Error('[MatrixThread] ThreadingManager 不可用')
    try {
      await manager.freezeThread(roomId, threadId)
    } catch (err) {
      error(`[MatrixThread] 冻结线程失败: ${err}`)
      throw err
    }
  }

  async unfreezeThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = this.getThreadingManager()
    if (!manager?.unfreezeThread) throw new Error('[MatrixThread] ThreadingManager 不可用')
    try {
      await manager.unfreezeThread(roomId, threadId)
    } catch (err) {
      error(`[MatrixThread] 解冻线程失败: ${err}`)
      throw err
    }
  }

  async addThreadReplyViaApi(
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ): Promise<Record<string, unknown> | null> {
    const manager = this.getThreadingManager()
    if (!manager?.addThreadReply) return null
    try {
      return await manager.addThreadReply(roomId, threadId, content, inReplyToEventId)
    } catch (err) {
      error(`[MatrixThread] 添加线程回复失败: ${err}`)
      throw err
    }
  }

  async getThreadRepliesViaApi(roomId: string, threadId: string): Promise<unknown[]> {
    const manager = this.getThreadingManager()
    if (!manager?.getThreadReplies) return []
    try {
      const result = await manager.getThreadReplies(roomId, threadId)
      return Array.isArray(result) ? result : []
    } catch (err) {
      error(`[MatrixThread] 获取线程回复失败: ${err}`)
      return []
    }
  }

  async subscribeToThreadViaApi(
    roomId: string,
    threadId: string,
    notificationLevel = 'all'
  ): Promise<ThreadSubscription | null> {
    const manager = this.getThreadingManager()
    if (!manager?.subscribeToThread) return null
    try {
      return await manager.subscribeToThread(roomId, threadId, notificationLevel)
    } catch (err) {
      error(`[MatrixThread] 订阅线程失败: ${err}`)
      throw err
    }
  }

  async unsubscribeFromThreadViaApi(roomId: string, threadId: string): Promise<void> {
    const manager = this.getThreadingManager()
    if (!manager?.unsubscribeFromThread) throw new Error('[MatrixThread] ThreadingManager 不可用')
    try {
      await manager.unsubscribeFromThread(roomId, threadId)
    } catch (err) {
      error(`[MatrixThread] 取消订阅线程失败: ${err}`)
      throw err
    }
  }

  async muteThreadViaApi(roomId: string, threadId: string): Promise<ThreadSubscription | null> {
    const manager = this.getThreadingManager()
    if (!manager?.muteThread) return null
    try {
      return await manager.muteThread(roomId, threadId)
    } catch (err) {
      error(`[MatrixThread] 静音线程失败: ${err}`)
      throw err
    }
  }

  async markThreadReadViaApi(
    roomId: string,
    threadId: string,
    eventId: string,
    originServerTs: number
  ): Promise<Record<string, unknown> | null> {
    const manager = this.getThreadingManager()
    if (!manager?.markThreadRead) return null
    try {
      return await manager.markThreadRead(roomId, threadId, eventId, originServerTs)
    } catch (err) {
      error(`[MatrixThread] 标记线程已读失败: ${err}`)
      return null
    }
  }

  async getThreadStatsViaApi(roomId: string, threadId: string): Promise<ThreadStatistics | null> {
    const manager = this.getThreadingManager()
    if (!manager?.getThreadStats) return null
    try {
      return await manager.getThreadStats(roomId, threadId)
    } catch (err) {
      error(`[MatrixThread] 获取线程统计失败: ${err}`)
      return null
    }
  }

  async redactThreadReplyViaApi(roomId: string, eventId: string): Promise<void> {
    const manager = this.getThreadingManager()
    if (!manager?.redactThreadReply) throw new Error('[MatrixThread] ThreadingManager 不可用')
    try {
      await manager.redactThreadReply(roomId, eventId)
    } catch (err) {
      error(`[MatrixThread] 撤回线程回复失败: ${err}`)
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
    const manager = this.getThreadingManager()
    if (!manager?.getLegacyRoomThreadList) return { chunk: [] }
    try {
      const result = await manager.getLegacyRoomThreadList(userId, roomId, limit, from, includeAll)
      return { chunk: result.chunk ?? [], nextBatch: result.next_batch }
    } catch (err) {
      error(`[MatrixThread] 获取兼容旧版线程列表失败: ${err}`)
      return { chunk: [] }
    }
  }
}

export const matrixThreadService = new MatrixThreadService()
export default matrixThreadService
