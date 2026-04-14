import { matrixClientService } from './MatrixClientService'
import { BaseManager, NotFoundError } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'
import { MatrixEvent } from 'matrix-js-sdk'
import type { ISendEventResponse } from 'matrix-js-sdk'
import type { ExtendedRoomForMessage } from '@/types/matrix-api'

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

class MatrixMessageService extends BaseManager {
  private async sendWithRetry<T>(sendFn: () => Promise<T>, operationName: string, throwOnError = true): Promise<T> {
    let lastError: Error | null = null
    let delay = MESSAGE_SEND_RETRY_DELAY_MS

    for (let attempt = 1; attempt <= MESSAGE_SEND_MAX_RETRIES; attempt++) {
      try {
        return await sendFn()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < MESSAGE_SEND_MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= MESSAGE_SEND_RETRY_BACKOFF
        }
      }
    }

    return this.handleError(lastError, operationName, null as unknown as T, throwOnError)
  }

  async sendMessageStream(
    roomId: string,
    content: string,
    txId?: string,
    throwOnError = true
  ): Promise<ISendEventResponse | null> {
    return this.sendTextMessage(roomId, content, txId, throwOnError)
  }

  async sendTextMessage(
    roomId: string,
    content: string,
    txId?: string,
    throwOnError = true
  ): Promise<ISendEventResponse | null> {
    return this.sendWithRetry(
      async () => {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const txnId = txId || `m${Date.now()}`
        const response = await client.sendTextMessage(roomId, content, txnId)
        info(`[MatrixMessage] Text message sent to ${roomId}: ${txnId}`)
        return response
      },
      'sendTextMessage',
      throwOnError
    )
  }

  async sendHtmlMessage(
    roomId: string,
    body: string,
    html: string,
    txId?: string,
    throwOnError = true
  ): Promise<ISendEventResponse | null> {
    return this.sendWithRetry(
      async () => {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const txnId = txId || `m${Date.now()}`
        const response = await client.sendHtmlMessage(roomId, txnId, body, html)
        info(`[MatrixMessage] HTML message sent to ${roomId}: ${txnId}`)
        return response
      },
      'sendHtmlMessage',
      throwOnError
    )
  }

  async sendEmoteMessage(
    roomId: string,
    content: string,
    txId?: string,
    throwOnError = true
  ): Promise<ISendEventResponse | null> {
    return this.sendWithRetry(
      async () => {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const txnId = txId || `m${Date.now()}`
        const response = await client.sendEmote(roomId, txnId, content)
        info(`[MatrixMessage] Emote message sent to ${roomId}: ${txnId}`)
        return response
      },
      'sendEmoteMessage',
      throwOnError
    )
  }

  async sendEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    throwOnError = true
  ): Promise<string> {
    return this.sendWithRetry(
      async () => {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const txnId = `m${Date.now()}`
        const response = await client.sendEvent(roomId, eventType, content, txnId)
        info(`[MatrixMessage] Event sent to ${roomId}: ${eventType} ${txnId}`)
        return response.event_id
      },
      'sendEvent',
      throwOnError
    )
  }

  async recallMessage(roomId: string, eventId: string, txId?: string, throwOnError = true): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      const txnId = txId || `m${Date.now()}`
      await client.redactEvent(roomId, eventId, txnId)
      info(`[MatrixMessage] Message redacted in ${roomId}: ${eventId}`)
    } catch (error) {
      this.handleError(error, 'recallMessage', undefined, throwOnError)
    }
  }

  async getMessageEvents(roomId: string, options?: MessageSearchOptions, throwOnError = true): Promise<MatrixEvent[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

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
    } catch (error) {
      return this.handleError(error, 'getMessageEvents', [] as MatrixEvent[], throwOnError)
    }
  }

  async addReaction(roomId: string, eventId: string, reaction: string, throwOnError = true): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

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
    } catch (error) {
      this.handleError(error, 'addReaction', undefined, throwOnError)
    }
  }

  async removeReaction(
    roomId: string,
    eventId: string,
    _reaction: string,
    reactionEventId: string,
    throwOnError = true
  ): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      await client.redactEvent(roomId, reactionEventId)
      info(`[MatrixMessage] Reaction removed from ${eventId} in ${roomId}`)
    } catch (error) {
      this.handleError(error, 'removeReaction', undefined, throwOnError)
    }
  }

  async editMessage(
    roomId: string,
    eventId: string,
    newContent: string,
    throwOnError = true
  ): Promise<ISendEventResponse | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

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
    } catch (error) {
      return this.handleError(error, 'editMessage', null, throwOnError)
    }
  }

  async getRoomMessage(roomId: string, eventId: string, throwOnError = true): Promise<MatrixEvent | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      const room = client.getRoom(roomId)
      if (!room && throwOnError) throw new NotFoundError(`房间不存在: ${roomId}`)
      return room?.findEventById(eventId) || null
    } catch (error) {
      return this.handleError(error, 'getRoomMessage', null, throwOnError)
    }
  }

  async getReadReceipt(roomId: string, eventId: string, throwOnError = true): Promise<{ hasRead: boolean }> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      const room = client.getRoom(roomId)
      if (!room) return { hasRead: false }

      const event = room.findEventById(eventId)
      if (!event) return { hasRead: false }
      const myUserId = client.getUserId()
      if (!myUserId) return { hasRead: false }
      const hasRead = (room as unknown as ExtendedRoomForMessage).hasUserReadEvent?.(myUserId, eventId)
      return { hasRead: !!hasRead }
    } catch (error) {
      return this.handleError(error, 'getReadReceipt', { hasRead: false }, throwOnError)
    }
  }

  async markMessagesRead(roomId: string, eventId: string, throwOnError = true): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      await client.sendReadReceipt(roomId, eventId)
      info(`[MatrixMessage] Messages marked as read in ${roomId} up to ${eventId}`)
    } catch (error) {
      this.handleError(error, 'markMessagesRead', undefined, throwOnError)
    }
  }

  async getUnreadMessages(roomId: string, throwOnError = true): Promise<MatrixEvent[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      const room = client.getRoom(roomId)
      if (!room) return []

      const myUserId = client.getUserId()
      const events = room.timeline
      const unreadEvents: MatrixEvent[] = []

      for (const event of events) {
        const hasRead = (room as unknown as ExtendedRoomForMessage).hasUserReadEvent?.(myUserId!, event.getId()!)
        if (!hasRead) {
          if (event.sender?.userId !== myUserId && event.getType() === 'm.room.message') {
            unreadEvents.push(event)
          }
        }
      }

      return unreadEvents
    } catch (error) {
      return this.handleError(error, 'getUnreadMessages', [] as MatrixEvent[], throwOnError)
    }
  }

  async getMessageList(options: MessageListOptions, throwOnError = true): Promise<MessageListResult> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      const { roomId, limit = 20, before, after, type, sender, threadId } = options

      const room = client.getRoom(roomId)
      if (!room) return { events: [], hasMore: false }

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
    } catch (error) {
      return this.handleError(error, 'getMessageList', { events: [], hasMore: false }, throwOnError)
    }
  }

  async getMsgList(
    roomId: string,
    limit: number = 20,
    options?: { type?: string; sender?: string },
    throwOnError = true
  ): Promise<MatrixEvent[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      const room = client.getRoom(roomId)
      if (!room) return []

      const { type, sender } = options || {}
      let events = [...room.timeline]

      if (sender) {
        events = events.filter((e) => e.sender?.userId === sender)
      }

      if (type) {
        events = events.filter((e) => e.getType() === type)
      }

      return events.slice(0, limit)
    } catch (error) {
      return this.handleError(error, 'getMsgList', [] as MatrixEvent[], throwOnError)
    }
  }

  async getMsgListByIds(
    params: { msgIds?: string[]; async?: boolean } | string,
    limit?: number,
    throwOnError = true
  ): Promise<MatrixEvent[]> {
    if (typeof params === 'object' && 'msgIds' in params) {
      try {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const messages: MatrixEvent[] = []
        for (const msgId of params.msgIds || []) {
          try {
            const room = client.getRoom(msgId)
            if (room) {
              const event = room.findEventById(msgId)
              if (event) {
                messages.push(event)
              }
            }
          } catch {
            // skip individual failures
          }
        }
        return messages
      } catch (error) {
        return this.handleError(error, 'getMsgListByIds', [] as MatrixEvent[], throwOnError)
      }
    }
    return this.getMsgList(params as string, limit, undefined, throwOnError)
  }

  async markMsg(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      await client.sendReadReceipt(roomId, eventId)
      info(`[MatrixMessage] Message marked as read: ${eventId} in ${roomId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'markMsg', false, throwOnError)
    }
  }

  async markMsgs(roomId: string, eventIds: string[], throwOnError = true): Promise<number> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      let successCount = 0
      for (const eventId of eventIds) {
        try {
          await client.sendReadReceipt(roomId, eventId)
          successCount++
        } catch {
          // skip individual failures
        }
      }

      info(`[MatrixMessage] Marked ${successCount}/${eventIds.length} messages as read in ${roomId}`)
      return successCount
    } catch (error) {
      return this.handleError(error, 'markMsgs', 0, throwOnError)
    }
  }

  async messageSendStream(
    roomId: string,
    content: string,
    txId?: string,
    throwOnError = true
  ): Promise<ISendEventResponse | null> {
    return this.sendWithRetry(
      async () => {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const txnId = txId || `m${Date.now()}`
        const response = await client.sendTextMessage(roomId, content, txnId)
        info(`[MatrixMessage] Stream message sent to ${roomId}: ${txnId}`)
        return response
      },
      'messageSendStream',
      throwOnError
    )
  }
}

export const matrixMessageService = new MatrixMessageService()
