/**
 * Message Relation 服务 — 事件检查辅助模块。
 *
 * 从 MatrixMessageRelationService 抽离，包含对 MatrixEvent 的纯函数检查。
 * 不依赖 MatrixClient，仅操作事件对象。
 */

import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { MatrixEvent } from '../sdk'
import type { RelationContent } from './relationTypes'

/** 判断消息是否被编辑过
 *
 * 事件被编辑后 SDK 的 getContent() 已聚合为 m.new_content，因此不能再靠
 * content['m.new_content'] 判断（真实事件上恒为 undefined）。
 */
export function isEdited(event: MatrixEvent): boolean {
  if (typeof event.replacingEvent === 'function' && event.replacingEvent()) {
    return true
  }
  // 无 replacingEvent() 的环境（如旧聚合数据）退回 server-aggregated replace relation。
  const content = event.getContent() as RelationContent
  return content['m.new_content'] != null
}

/** 获取编辑后的消息内容
 *
 * SDK 已把 m.new_content 聚合进 getContent()，直接返回即可。
 */
export function getEditedContent(event: MatrixEvent): RelationContent {
  return event.getContent() as RelationContent
}

/** 获取回复目标事件 ID
 */
export function getReplyToEventId(event: MatrixEvent): string | null {
  const content = event.getContent() as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } }
  return content?.[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id || null
}

/** 获取话题根消息 ID
 *
 * 编辑过的线程回复 getContent() 只剩 m.new_content（relation 丢失），
 * 因此优先取 SDK 的 threadRootId（基于线上原始内容/线程索引），再退回 content 关系。
 */
export function getThreadRootId(event: MatrixEvent): string | null {
  if (typeof event.threadRootId === 'string' && event.threadRootId) {
    return event.threadRootId
  }
  const content = event.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } }
  const relatesTo = content?.[MatrixContentField.RELATES_TO]
  if (relatesTo?.rel_type === MatrixRelType.THREAD) {
    return relatesTo.event_id || null
  }
  return null
}
