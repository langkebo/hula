import type { MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface MessageEdit {
  eventId: string
  originalContent: any
  newContent: any
  timestamp: number
  sender: string
}

export interface ReplyChain {
  eventId: string
  content: any
  sender: string
  timestamp: number
  inReplyTo?: ReplyChain
}

export interface ThreadInfo {
  threadId: string
  rootEventId: string
  replyCount: number
  participants: string[]
  lastReply?: {
    eventId: string
    sender: string
    timestamp: number
  }
}

class MatrixMessageRelationService {
  async editMessage(
    roomId: string,
    originalEventId: string,
    newContent: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MessageRelation] 客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`[MessageRelation] 房间不存在: ${roomId}`)
      }

      const originalEvent = room.findEventById(originalEventId)
      if (!originalEvent) {
        throw new Error(`[MessageRelation] 原始消息不存在: ${originalEventId}`)
      }

      const myUserId = client.getUserId()
      if (originalEvent.getSender() !== myUserId) {
        throw new Error('[MessageRelation] 只能编辑自己发送的消息')
      }

      const content: any = {
        ...originalEvent.getContent(),
        msgtype: newContent.msgtype || 'm.text',
        body: `* ${newContent.body}`,
        'm.new_content': {
          msgtype: newContent.msgtype || 'm.text',
          body: newContent.body
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: originalEventId
        }
      }

      if (newContent.html) {
        content['m.new_content'].format = 'org.matrix.custom.html'
        content['m.new_content'].formatted_body = newContent.html
        content.format = 'org.matrix.custom.html'
        content.formatted_body = `* ${newContent.html}`
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MessageRelation] 编辑消息成功: ${originalEventId}`)
      return response.event_id
    } catch (err) {
      error(`[MessageRelation] 编辑消息失败: ${err}`)
      throw err
    }
  }

  async editMediaMessage(roomId: string, originalEventId: string, newCaption?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MessageRelation] 客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`[MessageRelation] 房间不存在: ${roomId}`)
      }

      const originalEvent = room.findEventById(originalEventId)
      if (!originalEvent) {
        throw new Error(`[MessageRelation] 原始消息不存在: ${originalEventId}`)
      }

      const myUserId = client.getUserId()
      if (originalEvent.getSender() !== myUserId) {
        throw new Error('[MessageRelation] 只能编辑自己发送的消息')
      }

      const originalContent = originalEvent.getContent()
      const newBody = newCaption || originalContent.body || ''

      const content: any = {
        ...originalContent,
        body: `* ${newBody}`,
        'm.new_content': {
          ...originalContent,
          body: newBody
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: originalEventId
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MessageRelation] 编辑媒体消息成功: ${originalEventId}`)
      return response.event_id
    } catch (err) {
      error(`[MessageRelation] 编辑媒体消息失败: ${err}`)
      throw err
    }
  }

  getEditHistory(roomId: string, eventId: string): MessageEdit[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const edits: MessageEdit[] = []
    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const event of events) {
      const content = event.getContent()
      const relatesTo = content['m.relates_to']

      if (relatesTo?.rel_type === 'm.replace' && relatesTo.event_id === eventId) {
        const newContent = content['m.new_content']
        edits.push({
          eventId: event.getId()!,
          originalContent: content,
          newContent: newContent,
          timestamp: event.getTs(),
          sender: event.getSender()!
        })
      }
    }

    return edits.sort((a, b) => a.timestamp - b.timestamp)
  }

  getLatestEdit(roomId: string, eventId: string): MatrixEvent | null {
    const client = matrixClientService.getClient()
    if (!client) return null

    const room = client.getRoom(roomId)
    if (!room) return null

    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    let latestEdit: MatrixEvent | null = null
    let latestTimestamp = 0

    for (const event of events) {
      const content = event.getContent()
      const relatesTo = content['m.relates_to']

      if (relatesTo?.rel_type === 'm.replace' && relatesTo.event_id === eventId) {
        if (event.getTs() > latestTimestamp) {
          latestTimestamp = event.getTs()
          latestEdit = event
        }
      }
    }

    return latestEdit
  }

  async replyToMessage(
    roomId: string,
    replyToEventId: string,
    content: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MessageRelation] 客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`[MessageRelation] 房间不存在: ${roomId}`)
      }

      const replyToEvent = room.findEventById(replyToEventId)
      if (!replyToEvent) {
        throw new Error(`[MessageRelation] 回复的消息不存在: ${replyToEventId}`)
      }

      const messageContent: any = {
        msgtype: content.msgtype || 'm.text',
        body: content.body,
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: replyToEventId
          }
        }
      }

      if (content.html) {
        messageContent.format = 'org.matrix.custom.html'
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, messageContent)
      info(`[MessageRelation] 回复消息成功: ${replyToEventId}`)
      return response.event_id
    } catch (err) {
      error(`[MessageRelation] 回复消息失败: ${err}`)
      throw err
    }
  }

  async replyInThread(
    roomId: string,
    threadRootId: string,
    content: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MessageRelation] 客户端未初始化')
    }

    try {
      const messageContent: any = {
        msgtype: content.msgtype || 'm.text',
        body: content.body,
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: threadRootId,
          'm.in_reply_to': {
            event_id: threadRootId
          }
        }
      }

      if (content.html) {
        messageContent.format = 'org.matrix.custom.html'
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, messageContent)
      info(`[MessageRelation] 线程回复成功: ${threadRootId}`)
      return response.event_id
    } catch (err) {
      error(`[MessageRelation] 线程回复失败: ${err}`)
      throw err
    }
  }

  getReplyChain(roomId: string, eventId: string, maxDepth: number = 10): ReplyChain[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const chain: ReplyChain[] = []
    let currentEventId: string | undefined = eventId
    let depth = 0

    while (currentEventId && depth < maxDepth) {
      const event = room.findEventById(currentEventId)
      if (!event) break

      const content = event.getContent()
      chain.push({
        eventId: currentEventId,
        content: content,
        sender: event.getSender()!,
        timestamp: event.getTs()
      })

      const relatesTo = content['m.relates_to']
      currentEventId = relatesTo?.['m.in_reply_to']?.event_id
      depth++
    }

    return chain
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

  getThreadInfo(roomId: string, threadRootId: string): ThreadInfo | null {
    const client = matrixClientService.getClient()
    if (!client) return null

    const room = client.getRoom(roomId)
    if (!room) return null

    const rootEvent = room.findEventById(threadRootId)
    if (!rootEvent) return null

    const replies = this.getThreadReplies(roomId, threadRootId)
    const participants = new Set<string>()
    let lastReply: { eventId: string; sender: string; timestamp: number } | undefined

    for (const reply of replies) {
      const sender = reply.getSender()
      if (sender) participants.add(sender)

      if (!lastReply || reply.getTs() > lastReply.timestamp) {
        lastReply = {
          eventId: reply.getId()!,
          sender: reply.getSender()!,
          timestamp: reply.getTs()
        }
      }
    }

    return {
      threadId: threadRootId,
      rootEventId: threadRootId,
      replyCount: replies.length,
      participants: Array.from(participants),
      lastReply
    }
  }

  getEventReplies(roomId: string, eventId: string): MatrixEvent[] {
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

      if (relatesTo?.['m.in_reply_to']?.event_id === eventId) {
        replies.push(event)
      }
    }

    return replies.sort((a, b) => a.getTs() - b.getTs())
  }

  isEdited(event: MatrixEvent): boolean {
    const content = event.getContent()
    return !!content['m.new_content']
  }

  getEditedContent(event: MatrixEvent): any {
    const content = event.getContent()
    if (content['m.new_content']) {
      return content['m.new_content']
    }
    return content
  }

  getReplyToEventId(event: MatrixEvent): string | null {
    const content = event.getContent()
    return content['m.relates_to']?.['m.in_reply_to']?.event_id || null
  }

  getThreadRootId(event: MatrixEvent): string | null {
    const content = event.getContent()
    const relatesTo = content['m.relates_to']
    if (relatesTo?.rel_type === 'm.thread') {
      return relatesTo.event_id || null
    }
    return null
  }
}

export const matrixMessageRelationService = new MatrixMessageRelationService()
export default matrixMessageRelationService
