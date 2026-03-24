import { matrixClientService } from './MatrixClientService'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { MatrixEvent } from 'matrix-js-sdk'
import type { ISendEventResponse } from 'matrix-js-sdk'

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

const MESSAGE_SEND_MAX_RETRIES = 3
const MESSAGE_SEND_RETRY_DELAY_MS = 1000
const MESSAGE_SEND_RETRY_BACKOFF = 2

class MatrixMessageService {
  private async sendWithRetry<T>(sendFn: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null
    let delay = MESSAGE_SEND_RETRY_DELAY_MS

    for (let attempt = 1; attempt <= MESSAGE_SEND_MAX_RETRIES; attempt++) {
      try {
        return await sendFn()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < MESSAGE_SEND_MAX_RETRIES) {
          logError(
            `[MatrixMessage] ${operationName} failed (attempt ${attempt}/${MESSAGE_SEND_MAX_RETRIES}): ${lastError.message}, retrying in ${delay}ms...`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= MESSAGE_SEND_RETRY_BACKOFF
        } else {
          logError(
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

  async sendTextMessage(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendWithRetry(async () => {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendTextMessage(roomId, content, txnId)
      info(`[MatrixMessage] Text message sent to ${roomId}: ${txnId}`)
      return response
    }, 'sendTextMessage')
  }

  async sendHtmlMessage(roomId: string, body: string, html: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendWithRetry(async () => {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendHtmlMessage(roomId, txnId, body, html)
      info(`[MatrixMessage] HTML message sent to ${roomId}: ${txnId}`)
      return response
    }, 'sendHtmlMessage')
  }

  async sendEmoteMessage(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendWithRetry(async () => {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendEmote(roomId, txnId, content)
      info(`[MatrixMessage] Emote message sent to ${roomId}: ${txnId}`)
      return response
    }, 'sendEmoteMessage')
  }

  async recallMessage(roomId: string, eventId: string, txId?: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = txId || `m${Date.now()}`
      await client.redactEvent(roomId, eventId, txnId)
      info(`[MatrixMessage] Message redacted in ${roomId}: ${eventId}`)
    } catch (err) {
      logError(`[MatrixMessage] Failed to recall message: ${err}`)
      throw err
    }
  }

  async getMessageEvents(roomId: string, options?: MessageSearchOptions): Promise<MatrixEvent[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const { limit = 20, before, after, type, sender } = options || {}

      const options_: any = {
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
      logError(`[MatrixMessage] Failed to get message events: ${err}`)
      throw err
    }
  }

  async addReaction(roomId: string, eventId: string, reaction: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = `m${Date.now()}`
      const reactionEvent = {
        type: 'm.reaction',
        content: {
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: eventId,
            key: reaction
          }
        }
      }

      await client.sendEvent(roomId, txnId, reactionEvent)
      info(`[MatrixMessage] Reaction added to ${eventId} in ${roomId}`)
    } catch (err) {
      logError(`[MatrixMessage] Failed to add reaction: ${err}`)
      throw err
    }
  }

  async removeReaction(roomId: string, eventId: string, _reaction: string, reactionEventId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.redactEvent(roomId, reactionEventId)
      info(`[MatrixMessage] Reaction removed from ${eventId} in ${roomId}`)
    } catch (err) {
      logError(`[MatrixMessage] Failed to remove reaction: ${err}`)
      throw err
    }
  }

  async editMessage(roomId: string, eventId: string, newContent: string): Promise<ISendEventResponse> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = `m${Date.now()}`
      const response = await client.sendEvent(roomId, txnId, {
        type: 'm.room.message',
        content: {
          'm.new_content': {
            msgtype: 'm.text',
            body: newContent
          },
          'm.relates_to': {
            rel_type: 'm.replace',
            event_id: eventId
          },
          msgtype: 'm.text',
          body: newContent
        }
      })

      info(`[MatrixMessage] Message edited in ${roomId}: ${eventId}`)
      return response
    } catch (err) {
      logError(`[MatrixMessage] Failed to edit message: ${err}`)
      throw err
    }
  }

  async getRoomMessage(roomId: string, eventId: string): Promise<MatrixEvent | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      return room?.findEventById(eventId) || null
    } catch (err) {
      logError(`[MatrixMessage] Failed to get room message: ${err}`)
      throw err
    }
  }

  async getReadReceipt(roomId: string, eventId: string): Promise<Record<string, any>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return {}
      }

      const event = room.findEventById(eventId)
      if (!event) return {}
      const myUserId = client.getUserId()
      if (!myUserId) return {}
      const hasRead = (room as any).hasUserReadEvent(myUserId, eventId)
      return { hasRead }
    } catch (err) {
      logError(`[MatrixMessage] Failed to get read receipt: ${err}`)
      throw err
    }
  }

  async markMessagesRead(roomId: string, eventId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.sendReadReceipt(roomId, eventId)
      info(`[MatrixMessage] Messages marked as read in ${roomId} up to ${eventId}`)
    } catch (err) {
      logError(`[MatrixMessage] Failed to mark messages read: ${err}`)
      throw err
    }
  }

  async getUnreadMessages(roomId: string): Promise<MatrixEvent[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return []
      }

      const myUserId = client.getUserId()
      const events = room.timeline
      const unreadEvents: MatrixEvent[] = []

      for (const event of events) {
        const hasRead = (room as any).hasUserReadEvent(myUserId!, event.getId()!)
        if (!hasRead) {
          if (event.sender?.userId !== myUserId && event.getType() === 'm.room.message') {
            unreadEvents.push(event)
          }
        }
      }

      return unreadEvents
    } catch (err) {
      logError(`[MatrixMessage] Failed to get unread messages: ${err}`)
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
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

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
        }
      } else if (after) {
        const afterIndex = events.findIndex((e) => e.getId() === after)
        if (afterIndex >= 0) {
          startIndex = afterIndex + 1
          endIndex = Math.min(events.length, startIndex + limit)
        }
      }

      const resultEvents = events.slice(startIndex, endIndex)
      const hasMore = before ? startIndex > 0 : endIndex < events.length

      return {
        events: resultEvents,
        hasMore
      }
    } catch (err) {
      logError(`[MatrixMessage] Failed to get message list: ${err}`)
      throw err
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
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

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
      logError(`[MatrixMessage] Failed to get message list: ${err}`)
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
  async getMsgListByIds(params: { msgIds?: string[]; async?: boolean } | string, limit?: number): Promise<any[]> {
    if (typeof params === 'object' && 'msgIds' in params) {
      try {
        const client = matrixClientService.getClient()
        if (!client) {
          throw new Error('Matrix client not initialized')
        }

        const messages: any[] = []
        for (const msgId of params.msgIds || []) {
          try {
            const room = client.getRoom(msgId)
            if (room) {
              const event = room.findEventById(msgId)
              if (event) {
                messages.push({
                  msgId: event.getId(),
                  roomId: event.getRoomId(),
                  content: event.getContent(),
                  sender: event.getSender(),
                  timestamp: event.localTimestamp,
                  type: event.getType()
                })
              }
            }
          } catch (e) {
            logError(`[MatrixMessage] Failed to get message ${msgId}: ${e}`)
          }
        }
        return messages
      } catch (err) {
        logError(`[MatrixMessage] Failed to get messages by IDs: ${err}`)
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
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.sendReadReceipt(roomId, eventId)
      info(`[MatrixMessage] Message marked as read: ${eventId} in ${roomId}`)
      return true
    } catch (err) {
      logError(`[MatrixMessage] Failed to mark message as read: ${err}`)
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
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      let successCount = 0
      for (const eventId of eventIds) {
        try {
          await client.sendReadReceipt(roomId, eventId)
          successCount++
        } catch {
          logError(`[MatrixMessage] Failed to mark message ${eventId} as read`)
        }
      }

      info(`[MatrixMessage] Marked ${successCount}/${eventIds.length} messages as read in ${roomId}`)
      return successCount
    } catch (err) {
      logError(`[MatrixMessage] Failed to mark messages as read: ${err}`)
      throw err
    }
  }

  /**
   * 流式发送消息（用于 AI 消息等场景）
   *
   * @param roomId - 房间 ID
   * @param content - 消息内容
   * @param txId - 事务 ID
   * @returns 发送响应
   */
  async messageSendStream(roomId: string, content: string, txId?: string): Promise<ISendEventResponse> {
    return this.sendWithRetry(async () => {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const txnId = txId || `m${Date.now()}`
      const response = await client.sendTextMessage(roomId, content, txnId)
      info(`[MatrixMessage] Stream message sent to ${roomId}: ${txnId}`)
      return response
    }, 'messageSendStream')
  }
}

export const matrixMessageService = new MatrixMessageService()
