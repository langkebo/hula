import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { MatrixEventType } from '@/common/matrixConstants'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageQueryHelpers')

export interface MessageSearchOptions {
  limit?: number
  sender?: string
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

/**
 * 消息查询辅助函数 — 从 MatrixMessageService 抽离的纯函数模块。
 *
 * 所有函数接收 MatrixClient 作为参数，不依赖 class 实例状态。
 */

export function findEventByIdAcrossRooms(client: MatrixClient, eventId: string): MatrixEvent | null {
  for (const room of client.getRooms()) {
    const event = room.findEventById(eventId)
    if (event) {
      return event
    }
  }
  return null
}

export async function getMessageEvents(
  client: MatrixClient,
  roomId: string,
  options?: MessageSearchOptions
): Promise<MatrixEvent[]> {
  try {
    const { limit = 20, sender } = options || {}

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

export async function getRoomMessage(
  client: MatrixClient,
  roomId: string,
  eventId: string
): Promise<MatrixEvent | null> {
  try {
    const room = client.getRoom(roomId)
    return room?.findEventById(eventId) || null
  } catch (err) {
    logger.error(`[MatrixMessage] Failed to get room message: ${err}`)
    throw err
  }
}

export async function getUnreadMessages(client: MatrixClient, roomId: string): Promise<MatrixEvent[]> {
  try {
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

export async function getMessageList(options: MessageListOptions, client: MatrixClient): Promise<MessageListResult> {
  try {
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
        const serverEvents = await fetchServerMessages(client, roomId, before, limit, 'b')
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
        const serverEvents = await fetchServerMessages(client, roomId, after, limit, 'f')
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

async function fetchServerMessages(
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

export async function getMsgList(
  client: MatrixClient,
  roomId: string,
  limit: number = 20,
  options?: { type?: string; sender?: string }
): Promise<MatrixEvent[]> {
  try {
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

export async function getMsgListByIds(
  client: MatrixClient,
  params: { msgIds?: string[]; async?: boolean } | string,
  limit?: number
): Promise<MatrixEvent[]> {
  if (typeof params === 'object' && 'msgIds' in params) {
    try {
      const messages: MatrixEvent[] = []
      for (const msgId of params.msgIds || []) {
        try {
          const event = findEventByIdAcrossRooms(client, msgId)
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
  return getMsgList(client, params as string, limit)
}
