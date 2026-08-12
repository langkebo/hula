/**
 * Message Relation 服务 — 查询操作模块。
 *
 * 从 MatrixMessageRelationService 抽离，包含编辑历史、回复链、线程、
 * 服务端 Relations API 等查询逻辑。采用工厂模式，接收 getClient 依赖。
 */

import { Direction, type MatrixClient, type MatrixEvent } from 'matrix-js-sdk'
import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import { createLogger } from '@/utils/Logger'
import type { MessageEdit, RelationContent, RelationsResponse, ReplyChain, ThreadInfo } from './relationTypes'

const logger = createLogger('RelationQueries')

export function createRelationQueries(getClient: () => MatrixClient | null) {
  return {
    // ── 编辑历史 ──

    getEditHistory(roomId: string, eventId: string): MessageEdit[] {
      const client = getClient()
      if (!client) return []
      const room = client.getRoom(roomId)
      if (!room) return []

      const edits: MessageEdit[] = []
      for (const event of room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()) {
        const content = event.getContent() as RelationContent
        const relatesTo = content[MatrixContentField.RELATES_TO]
        if (relatesTo?.rel_type === 'm.replace' && relatesTo.event_id === eventId) {
          edits.push({
            eventId: event.getId()!,
            originalContent: content,
            newContent: content['m.new_content'] ?? {},
            timestamp: event.getTs(),
            sender: event.getSender()!
          })
        }
      }
      return edits.sort((a, b) => a.timestamp - b.timestamp)
    },

    getLatestEdit(roomId: string, eventId: string): MatrixEvent | null {
      const client = getClient()
      if (!client) return null
      const room = client.getRoom(roomId)
      if (!room) return null

      let latestEdit: MatrixEvent | null = null
      let latestTimestamp = 0
      for (const event of room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()) {
        const content = event.getContent() as RelationContent
        const relatesTo = content[MatrixContentField.RELATES_TO]
        if (relatesTo?.rel_type === 'm.replace' && relatesTo.event_id === eventId) {
          if (event.getTs() > latestTimestamp) {
            latestTimestamp = event.getTs()
            latestEdit = event
          }
        }
      }
      return latestEdit
    },

    // ── 回复链 & 线程 ──

    getReplyChain(roomId: string, eventId: string, maxDepth = 10): ReplyChain[] {
      const client = getClient()
      if (!client) return []
      const room = client.getRoom(roomId)
      if (!room) return []

      const chain: ReplyChain[] = []
      let currentEventId: string | undefined = eventId
      let depth = 0

      while (currentEventId && depth < maxDepth) {
        const event = room.findEventById(currentEventId)
        if (!event) break
        const content = event.getContent() as RelationContent
        chain.push({
          eventId: currentEventId,
          content,
          sender: event.getSender()!,
          timestamp: event.getTs()
        })
        currentEventId = content[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id
        depth++
      }
      return chain
    },

    getThreadReplies(roomId: string, threadRootId: string): MatrixEvent[] {
      const client = getClient()
      if (!client) return []
      const room = client.getRoom(roomId)
      if (!room) return []

      const replies: MatrixEvent[] = []
      for (const event of room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()) {
        const content = event.getContent() as RelationContent
        const relatesTo = content[MatrixContentField.RELATES_TO]
        if (relatesTo?.rel_type === MatrixRelType.THREAD && relatesTo.event_id === threadRootId) {
          replies.push(event)
        }
      }
      return replies.sort((a, b) => a.getTs() - b.getTs())
    },

    getThreadInfo(roomId: string, threadRootId: string): ThreadInfo | null {
      const client = getClient()
      if (!client) return null
      const room = client.getRoom(roomId)
      if (!room) return null
      if (!room.findEventById(threadRootId)) return null

      const replies = this.getThreadReplies(roomId, threadRootId)
      const participants = new Set<string>()
      let lastReply: { eventId: string; sender: string; timestamp: number } | undefined

      for (const reply of replies) {
        const sender = reply.getSender()
        if (sender) participants.add(sender)
        if (!lastReply || reply.getTs() > lastReply.timestamp) {
          lastReply = { eventId: reply.getId()!, sender: reply.getSender()!, timestamp: reply.getTs() }
        }
      }

      return {
        threadId: threadRootId,
        rootEventId: threadRootId,
        replyCount: replies.length,
        participants: Array.from(participants),
        lastReply
      }
    },

    getEventReplies(roomId: string, eventId: string): MatrixEvent[] {
      const client = getClient()
      if (!client) return []
      const room = client.getRoom(roomId)
      if (!room) return []

      const replies: MatrixEvent[] = []
      for (const event of room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()) {
        const content = event.getContent() as RelationContent
        const relatesTo = content[MatrixContentField.RELATES_TO]
        if (relatesTo?.['m.in_reply_to']?.event_id === eventId) {
          replies.push(event)
        }
      }
      return replies.sort((a, b) => a.getTs() - b.getTs())
    },

    // ── 服务端 Relations API ──

    async fetchRelations(
      roomId: string,
      eventId: string,
      options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
    ): Promise<RelationsResponse | null> {
      const client = getClient()
      if (!client) return null
      try {
        const opts: { from?: string; to?: string; limit?: number; dir?: Direction } = {}
        if (options?.from) opts.from = options.from
        if (options?.to) opts.to = options.to
        if (options?.limit) opts.limit = options.limit
        if (options?.dir === 'b') opts.dir = Direction.Backward
        else if (options?.dir === 'f') opts.dir = Direction.Forward
        const result = await client.relations(roomId, eventId, null, null, opts)
        const response: RelationsResponse = {
          chunk: result.events.map((e) => e.event as unknown as Record<string, unknown>)
        }
        if (result.nextBatch) response.next_batch = result.nextBatch
        if (result.prevBatch) response.prev_batch = result.prevBatch
        logger.info(`[MessageRelation] 获取关系列表成功: ${eventId}, chunk=${response.chunk.length}`)
        return response
      } catch (err) {
        logger.error(`[MessageRelation] 获取关系列表失败: ${err}`)
        return null
      }
    },

    async fetchRelationsByType(
      roomId: string,
      eventId: string,
      relType: string,
      options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
    ): Promise<RelationsResponse | null> {
      const client = getClient()
      if (!client) return null
      try {
        const opts: { from?: string; to?: string; limit?: number; dir?: Direction } = {}
        if (options?.from) opts.from = options.from
        if (options?.to) opts.to = options.to
        if (options?.limit) opts.limit = options.limit
        if (options?.dir === 'b') opts.dir = Direction.Backward
        else if (options?.dir === 'f') opts.dir = Direction.Forward
        const result = await client.relations(roomId, eventId, relType, null, opts)
        const response: RelationsResponse = {
          chunk: result.events.map((e) => e.event as unknown as Record<string, unknown>)
        }
        if (result.nextBatch) response.next_batch = result.nextBatch
        if (result.prevBatch) response.prev_batch = result.prevBatch
        logger.info(`[MessageRelation] 获取类型关系列表成功: ${eventId}/${relType}, chunk=${response.chunk.length}`)
        return response
      } catch (err) {
        logger.error(`[MessageRelation] 获取类型关系列表失败: ${err}`)
        return null
      }
    }
  }
}
