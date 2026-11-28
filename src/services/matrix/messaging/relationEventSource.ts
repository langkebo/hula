/**
 * 关系子事件的统一读取入口：**关系容器优先，房间 timeline 回退**。
 *
 * 为什么需要这一层：
 * 1. `threadSupport` 开启后，线程回复**不进入房间主 timeline**，只扫 timeline 会得到
 *    「有线程、没有回复」；`sync` 收到的关系事件按 `rel_type/event_type` 建了索引，
 *    读容器既能命中索引，也不受 timeline 窗口限制。
 * 2. 容器是 sync 期间增量建立的，**早于容器建立的关系事件只存在于 timeline 里**，
 *    所以不能只用容器。
 *
 * 编辑历史（`m.replace`）与线程回复（`m.thread`）共用这份判据，避免两处各写一套、
 * 修一处漏一处。
 */

import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { MatrixEvent, Room } from '../sdk'
import type { RelationContent } from './relationTypes'

/** 判断事件是否属于指定根事件 / 关系类型
 *
 * 线程关系优先用 event.threadRootId：编辑后的线程回复 getContent() 只剩 m.new_content，
 * 直接读 content 关系会把编辑过的回复漏掉。
 */
function matchesRelation(event: MatrixEvent, rootEventId: string, relType: string): boolean {
  if (relType === MatrixRelType.THREAD && typeof event.threadRootId === 'string' && event.threadRootId) {
    if (event.threadRootId === rootEventId) return true
  }
  const relatesTo = (event.getContent() as RelationContent)[MatrixContentField.RELATES_TO]
  return relatesTo?.rel_type === relType && relatesTo.event_id === rootEventId
}

/**
 * 读某个根事件的关系子事件（未排序，调用方按需排序）。
 *
 * 容器与 timeline 按 event_id 合并去重（容器优先），避免容器只装了 sync 之后的新关系事件
 * 而丢掉 timeline 里更早的关系事件。
 *
 * @param room 目标房间
 * @param rootEventId 根事件 ID（被编辑 / 被回复 / 线程根）
 * @param relType 关系类型（`m.replace` / `m.thread` / …）
 */
export function collectChildEvents(room: Room, rootEventId: string, relType: string): MatrixEvent[] {
  const merged: MatrixEvent[] = []
  const seen = new Set<string>()
  const push = (event: MatrixEvent) => {
    const eventId = event.getId()
    if (eventId) {
      if (seen.has(eventId)) return
      seen.add(eventId)
    }
    merged.push(event)
  }

  const fromContainer = room.getChildEventsForEvent?.(rootEventId, relType, 'm.room.message')?.getRelations?.()
  for (const event of fromContainer ?? []) push(event)

  const timelineEvents = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()
  for (const event of timelineEvents) {
    if (matchesRelation(event, rootEventId, relType)) push(event)
  }

  return merged
}
