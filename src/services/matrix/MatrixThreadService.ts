import type { MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface Thread {
  id: string
  rootEventId: string
  roomId: string
  replyCount: number
  lastReply?: {
    eventId: string
    sender: string
    timestamp: number
    content: any
  }
  participants: string[]
}

export interface ThreadMessage {
  eventId: string
  sender: string
  content: any
  timestamp: number
  inReplyTo?: string
}

class MatrixThreadService {
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

      const content: any = {
        msgtype: 'm.text',
        body: initialReply.body,
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: rootEventId
        }
      }

      if (initialReply.html) {
        content.format = 'org.matrix.custom.html'
        content.formatted_body = initialReply.html
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
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
      const messageContent: any = {
        msgtype: content.msgtype || 'm.text',
        body: content.body,
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: threadRootId
        }
      }

      if (content.html) {
        messageContent.format = 'org.matrix.custom.html'
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, messageContent)
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

    const rootEvent = room.findEventById(threadRootId)
    if (!rootEvent) return null

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
      const content = event.getContent()
      const relatesTo = content['m.relates_to']

      if (relatesTo?.rel_type === 'm.thread' && relatesTo.event_id === threadRootId) {
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
      const content = reply.getContent() as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } }
      messages.push({
        eventId: reply.getId()!,
        sender: reply.getSender()!,
        content: reply.getContent(),
        timestamp: reply.getTs(),
        inReplyTo: content?.['m.relates_to']?.['m.in_reply_to']?.event_id
      })
    }

    return messages.sort((a, b) => a.timestamp - b.timestamp)
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
      const content = event.getContent()
      const relatesTo = content['m.relates_to']

      if (relatesTo?.rel_type === 'm.thread') {
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
      const content = e.getContent()
      const relatesTo = content['m.relates_to']

      if (relatesTo?.rel_type === 'm.thread' && relatesTo.event_id === eventId) {
        return true
      }
    }

    return false
  }

  isInThread(event: MatrixEvent): boolean {
    const content = event.getContent() as { 'm.relates_to'?: { rel_type?: string } }
    const relatesTo = content?.['m.relates_to']
    return relatesTo?.rel_type === 'm.thread'
  }

  getThreadRootId(event: MatrixEvent): string | null {
    const content = event.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } }
    const relatesTo = content?.['m.relates_to']
    if (relatesTo?.rel_type === 'm.thread') {
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
      await client.sendReadReceipt(lastReply)
      info(`[MatrixThread] 标记线程已读: ${threadRootId}`)
    }
  }
}

export const matrixThreadService = new MatrixThreadService()
export default matrixThreadService
