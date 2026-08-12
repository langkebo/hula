/**
 * Message Relation 服务 — 事件检查辅助模块。
 *
 * 从 MatrixMessageRelationService 抽离，包含对 MatrixEvent 的纯函数检查。
 * 不依赖 MatrixClient，仅操作事件对象。
 */

import type { MatrixEvent } from 'matrix-js-sdk'
import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { RelationContent } from './relationTypes'

/** 判断事件是否已被编辑 */
export function isEdited(event: MatrixEvent): boolean {
  const content = event.getContent() as RelationContent
  return !!content['m.new_content']
}

/** 获取编辑后的内容（如未编辑则返回原始内容） */
export function getEditedContent(event: MatrixEvent): Record<string, unknown> {
  const content = event.getContent() as RelationContent
  if (content['m.new_content']) {
    return content['m.new_content'] as RelationContent
  }
  return content as RelationContent
}

/** 获取事件回复的目标事件 ID */
export function getReplyToEventId(event: MatrixEvent): string | null {
  const content = event.getContent() as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } }
  return content?.[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id || null
}

/** 获取事件的线程根 ID（如果是线程回复） */
export function getThreadRootId(event: MatrixEvent): string | null {
  const content = event.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } }
  const relatesTo = content?.[MatrixContentField.RELATES_TO]
  if (relatesTo?.rel_type === MatrixRelType.THREAD) {
    return relatesTo.event_id || null
  }
  return null
}
