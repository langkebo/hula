/**
 * Message Relation 服务 — 类型定义模块。
 *
 * 从 MatrixMessageRelationService 抽离，包含关系类型、编辑、回复、线程等接口。
 */

export type RelatesTo = {
  rel_type?: string
  event_id?: string
  'm.in_reply_to'?: { event_id: string }
}

export type RelationContent = Record<string, unknown> & {
  'm.relates_to'?: RelatesTo
  'm.new_content'?: Record<string, unknown>
}

export interface MessageEdit {
  eventId: string
  originalContent: Record<string, unknown>
  newContent: Record<string, unknown>
  timestamp: number
  sender: string
}

export interface ReplyChain {
  eventId: string
  content: Record<string, unknown>
  sender: string
  timestamp: number
  inReplyTo?: ReplyChain
}

export interface ThreadInfo {
  threadId: string
  rootEventId: string
  replyCount: number
  participants: string[]
  lastReply?: {
    eventId: string
    sender: string
    timestamp: number
  }
}

export interface RelationsResponse {
  chunk: Array<Record<string, unknown>>
  next_batch?: string
  prev_batch?: string
}

export interface AggregationItem {
  type: string
  key: string
  count: number
}

export interface AggregationsResponse {
  chunk: AggregationItem[]
}

export interface SendRelationResponse {
  event_id: string
  room_id: string
  relates_to: {
    event_id: string
    rel_type: string
  }
}
