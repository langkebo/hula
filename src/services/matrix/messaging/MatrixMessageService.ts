import type { ISendEventResponse, MatrixEvent } from 'matrix-js-sdk'
import { MatrixBurnDuration, MatrixEventType, MatrixFormat, MatrixMsgType } from '@/common/matrixConstants'
import type { MsgEnum } from '@/enums'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixEventService } from '../MatrixEventService'
import { matrixMessageRelationService } from './MatrixMessageRelationService'
import { matrixReactionService } from './MatrixReactionService'
import { matrixReceiptService } from './MatrixReceiptService'
import { buildMatrixContent } from './messageContentBuilder'
import type { MessageListOptions, MessageListResult, MessageSearchOptions } from './messageQueryHelpers'
import {
  getMessageEvents,
  getMessageList,
  getMsgList,
  getMsgListByIds,
  getRoomMessage,
  getUnreadMessages
} from './messageQueryHelpers'

const logger = createLogger('MatrixMessageService')

export type { MessageListOptions, MessageListResult, MessageSearchOptions } from './messageQueryHelpers'

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

const NON_RETRYABLE_ERROR_PATTERNS = ['does not support encryption', 'Event blocked by other events not yet sent']

function isNonRetryableError(error: Error): boolean {
  return NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern))
}

/**
 * Matrix 消息服务 — 发送、撤回、编辑、查询与已读回执。
 *
 * 实现已拆分为两个子模块：
 * - messageContentBuilder：纯函数，将业务 body 转换为 Matrix content
 * - messageQueryHelpers：纯函数，接收 client 参数的消息查询逻辑
 *
 * 本文件保留：事件 ID 管理、发送重试、离线入队、已读回执。
 */
class MatrixMessageService extends BaseMatrixService {
  private localToRemoteEventIdMap: Map<string, string> = new Map()

  // ===== 事件 ID 管理 =====

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

  // ===== 发送重试 =====

  private async sendWithRetry<T>(sendFn: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null
    let delay = MESSAGE_SEND_RETRY_DELAY_MS

    for (let attempt = 1; attempt <= MESSAGE_SEND_MAX_RETRIES; attempt++) {
      try {
        return await sendFn()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (isNonRetryableError(lastError)) {
          logger.error(`[MatrixMessage] ${operationName} failed (non-retryable): ${lastError.message}`)
          throw lastError
        }
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

  // ===== 消息发送 =====

  async sendMessageStream(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendTextMessage(roomId, content, txId)
  }

  async sendStructuredMessage(payload: SendMessagePayload): Promise<ISendEventResponse> {
    return this.sendWithRetry(async () => {
      const content = buildMatrixContent(payload.msgType, payload.body)
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
        content: { msgtype: MatrixMsgType.TEXT, body: content }
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
        content: { msgtype: MatrixMsgType.TEXT, body, format: MatrixFormat.HTML, formatted_body: html }
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
        content: { msgtype: 'm.emote', body: content }
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

  // ===== 消息撤回与编辑 =====

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

  async editMessage(roomId: string, eventId: string, newContent: string): Promise<ISendEventResponse> {
    const resolvedId = this.resolveEventId(eventId)
    if (this.isLocalEventId(resolvedId)) {
      throw new Error('Cannot edit a message that has not been sent yet (local ID)')
    }
    try {
      const newEventId = await matrixMessageRelationService.editMessage(roomId, resolvedId, { body: newContent })
      logger.info(`[MatrixMessage] Message edited in ${roomId}: ${resolvedId}`)
      return { event_id: newEventId } as ISendEventResponse
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to edit message: ${err}`)
      throw err
    }
  }

  // ===== 表情回应 =====

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

  // ===== 消息查询（委托 messageQueryHelpers）=====

  async getMessageEvents(roomId: string, options?: MessageSearchOptions): Promise<MatrixEvent[]> {
    return getMessageEvents(this.getClient(), roomId, options)
  }

  async getRoomMessage(roomId: string, eventId: string): Promise<MatrixEvent | null> {
    return getRoomMessage(this.getClient(), roomId, eventId)
  }

  async getUnreadMessages(roomId: string): Promise<MatrixEvent[]> {
    return getUnreadMessages(this.getClient(), roomId)
  }

  async getMessageList(options: MessageListOptions): Promise<MessageListResult> {
    return getMessageList(options, this.getClient())
  }

  async getMsgList(
    roomId: string,
    limit: number = 20,
    options?: { type?: string; sender?: string }
  ): Promise<MatrixEvent[]> {
    return getMsgList(this.getClient(), roomId, limit, options)
  }

  async getMsgListByIds(
    params: { msgIds?: string[]; async?: boolean } | string,
    limit?: number
  ): Promise<MatrixEvent[]> {
    return getMsgListByIds(this.getClient(), params, limit)
  }

  // ===== 已读回执 =====

  async getReadReceipt(roomId: string, eventId: string): Promise<{ hasRead: boolean }> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) return { hasRead: false }

      const event = room.findEventById(eventId)
      if (!event) return { hasRead: false }
      const myUserId = client.getUserId()
      if (!myUserId) return { hasRead: false }
      return { hasRead: room.hasUserReadEvent(myUserId, eventId) }
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
      if (!eventId) return
      await this.markMessagesRead(roomId, eventId)
    } catch (err) {
      logger.error(`[MatrixMessage] Failed to mark room as read: ${err}`)
      throw err
    }
  }

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
}

export const matrixMessageService = new MatrixMessageService()
export default matrixMessageService
