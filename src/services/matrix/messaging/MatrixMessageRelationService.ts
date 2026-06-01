import type { MatrixEvent } from 'matrix-js-sdk'
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

const logger = createLogger('MatrixMessageRelationService')

type RelatesTo = {
  rel_type?: string
  event_id?: string
  'm.in_reply_to'?: { event_id: string }
}

type RelationContent = Record<string, unknown> & {
  'm.relates_to'?: RelatesTo
  'm.new_content'?: Record<string, unknown>
}

export interface MessageEdit {
  eventId: string
  originalContent: Record<string, unknown>
  newContent: Record<string, unknown>
  timestamp: number
  sender: string
}

export interface ReplyChain {
  eventId: string
  content: Record<string, unknown>
  sender: string
  timestamp: number
  inReplyTo?: ReplyChain
}

export interface ReplyContent {
  msgtype: string
  body: string
  format?: string
  formatted_body?: string
  [MatrixContentField.RELATES_TO]: {
    'm.in_reply_to': {
      event_id: string
    }
  }
}

export interface RichContent {
  msgtype: string
  body: string
  format?: string
  formatted_body?: string
  'm.new_content'?: {
    msgtype: string
    body: string
    format?: string
    formatted_body?: string
  }
  'm.relates_to'?: {
    rel_type: string
    event_id: string
  }
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

export interface RelationsResponse {
  chunk: Array<Record<string, unknown>>
  next_batch?: string
  prev_batch?: string
}

export interface AggregationItem {
  type: string
  key: string
  count: number
}

export interface AggregationsResponse {
  chunk: AggregationItem[]
}

export interface SendRelationResponse {
  event_id: string
  room_id: string
  relates_to: {
    event_id: string
    rel_type: string
  }
}

class MatrixMessageRelationService extends BaseMatrixService {
  async editMessage(
    roomId: string,
    originalEventId: string,
    newContent: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const originalEvent = room.findEventById(originalEventId)
      if (!originalEvent) {
        throw new Error(this.t('matrix_error.messaging.original_message_not_found', { originalEventId }))
      }

      const myUserId = client.getUserId()
      if (originalEvent.getSender() !== myUserId) {
        throw new Error(this.t('matrix_error.messaging.can_only_edit_own_messages'))
      }

      const content: Record<string, unknown> = {
        ...(originalEvent.getContent() as RelationContent),
        msgtype: newContent.msgtype || MatrixMsgType.TEXT,
        body: `* ${newContent.body}`,
        'm.new_content': {
          msgtype: newContent.msgtype || MatrixMsgType.TEXT,
          body: newContent.body
        },
        [MatrixContentField.RELATES_TO]: {
          rel_type: 'm.replace',
          event_id: originalEventId
        }
      }

      if (newContent.html) {
        const newContentObj = content['m.new_content'] as RelationContent
        newContentObj.format = MatrixFormat.HTML
        newContentObj.formatted_body = newContent.html
        content.format = MatrixFormat.HTML
        content.formatted_body = `* ${newContent.html}`
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
      logger.info(`[MessageRelation] 编辑消息成功: ${originalEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 编辑消息失败: ${err}`)
      throw err
    }
  }

  async editMediaMessage(roomId: string, originalEventId: string, newCaption?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const originalEvent = room.findEventById(originalEventId)
      if (!originalEvent) {
        throw new Error(this.t('matrix_error.messaging.original_message_not_found', { originalEventId }))
      }

      const myUserId = client.getUserId()
      if (originalEvent.getSender() !== myUserId) {
        throw new Error(this.t('matrix_error.messaging.can_only_edit_own_messages'))
      }

      const originalContent = originalEvent.getContent() as RelationContent
      const newBody = newCaption || (originalContent.body as string) || ''

      const content: Record<string, unknown> = {
        ...originalContent,
        body: `* ${newBody}`,
        'm.new_content': {
          ...originalContent,
          body: newBody
        },
        [MatrixContentField.RELATES_TO]: {
          rel_type: 'm.replace',
          event_id: originalEventId
        }
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
      logger.info(`[MessageRelation] 编辑媒体消息成功: ${originalEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 编辑媒体消息失败: ${err}`)
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
      const content = event.getContent() as RelationContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

      if (relatesTo?.rel_type === 'm.replace' && relatesTo.event_id === eventId) {
        const newContent = content['m.new_content']
        edits.push({
          eventId: event.getId()!,
          originalContent: content,
          newContent: newContent ?? {},
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
      const content = event.getContent() as RelationContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

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
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const replyToEvent = room.findEventById(replyToEventId)
      if (!replyToEvent) {
        throw new Error(this.t('matrix_error.messaging.reply_message_not_found', { replyToEventId }))
      }

      const messageContent: Record<string, unknown> = {
        msgtype: content.msgtype || MatrixMsgType.TEXT,
        body: content.body,
        [MatrixContentField.RELATES_TO]: {
          'm.in_reply_to': {
            event_id: replyToEventId
          }
        }
      }

      if (content.html) {
        messageContent.format = MatrixFormat.HTML
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, messageContent)
      logger.info(`[MessageRelation] 回复消息成功: ${replyToEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 回复消息失败: ${err}`)
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
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const messageContent: Record<string, unknown> = {
        msgtype: content.msgtype || MatrixMsgType.TEXT,
        body: content.body,
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId,
          'm.in_reply_to': {
            event_id: threadRootId
          }
        }
      }

      if (content.html) {
        messageContent.format = MatrixFormat.HTML
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, messageContent)
      logger.info(`[MessageRelation] 线程回复成功: ${threadRootId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 线程回复失败: ${err}`)
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

      const content = event.getContent() as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } }
      chain.push({
        eventId: currentEventId,
        content: content,
        sender: event.getSender()!,
        timestamp: event.getTs()
      })

      const relatesTo = content?.[MatrixContentField.RELATES_TO]
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
      const content = event.getContent() as RelationContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

      if (relatesTo?.rel_type === MatrixRelType.THREAD && relatesTo.event_id === threadRootId) {
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
      const content = event.getContent() as RelationContent
      const relatesTo = content[MatrixContentField.RELATES_TO]

      if (relatesTo?.['m.in_reply_to']?.event_id === eventId) {
        replies.push(event)
      }
    }

    return replies.sort((a, b) => a.getTs() - b.getTs())
  }

  isEdited(event: MatrixEvent): boolean {
    const content = event.getContent() as RelationContent
    return !!content['m.new_content']
  }

  getEditedContent(event: MatrixEvent): Record<string, unknown> {
    const content = event.getContent() as RelationContent
    if (content['m.new_content']) {
      return content['m.new_content'] as RelationContent
    }
    return content as RelationContent
  }

  getReplyToEventId(event: MatrixEvent): string | null {
    const content = event.getContent() as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } }
    return content?.[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id || null
  }

  getThreadRootId(event: MatrixEvent): string | null {
    const content = event.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } }
    const relatesTo = content?.[MatrixContentField.RELATES_TO]
    if (relatesTo?.rel_type === MatrixRelType.THREAD) {
      return relatesTo.event_id || null
    }
    return null
  }

  async deleteMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(this.t('matrix_error.messaging.message_not_found', { eventId }))
      }

      const myUserId = client.getUserId()
      if (event.getSender() !== myUserId) {
        throw new Error(this.t('matrix_error.messaging.can_only_delete_own_messages'))
      }

      await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
      logger.info(`[MessageRelation] 删除消息成功: ${eventId}`)
    } catch (err) {
      logger.error(`[MessageRelation] 删除消息失败: ${err}`)
      throw err
    }
  }

  // ============================================
  // Server-side Relations API (契约 relations.md)
  // ============================================

  async fetchRelations(
    roomId: string,
    eventId: string,
    options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<RelationsResponse | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.to) queryParams.to = options.to
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.dir) queryParams.dir = options.dir
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}`,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )) as RelationsResponse
      logger.info(`[MessageRelation] 获取关系列表成功: ${eventId}, chunk=${result.chunk?.length ?? 0}`)
      return result
    } catch (err) {
      logger.error(`[MessageRelation] 获取关系列表失败: ${err}`)
      return null
    }
  }

  async fetchRelationsByType(
    roomId: string,
    eventId: string,
    relType: string,
    options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<RelationsResponse | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const queryParams: Record<string, string> = {}
      if (options?.from) queryParams.from = options.from
      if (options?.to) queryParams.to = options.to
      if (options?.limit) queryParams.limit = String(options.limit)
      if (options?.dir) queryParams.dir = options.dir
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}/${encodeURIComponent(relType)}`,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )) as RelationsResponse
      logger.info(`[MessageRelation] 获取类型关系列表成功: ${eventId}/${relType}, chunk=${result.chunk?.length ?? 0}`)
      return result
    } catch (err) {
      logger.error(`[MessageRelation] 获取类型关系列表失败: ${err}`)
      return null
    }
  }

  async getAggregations(roomId: string, eventId: string, relType: string): Promise<AggregationsResponse | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/aggregations/${encodeURIComponent(eventId)}/${encodeURIComponent(relType)}`
      )) as AggregationsResponse
      logger.info(`[MessageRelation] 获取聚合数据成功: ${eventId}/${relType}`)
      return result
    } catch (err) {
      logger.error(`[MessageRelation] 获取聚合数据失败: ${err}`)
      return null
    }
  }

  async sendRelation(
    roomId: string,
    eventId: string,
    relType: string,
    eventType: string,
    content: Record<string, unknown>,
    key?: string
  ): Promise<SendRelationResponse | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const body: Record<string, unknown> = { ...content }
      if (key) body.key = key
      const txnId = `txn_${Date.now()}`
      const result = (await client.http.authedRequest(
        'PUT',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}/${encodeURIComponent(relType)}/${encodeURIComponent(txnId)}`,
        undefined,
        { ...body, type: eventType }
      )) as SendRelationResponse
      logger.info(`[MessageRelation] 发送关系事件成功: ${result.event_id}`)
      return result
    } catch (err) {
      logger.error(`[MessageRelation] 发送关系事件失败: ${err}`)
      return null
    }
  }

  async getEditHistoryViaApi(
    roomId: string,
    eventId: string,
    options?: { from?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<RelationsResponse | null> {
    return this.fetchRelationsByType(roomId, eventId, 'm.replace', options)
  }

  async getReactionAggregations(roomId: string, eventId: string): Promise<AggregationsResponse | null> {
    return this.getAggregations(roomId, eventId, 'm.annotation')
  }
}

export const matrixMessageRelationService = new MatrixMessageRelationService()
export default matrixMessageRelationService
