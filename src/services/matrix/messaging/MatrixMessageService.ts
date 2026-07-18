import type { ISendEventResponse, MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import {
  MatrixBurnDuration,
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType
} from '@/common/matrixConstants'
import { MsgEnum } from '@/enums'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixEventService } from '../MatrixEventService'
import { matrixMessageRelationService } from './MatrixMessageRelationService'
import { matrixReactionService } from './MatrixReactionService'
import { matrixReceiptService } from './MatrixReceiptService'

const logger = createLogger('MatrixMessageService')

export interface MessageSearchOptions {
  roomId?: string
  limit?: number
  before?: string
  after?: string
  sentBefore?: number
  sentAfter?: number
  type?: string
  sender?: string
}

export interface MessageReaction {
  type: string
  key: string
  count: number
  me: boolean
}

export interface MarkedMessage {
  msgId: string
  markType: number
  actType: number
}

export interface MessageListOptions {
  roomId: string
  limit?: number
  before?: string
  after?: string
  type?: string
  sender?: string
  threadId?: string
}

export interface MessageListResult {
  events: MatrixEvent[]
  start?: string
  end?: string
  hasMore: boolean
}

export interface SendMessagePayload {
  id?: string
  roomId: string
  msgType: MsgEnum
  body: unknown
  burnAfterRead?: boolean
  burnExpiresInMs?: number
}

const MESSAGE_SEND_MAX_RETRIES = 3
const MESSAGE_SEND_RETRY_DELAY_MS = 1000
const MESSAGE_SEND_RETRY_BACKOFF = 2

class MatrixMessageService extends BaseMatrixService {
  private localToRemoteEventIdMap: Map<string, string> = new Map()

  isLocalEventId(eventId: string): boolean {
    return eventId.startsWith('local-')
  }

  getRemoteEventId(localEventId: string): string | undefined {
    return this.localToRemoteEventIdMap.get(localEventId)
  }

  resolveEventId(eventId: string): string {
    if (this.isLocalEventId(eventId)) {
      return this.getRemoteEventId(eventId) ?? eventId
    }
    return eventId
  }

  registerSentMessage(localEventId: string, remoteEventId: string): void {
    if (this.isLocalEventId(localEventId)) {
      this.localToRemoteEventIdMap.set(localEventId, remoteEventId)
      logger.info(`[MatrixMessage] 已注册本地→远程事件 ID 映射: ${localEventId} -> ${remoteEventId}`)
    }
  }
  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  }

  private convertMsgTypeToMatrix(msgType: MsgEnum): string {
    switch (msgType) {
      case MsgEnum.TEXT:
        return MatrixMsgType.TEXT
      case MsgEnum.IMAGE:
      case MsgEnum.EMOJI:
        return MatrixMsgType.IMAGE
      case MsgEnum.VIDEO:
        return MatrixMsgType.VIDEO
      case MsgEnum.AUDIO:
      case MsgEnum.VOICE:
        return MatrixMsgType.AUDIO
      case MsgEnum.FILE:
        return MatrixMsgType.FILE
      case MsgEnum.LOCATION:
        return MatrixMsgType.LOCATION
      case MsgEnum.NOTICE:
        return MatrixMsgType.NOTICE
      default:
        return MatrixMsgType.TEXT
    }
  }

  private buildMatrixContent(msgType: MsgEnum, body: unknown): Record<string, unknown> {
    const bodyRecord = this.asRecord(body)
    const reply = this.asRecord(bodyRecord.reply)
    const encryptedFile = this.asRecord(bodyRecord.encryptedFile)
    const hasEncryptedFile = typeof encryptedFile.url === 'string' && typeof encryptedFile.v === 'string'

    const content: Record<string, unknown> = {
      msgtype: this.convertMsgTypeToMatrix(msgType),
      body: ''
    }

    switch (msgType) {
      case MsgEnum.TEXT:
      case MsgEnum.NOTICE: {
        content.body = (bodyRecord.content as string | undefined) || (typeof body === 'string' ? body : '') || ''
        if (typeof reply.id === 'string') {
          content[MatrixContentField.RELATES_TO] = {
            'm.in_reply_to': {
              event_id: reply.id
            }
          }
        }
        break
      }
      case MsgEnum.IMAGE:
      case MsgEnum.EMOJI: {
        content.body = (bodyRecord.fileName as string | undefined) || 'image'
        if (hasEncryptedFile) {
          content.file = encryptedFile
        } else {
          content.url = bodyRecord.url
        }
        content.info = {
          size: (bodyRecord.size as number | undefined) || 0,
          w: (bodyRecord.width as number | undefined) || 0,
          h: (bodyRecord.height as number | undefined) || 0,
          mimetype: (bodyRecord.mimetype as string | undefined) || 'image/png'
        }
        break
      }
      case MsgEnum.VIDEO: {
        const thumbnailEncryptedFile = this.asRecord(bodyRecord.thumbnailEncryptedFile)
        const hasEncryptedThumbnail =
          typeof thumbnailEncryptedFile.url === 'string' && typeof thumbnailEncryptedFile.v === 'string'
        content.body = (bodyRecord.fileName as string | undefined) || 'video'
        if (hasEncryptedFile) {
          content.file = encryptedFile
        } else {
          content.url = bodyRecord.url
        }
        content.info = {
          size: (bodyRecord.size as number | undefined) || 0,
          duration: (bodyRecord.duration as number | undefined) || 0,
          w: (bodyRecord.thumbWidth as number | undefined) || 0,
          h: (bodyRecord.thumbHeight as number | undefined) || 0,
          mimetype: (bodyRecord.mimetype as string | undefined) || 'video/mp4',
          thumbnail_info: {
            size: (bodyRecord.thumbSize as number | undefined) || 0,
            w: (bodyRecord.thumbWidth as number | undefined) || 0,
            h: (bodyRecord.thumbHeight as number | undefined) || 0
          }
        }
        if (hasEncryptedThumbnail) {
          ;(content.info as Record<string, unknown>).thumbnail_file = thumbnailEncryptedFile
        } else {
          ;(content.info as Record<string, unknown>).thumbnail_url = bodyRecord.thumbUrl
        }
        break
      }
      case MsgEnum.VOICE: {
        content.body = (bodyRecord.fileName as string | undefined) || 'voice'
        if (hasEncryptedFile) {
          content.file = encryptedFile
        } else {
          content.url = bodyRecord.mxcUrl || bodyRecord.url
        }
        content.info = {
          size: (bodyRecord.size as number | undefined) || 0,
          duration: (bodyRecord.second as number | undefined) || 0,
          mimetype:
            (bodyRecord.mimeType as string | undefined) || (bodyRecord.mimetype as string | undefined) || 'audio/ogg'
        }
        break
      }
      case MsgEnum.FILE: {
        content.body = (bodyRecord.fileName as string | undefined) || 'file'
        if (hasEncryptedFile) {
          content.file = encryptedFile
        } else {
          content.url = bodyRecord.url
        }
        content.info = {
          size: (bodyRecord.size as number | undefined) || 0,
          mimetype: (bodyRecord.mimetype as string | undefined) || 'application/octet-stream'
        }
        break
      }
      case MsgEnum.LOCATION: {
        content.body = (bodyRecord.description as string | undefined) || ''
        content.geo_uri = (bodyRecord.geoUri as string | undefined) || ''
        break
      }
      default: {
        content.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
    }

    return content
  }

  private findEventByIdAcrossRooms(eventId: string): MatrixEvent | null {
    const client = this.getClient()

    for (const room of client.getRooms()) {
      const event = room.findEventById(eventId)
      if (event) {
        return event
      }
    }

    return null
  }

  private async sendWithRetry<T>(sendFn: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null
    let delay = MESSAGE_SEND_RETRY_DELAY_MS

    for (let attempt = 1; attempt <= MESSAGE_SEND_MAX_RETRIES; attempt++) {
      try {
        return await sendFn()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < MESSAGE_SEND_MAX_RETRIES) {
          logger.error(
            `[MatrixMessage] ${operationName} failed (attempt ${attempt}/${MESSAGE_SEND_MAX_RETRIES}): ${lastError.message}, retrying in ${delay}ms...`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= MESSAGE_SEND_RETRY_BACKOFF
        } else {
          logger.error(
            `[MatrixMessage] ${operationName} failed after ${MESSAGE_SEND_MAX_RETRIES} attempts: ${lastError.message}`
          )
        }
      }
    }

    throw lastError
  }

  async sendMessageStream(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendTextMessage(roomId, content, txId)
  }

  async sendStructuredMessage(payload: SendMessagePayload): Promise<ISendEventResponse> {
    return this.sendWithRetry(async () => {
      const content = this.buildMatrixContent(payload.msgType, payload.body)
      if (payload.burnAfterRead) {
        content['m.burn_after_read'] = {
          expires_in: payload.burnExpiresInMs || MatrixBurnDuration.DEFAULT_MS
        }
      }
      const eventId = await matrixEventService.sendEvent(payload.roomId, MatrixEventType.ROOM_MESSAGE, content)
      if (payload.id && this.isLocalEventId(payload.id)) {
        this.registerSentMessage(payload.id, eventId)
      }
      logger.info(`[MatrixMessage] Structured message sent to ${payload.roomId}: ${eventId}`)
      return { event_id: eventId } as ISendEventResponse
    }, 'sendStructuredMessage')
  }

  async sendTextMessage(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    if (!navigator.onLine) {
      const id = offlineQueueService.enqueue('message', roomId, {
        roomId,
        eventType: MatrixEventType.ROOM_MESSAGE,
        content: {
          msgtype: MatrixMsgType.TEXT,
          body: content
        }
      })
      logger.info(`[MatrixMessage] 离线状态，已将文本消息入队: ${roomId} (queueId: ${id})`)
      return { event_id: `local-${id}` } as ISendEventResponse
    }

    return this.sendWithRetry(async () => {
      const client = this.getClient()

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendTextMessage(roomId, content, txnId)
      logger.info(`[MatrixMessage] Text message sent to ${roomId}: ${txnId}`)
      return response
    }, 'sendTextMessage')
  }

  async sendHtmlMessage(roomId: string, body: string, html: string, txId?: string): Promise<ISendEventResponse> {
    if (!navigator.onLine) {
      const id = offlineQueueService.enqueue('message', roomId, {
        roomId,
        eventType: MatrixEventType.ROOM_MESSAGE,
        content: {
          msgtype: MatrixMsgType.TEXT,
          body,
          format: MatrixFormat.HTML,
          formatted_body: html
        }
      })
      logger.info(`[MatrixMessage] 离线状态，已将 HTML 消息入队: ${roomId} (queueId: ${id})`)
      return { event_id: `local-${id}` } as ISendEventResponse
    }

    return this.sendWithRetry(async () => {
      const client = this.getClient()

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendHtmlMessage(roomId, txnId, body, html)
      logger.info(`[MatrixMessage] HTML message sent to ${roomId}: ${txnId}`)
      return response
    }, 'sendHtmlMessage')
  }

  async sendEmoteMessage(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    if (!navigator.onLine) {
      const id = offlineQueueService.enqueue('message', roomId, {
        roomId,
        eventType: MatrixEventType.ROOM_MESSAGE,
        content: {
          msgtype: 'm.emote',
          body: content
        }
      })
      logger.info(`[MatrixMessage] 离线状态，已将 Emote 消息入队: ${roomId} (queueId: ${id})`)
      return { event_id: `local-${id}` } as ISendEventResponse
    }

    return this.sendWithRetry(async () => {
      const client = this.getClient()

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendEmote(roomId, txnId, content)
      logger.info(`[MatrixMessage] Emote message sent to ${roomId}: ${txnId}`)
      return response
    }, 'sendEmoteMessage')
  }

  async recallMessage(roomId: string, eventId: string, txId?: string): Promise<void> {
    const resolvedId = this.resolveEventId(eventId)
    if (this.isLocalEventId(resolvedId)) {
      throw new Error('Cannot recall a message that has not been sent yet (local ID)')
    }

    if (!navigator.onLine) {
      offlineQueueService.enqueue('redact', roomId, { roomId, eventId: resolvedId })
      logger.info(`[MatrixMessage] 离线状态，已将撤回消息操作入队: ${roomId}/${resolvedId}`)
      return
    }

    try {
      const client = this.getClient()

      const txnId = txId || `m${Date.now()}`
      await client.redactEvent(roomId, resolvedId, txnId)
      logger.info(`[MatrixMessage] Message redacted in ${roomId}: ${resolvedId}`)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to recall message: ${err}`)
      throw err
    }
  }

  async getMessageEvents(roomId: string, options?: MessageSearchOptions): Promise<MatrixEvent[]> {
    try {
      const client = this.getClient()

      const { limit = 20, before, after, type, sender } = options || {}

      const options_: {
        limit: number
        reverse: boolean
        from?: string
        to?: undefined
        types?: string[]
      } = {
        limit,
        reverse: !!before
      }

      if (before) {
        options_.from = before
        options_.to = undefined
      } else if (after) {
        options_.from = after
        options_.to = undefined
      }

      if (type) {
        options_.types = [type]
      }

      const response = (await client.getRoom(roomId)?.timeline) ?? []
      let events = response

      if (sender) {
        events = events.filter((e) => e.sender?.userId === sender)
      }

      return events.slice(0, limit)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to get message events: ${err}`)
      throw err
    }
  }

  async addReaction(roomId: string, eventId: string, reaction: string): Promise<void> {
    try {
      await matrixReactionService.addReaction(roomId, eventId, reaction)
      logger.info(`[MatrixMessage] Reaction added to ${eventId} in ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to add reaction: ${err}`)
      throw err
    }
  }

  async removeReaction(roomId: string, eventId: string, _reaction: string, reactionEventId: string): Promise<void> {
    try {
      await matrixReactionService.removeReaction(roomId, reactionEventId)
      logger.info(`[MatrixMessage] Reaction removed from ${eventId} in ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to remove reaction: ${err}`)
      throw err
    }
  }

  async editMessage(roomId: string, eventId: string, newContent: string): Promise<ISendEventResponse> {
    const resolvedId = this.resolveEventId(eventId)
    if (this.isLocalEventId(resolvedId)) {
      throw new Error('Cannot edit a message that has not been sent yet (local ID)')
    }
    try {
      const newEventId = await matrixMessageRelationService.editMessage(roomId, resolvedId, {
        body: newContent
      })
      logger.info(`[MatrixMessage] Message edited in ${roomId}: ${resolvedId}`)
      return { event_id: newEventId } as ISendEventResponse
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to edit message: ${err}`)
      throw err
    }
  }

  async getRoomMessage(roomId: string, eventId: string): Promise<MatrixEvent | null> {
    try {
      const client = this.getClient()

      const room = client.getRoom(roomId)
      return room?.findEventById(eventId) || null
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to get room message: ${err}`)
      throw err
    }
  }

  async getReadReceipt(roomId: string, eventId: string): Promise<{ hasRead: boolean }> {
    try {
      const client = this.getClient()

      const room = client.getRoom(roomId)
      if (!room) {
        return { hasRead: false }
      }

      const event = room.findEventById(eventId)
      if (!event) return { hasRead: false }
      const myUserId = client.getUserId()
      if (!myUserId) return { hasRead: false }
      const hasRead = room.hasUserReadEvent(myUserId, eventId)
      return { hasRead }
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to get read receipt: ${err}`)
      throw err
    }
  }

  async markMessagesRead(roomId: string, eventId: string): Promise<void> {
    try {
      await matrixReceiptService.sendReadReceiptByEventId(roomId, eventId)
      logger.info(`[MatrixMessage] Messages marked as read in ${roomId} up to ${eventId}`)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to mark messages read: ${err}`)
      throw err
    }
  }

  async markRoomAsRead(roomId: string): Promise<void> {
    try {
      const client = this.getClient()

      const room = client.getRoom(roomId)
      const lastEvent = room?.timeline?.[room.timeline.length - 1]
      const eventId = lastEvent?.getId()
      if (!eventId) {
        return
      }

      await this.markMessagesRead(roomId, eventId)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to mark room as read: ${err}`)
      throw err
    }
  }

  async getUnreadMessages(roomId: string): Promise<MatrixEvent[]> {
    try {
      const client = this.getClient()

      const room = client.getRoom(roomId)
      if (!room) {
        return []
      }

      const myUserId = client.getUserId()
      const events = room.timeline
      const unreadEvents: MatrixEvent[] = []

      for (const event of events) {
        const hasRead = room.hasUserReadEvent(myUserId!, event.getId()!)
        if (!hasRead) {
          if (event.sender?.userId !== myUserId && event.getType() === MatrixEventType.ROOM_MESSAGE) {
            unreadEvents.push(event)
          }
        }
      }

      return unreadEvents
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to get unread messages: ${err}`)
      throw err
    }
  }

  /**
   * 获取消息列表（支持分页和过滤）
   *
   * @param options - 查询选项
   * @param options.roomId - 房间 ID
   * @param options.limit - 返回消息数量限制
   * @param options.before - 获取此事件之前的消息
   * @param options.after - 获取此事件之后的消息
   * @param options.type - 按消息类型过滤
   * @param options.sender - 按发送者过滤
   * @param options.threadId - 线程 ID
   * @returns 消息列表结果
   */
  async getMessageList(options: MessageListOptions): Promise<MessageListResult> {
    try {
      const client = this.getClient()

      const { roomId, limit = 20, before, after, type, sender, threadId } = options

      const room = client.getRoom(roomId)
      if (!room) {
        return { events: [], hasMore: false }
      }

      const timeline = room.timeline
      let events = [...timeline]

      if (sender) {
        events = events.filter((e) => e.sender?.userId === sender)
      }

      if (type) {
        events = events.filter((e) => e.getType() === type)
      }

      if (threadId) {
        events = events.filter((e) => {
          const relation = e.getRelation()
          return relation?.event_id === threadId
        })
      }

      let startIndex = 0
      let endIndex = limit

      if (before) {
        const beforeIndex = events.findIndex((e) => e.getId() === before)
        if (beforeIndex > 0) {
          startIndex = Math.max(0, beforeIndex - limit)
          endIndex = beforeIndex
        } else if (beforeIndex < 0 && events.length < limit) {
          const serverEvents = await this.fetchServerMessages(client, roomId, before, limit, 'b')
          events = [...serverEvents, ...events]
          startIndex = 0
          endIndex = Math.min(events.length, limit)
        }
      } else if (after) {
        const afterIndex = events.findIndex((e) => e.getId() === after)
        if (afterIndex >= 0) {
          startIndex = afterIndex + 1
          endIndex = Math.min(events.length, startIndex + limit)
        } else if (afterIndex < 0 && events.length < limit) {
          const serverEvents = await this.fetchServerMessages(client, roomId, after, limit, 'f')
          events = [...events, ...serverEvents]
          startIndex = 0
          endIndex = Math.min(events.length, limit)
        }
      }

      const resultEvents = events.slice(startIndex, endIndex)
      const hasMore = before ? startIndex > 0 : endIndex < events.length

      return {
        events: resultEvents,
        hasMore
      }
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to get message list: ${err}`)
      throw err
    }
  }

  private async fetchServerMessages(
    client: MatrixClient,
    roomId: string,
    fromToken: string,
    limit: number,
    dir: 'b' | 'f'
  ): Promise<MatrixEvent[]> {
    try {
      const response = (await client.http.authedRequest('GET', `/rooms/${encodeURIComponent(roomId)}/messages`, {
        from: fromToken,
        limit: String(limit),
        dir
      })) as Record<string, unknown>
      const chunk = response.chunk
      return Array.isArray(chunk) ? (chunk as MatrixEvent[]) : []
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to fetch server messages: ${err}`)
      return []
    }
  }

  /**
   * 获取房间消息列表
   *
   * @param roomId - 房间 ID
   * @param limit - 返回消息数量限制
   * @param options - 可选参数
   * @param options.type - 按消息类型过滤
   * @param options.sender - 按发送者过滤
   * @returns 消息列表
   */
  async getMsgList(
    roomId: string,
    limit: number = 20,
    options?: { type?: string; sender?: string }
  ): Promise<MatrixEvent[]> {
    try {
      const client = this.getClient()

      const room = client.getRoom(roomId)
      if (!room) {
        return []
      }

      const { type, sender } = options || {}
      let events = [...room.timeline]

      if (sender) {
        events = events.filter((e) => e.sender?.userId === sender)
      }

      if (type) {
        events = events.filter((e) => e.getType() === type)
      }

      return events.slice(0, limit)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to get message list: ${err}`)
      throw err
    }
  }

  /**
   * 获取消息列表 (兼容旧 API)
   *
   * @param params - 包含 msgIds 的对象或房间 ID
   * @param limit - 消息数量限制
   * @returns 消息列表
   */
  async getMsgListByIds(
    params: { msgIds?: string[]; async?: boolean } | string,
    limit?: number
  ): Promise<MatrixEvent[]> {
    if (typeof params === 'object' && 'msgIds' in params) {
      try {
        const messages: MatrixEvent[] = []
        for (const msgId of params.msgIds || []) {
          try {
            const event = this.findEventByIdAcrossRooms(msgId)
            if (event) {
              messages.push(event)
            }
          } catch (e) {
            logger.error(`[MatrixMessage] Failed to get message ${msgId}: ${e}`)
          }
        }
        return messages
      } catch (err) {
        logger.error(`[MatrixMessage] Failed to get messages by IDs: ${err}`)
        return []
      }
    }
    return this.getMsgList(params as string, limit)
  }

  /**
   * 标记单条消息为已读
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @returns 是否成功
   */
  async markMsg(roomId: string, eventId: string): Promise<boolean> {
    try {
      await matrixReceiptService.sendReadReceiptByEventId(roomId, eventId)
      logger.info(`[MatrixMessage] Message marked as read: ${eventId} in ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to mark message as read: ${err}`)
      return false
    }
  }

  /**
   * 批量标记消息为已读
   *
   * @param roomId - 房间 ID
   * @param eventIds - 事件 ID 列表
   * @returns 成功标记的数量
   */
  async markMsgs(roomId: string, eventIds: string[]): Promise<number> {
    try {
      const resolvedIds = eventIds.map((id) => this.resolveEventId(id)).filter((id) => !this.isLocalEventId(id))
      if (resolvedIds.length === 0) return 0

      const latestEventId = resolvedIds[resolvedIds.length - 1]
      try {
        await matrixReceiptService.sendReadReceiptByEventId(roomId, latestEventId)
        logger.info(
          `[MatrixMessage] Marked ${resolvedIds.length} messages as read in ${roomId} (latest: ${latestEventId})`
        )
        return resolvedIds.length
      } catch {
        logger.error(`[MatrixMessage] Failed to mark latest message ${latestEventId} as read`)
        return 0
      }
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to mark messages as read: ${err}`)
      throw err
    }
  }

  /**
   * @deprecated 使用 {@link sendMessageStream} 代替，该方法将在未来版本中移除。
   */
  async messageSendStream(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendMessageStream(roomId, content, txId)
  }
}

export const matrixMessageService = new MatrixMessageService()
export default matrixMessageService
