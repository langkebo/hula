/**
 * 线程列表的 timeline 扫描回退实现。
 *
 * 为什么单独一层：`threadSupport` 关闭（或 SDK Thread 尚未建立）时，线程信息只能靠
 * 扫描房间主 timeline 里的 `m.thread` 关系事件聚合。这段逻辑是纯函数、无类状态、
 * 无 i18n 依赖，抽出来后 `MatrixThreadService` 只保留编排职责。
 */

import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { Room } from '@/services/matrix/sdk'
import type { MessageContent, Thread } from './threadTypes'

/**
 * 扫描房间 live timeline，按线程根聚合出线程列表（按最后回复时间倒序）。
 *
 * 与 SDK Thread 列表的差异：根事件已不在 timeline 窗口内的线程不会出现
 * （没有根事件就无法渲染线程卡片），这是回退路径的已知取舍。
 */
export function buildThreadsFromTimeline(room: Room, roomId: string): Thread[] {
  const threadRoots = new Map<string, Thread>()
  const events = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()

  for (const event of events) {
    const content = event.getContent() as MessageContent
    const relatesTo = content[MatrixContentField.RELATES_TO]

    if (relatesTo?.rel_type !== MatrixRelType.THREAD) continue

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
    if (!thread) continue

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

  return Array.from(threadRoots.values()).sort((a, b) => {
    const aTime = a.lastReply?.timestamp || 0
    const bTime = b.lastReply?.timestamp || 0
    return bTime - aTime
  })
}
