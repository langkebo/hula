/**
 * MatrixThreadState — thread state predicates, notification counts and
 * local-state-mutating operations (mute / freeze / unfreeze / mark-read).
 *
 * Extracted from MatrixThreadService to keep the main service under the file
 * size guard. `fetchThreadReplies` is injected so this class can reuse the
 * main service's timeline-backed reply lookup without a circular import.
 */

import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { EventType, MatrixEvent } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { matrixReceiptService } from './MatrixReceiptService'
import type { MessageContent } from './threadTypes'

const logger = createLogger('MatrixThreadState')

export class MatrixThreadState extends BaseMatrixService {
  constructor(private readonly fetchThreadReplies: (roomId: string, threadRootId: string) => MatrixEvent[]) {
    super()
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

  async getThreadNotificationCount(roomId: string, threadRootId: string): Promise<number> {
    const client = matrixClientService.getClient()
    if (!client) return 0

    const room = client.getRoom(roomId)
    if (!room) return 0

    const myUserId = client.getUserId()
    if (!myUserId) return 0

    const receipt = room.getEventReadUpTo(myUserId, false)
    const replies = this.fetchThreadReplies(roomId, threadRootId)

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
    const replies = this.fetchThreadReplies(roomId, threadRootId)
    const lastReply = replies[replies.length - 1]

    if (lastReply) {
      await matrixReceiptService.sendReadReceiptByEventId(roomId, lastReply.getId()!)
      logger.info(`[MatrixThread] 标记线程已读: ${threadRootId}`)
    }
  }

  async muteThread(roomId: string, threadRootId: string, mute: boolean): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.sendEvent(roomId, 'm.thread_mute' as EventType, {
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        },
        mute: mute
      })
      logger.info(`[MatrixThread] ${mute ? '静音' : '取消静音'}线程成功: ${threadRootId}`)
    } catch (err) {
      logger.error(`[MatrixThread] ${mute ? '静音' : '取消静音'}线程失败: ${err}`)
      throw err
    }
  }

  async freezeThread(roomId: string, threadRootId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.sendEvent(roomId, 'm.thread_freeze' as EventType, {
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        }
      })
      logger.info(`[MatrixThread] 冻结线程成功: ${threadRootId}`)
    } catch (err) {
      logger.error(`[MatrixThread] 冻结线程失败: ${err}`)
      throw err
    }
  }

  async unfreezeThread(roomId: string, threadRootId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.sendEvent(roomId, 'm.thread_unfreeze' as EventType, {
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId
        }
      })
      logger.info(`[MatrixThread] 解冻线程成功: ${threadRootId}`)
    } catch (err) {
      logger.error(`[MatrixThread] 解冻线程失败: ${err}`)
      throw err
    }
  }
}
