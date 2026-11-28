/**
 * MatrixThreadState — thread state predicates, notification counts and
 * local-state-mutating operations (mark-read).
 *
 * ⚠️ Batch 3.4：原 `isThreadMuted` / `isThreadFrozen` / `muteThread` / `freezeThread` /
 * `unfreezeThread` 已删除 —— 它们构成一套**自造协议**：靠往房间发
 * `m.thread_mute` / `m.thread_freeze` / `m.thread_unfreeze` 普通消息事件来当"状态"，
 * 再靠扫描 live timeline 里那些消息的 `content.mute/frozen` 来读回状态。
 * 这三个事件类型在 synapse-rust 与 matrix-js-sdk 里均 **0 命中**，且全仓无 UI 调用方。
 * 线程静音/冻结的真实能力在 `MatrixThreadApi.*ViaApi`（走 SDK ThreadingManager → 后端私有 API）。
 *
 * Extracted from MatrixThreadService to keep the main service under the file
 * size guard. `fetchThreadReplies` is injected so this class can reuse the
 * main service's timeline-backed reply lookup without a circular import.
 */

import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { MatrixEvent } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'
import { matrixReceiptService } from './MatrixReceiptService'
import { getThreadRootId as getThreadRootIdFromEvent } from './relationEventHelpers'
import type { IContent, MessageContent } from './threadTypes'

const logger = createLogger('MatrixThreadState')

export class MatrixThreadState extends BaseMatrixService {
  constructor(private readonly fetchThreadReplies: (roomId: string, threadRootId: string) => MatrixEvent[]) {
    super()
  }

  /** 判断事件是否为话题根消息
   */
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

  /** 判断事件是否属于话题
   *
   * 用 threadRootId 判定：编辑后的线程回复 content 里已没有 m.relates_to。
   */
  isInThread(event: MatrixEvent): boolean {
    return getThreadRootIdFromEvent(event) !== null
  }

  /** 判断消息体是否在话题中
   */
  isBodyInThread(body: IContent): boolean {
    const relatesTo = body[MatrixContentField.RELATES_TO] as { rel_type?: string } | undefined
    return relatesTo?.rel_type === MatrixRelType.THREAD
  }

  /** 获取话题根消息 ID
   */
  getThreadRootId(event: MatrixEvent): string | null {
    return getThreadRootIdFromEvent(event)
  }

  /** 获取话题通知计数
   */
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
    // fetchThreadReplies 返回按时间升序（旧 -> 新）。未读 = read receipt 之后的回复，
    // 因此必须从最新一条往回走，遇到 receipt 即停止；从前往后会把已读消息当成未读。
    for (let i = replies.length - 1; i >= 0; i--) {
      const reply = replies[i]
      if (reply.getId() === receipt) break
      if (reply.getSender() !== myUserId) {
        unreadCount++
      }
    }

    return unreadCount
  }

  /** 标记话题为已读
   */
  async markThreadAsRead(roomId: string, threadRootId: string): Promise<void> {
    const replies = this.fetchThreadReplies(roomId, threadRootId)
    const lastReply = replies[replies.length - 1]

    if (lastReply) {
      await matrixReceiptService.sendReadReceiptByEventId(roomId, lastReply.getId()!)
      logger.info(`[MatrixThread] 标记线程已读: ${threadRootId}`)
    }
  }
}
