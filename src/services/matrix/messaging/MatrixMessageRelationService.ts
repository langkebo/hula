import type { MatrixEvent } from 'matrix-js-sdk'
import {
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType,
  MatrixRelType
} from '@/common/matrixConstants'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { getEditedContent, getReplyToEventId, getThreadRootId, isEdited } from './relationEventHelpers'
import { createRelationQueries } from './relationQueries'
import type {
  AggregationsResponse,
  RelationContent,
  RelationsResponse,
  SendRelationResponse,
  ThreadInfo
} from './relationTypes'

const logger = createLogger('MatrixMessageRelationService')

/**
 * Matrix 消息关系服务 — 编辑/回复/线程/删除/关系 API。
 *
 * 实现已拆分为三个子模块：
 * - relationTypes：类型定义
 * - relationEventHelpers：事件纯函数检查（isEdited / getReplyToEventId 等）
 * - relationQueries：查询操作工厂（编辑历史、回复链、线程、Relations API）
 *
 * 本文件保留：写操作（编辑/回复/删除/发送关系）+ 查询委托。
 */
class MatrixMessageRelationService extends BaseMatrixService {
  private queries = createRelationQueries(() => matrixClientService.getClient())

  // ── 编辑 ──

  async editMessage(
    roomId: string,
    originalEventId: string,
    newContent: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(this.t('matrix_error.common.client_not_initialized'))

    try {
      const room = client.getRoom(roomId)
      if (!room) throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))

      const originalEvent = room.findEventById(originalEventId)
      if (!originalEvent)
        throw new Error(this.t('matrix_error.messaging.original_message_not_found', { originalEventId }))

      if (originalEvent.getSender() !== client.getUserId()) {
        throw new Error(this.t('matrix_error.messaging.can_only_edit_own_messages'))
      }

      const content: Record<string, unknown> = {
        ...(originalEvent.getContent() as RelationContent),
        msgtype: newContent.msgtype || MatrixMsgType.TEXT,
        body: `* ${newContent.body}`,
        'm.new_content': { msgtype: newContent.msgtype || MatrixMsgType.TEXT, body: newContent.body },
        [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace', event_id: originalEventId }
      }

      if (newContent.html) {
        const newContentObj = content['m.new_content'] as RelationContent
        newContentObj.format = MatrixFormat.HTML
        newContentObj.formatted_body = newContent.html
        content.format = MatrixFormat.HTML
        content.formatted_body = `* ${newContent.html}`
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
      logger.info(`[MessageRelation] 编辑消息成功: ${originalEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 编辑消息失败: ${err}`)
      throw err
    }
  }

  /**
   * 编辑媒体消息的说明文字：保留原 msgtype 与文件信息，只替换 body。
   */
  async editMediaMessage(roomId: string, originalEventId: string, newCaption?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(this.t('matrix_error.common.client_not_initialized'))

    try {
      const room = client.getRoom(roomId)
      if (!room) throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))

      const originalEvent = room.findEventById(originalEventId)
      if (!originalEvent)
        throw new Error(this.t('matrix_error.messaging.original_message_not_found', { originalEventId }))

      if (originalEvent.getSender() !== client.getUserId()) {
        throw new Error(this.t('matrix_error.messaging.can_only_edit_own_messages'))
      }

      const originalContent = originalEvent.getContent() as RelationContent
      const newBody = newCaption || (originalContent.body as string) || ''

      const content: Record<string, unknown> = {
        ...originalContent,
        body: `* ${newBody}`,
        'm.new_content': { ...originalContent, body: newBody },
        [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace', event_id: originalEventId }
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
      logger.info(`[MessageRelation] 编辑媒体消息成功: ${originalEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 编辑媒体消息失败: ${err}`)
      throw err
    }
  }

  // ── 回复 ──

  async replyToMessage(
    roomId: string,
    replyToEventId: string,
    content: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(this.t('matrix_error.common.client_not_initialized'))

    try {
      const room = client.getRoom(roomId)
      if (!room) throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))

      if (!room.findEventById(replyToEventId)) {
        throw new Error(this.t('matrix_error.messaging.reply_message_not_found', { replyToEventId }))
      }

      const messageContent: Record<string, unknown> = {
        msgtype: content.msgtype || MatrixMsgType.TEXT,
        body: content.body,
        [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: replyToEventId } }
      }

      if (content.html) {
        messageContent.format = MatrixFormat.HTML
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, messageContent)
      logger.info(`[MessageRelation] 回复消息成功: ${replyToEventId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 回复消息失败: ${err}`)
      throw err
    }
  }

  async replyInThread(
    roomId: string,
    threadRootId: string,
    content: { body: string; html?: string; msgtype?: string }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(this.t('matrix_error.common.client_not_initialized'))

    try {
      const messageContent: Record<string, unknown> = {
        msgtype: content.msgtype || MatrixMsgType.TEXT,
        body: content.body,
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: threadRootId,
          'm.in_reply_to': { event_id: threadRootId }
        }
      }

      if (content.html) {
        messageContent.format = MatrixFormat.HTML
        messageContent.formatted_body = content.html
      }

      const response = await client.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, messageContent)
      logger.info(`[MessageRelation] 线程回复成功: ${threadRootId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[MessageRelation] 线程回复失败: ${err}`)
      throw err
    }
  }

  // ── 删除 ──

  /**
   * 撤回自己的消息（redact）；`reason` 会写入撤回事件，供对端展示。
   */
  async deleteMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(this.t('matrix_error.common.client_not_initialized'))

    try {
      const room = client.getRoom(roomId)
      if (!room) throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))

      const event = room.findEventById(eventId)
      if (!event) throw new Error(this.t('matrix_error.messaging.message_not_found', { eventId }))

      if (event.getSender() !== client.getUserId()) {
        throw new Error(this.t('matrix_error.messaging.can_only_delete_own_messages'))
      }

      await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
      logger.info(`[MessageRelation] 删除消息成功: ${eventId}`)
    } catch (err) {
      logger.error(`[MessageRelation] 删除消息失败: ${err}`)
      throw err
    }
  }

  // ── 发送关系事件 ──

  async sendRelation(
    roomId: string,
    eventId: string,
    relType: string,
    eventType: string,
    content: Record<string, unknown>,
    key?: string
  ): Promise<SendRelationResponse | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const body: Record<string, unknown> = { ...content }
      if (key) body.key = key
      const result = await client.sendEvent(roomId, eventType, body, `txn_${Date.now()}`)
      const response: SendRelationResponse = {
        event_id: result.event_id,
        room_id: roomId,
        relates_to: { event_id: eventId, rel_type: relType }
      }
      logger.info(`[MessageRelation] 发送关系事件成功: ${response.event_id}`)
      return response
    } catch (err) {
      logger.error(`[MessageRelation] 发送关系事件失败: ${err}`)
      return null
    }
  }

  // ── 聚合 ──

  /**
   * 取事件的聚合数据（如表情计数）；失败返回 null。
   */
  async getAggregations(roomId: string, eventId: string, relType: string): Promise<AggregationsResponse | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const result = await client.getRelationsManager().getAggregations(roomId, eventId, relType)
      logger.info(`[MessageRelation] 获取聚合数据成功: ${eventId}/${relType}`)
      return result as AggregationsResponse
    } catch (err) {
      logger.error(`[MessageRelation] 获取聚合数据失败: ${err}`)
      return null
    }
  }

  // ── 查询委托（relationQueries）──

  /**
   * 取事件的编辑历史（读本地事件库，按时间序）。
   */
  getEditHistory(roomId: string, eventId: string) {
    return this.queries.getEditHistory(roomId, eventId)
  }

  /**
   * 取最近一次编辑事件；从未编辑过返回 null。
   */
  getLatestEdit(roomId: string, eventId: string): MatrixEvent | null {
    return this.queries.getLatestEdit(roomId, eventId)
  }

  /**
   * 沿 `m.in_reply_to` 回溯回复链；`maxDepth` 限制深度以断开环。
   */
  getReplyChain(roomId: string, eventId: string, maxDepth?: number) {
    return this.queries.getReplyChain(roomId, eventId, maxDepth)
  }

  /**
   * 取线程内的全部回复事件。
   */
  getThreadReplies(roomId: string, threadRootId: string): MatrixEvent[] {
    return this.queries.getThreadReplies(roomId, threadRootId)
  }

  /**
   * 取线程摘要（根事件、回复数、参与者）；非线程根返回 null。
   */
  getThreadInfo(roomId: string, threadRootId: string): ThreadInfo | null {
    return this.queries.getThreadInfo(roomId, threadRootId)
  }

  /**
   * 取某事件的直接回复（不含线程内回复）。
   */
  getEventReplies(roomId: string, eventId: string): MatrixEvent[] {
    return this.queries.getEventReplies(roomId, eventId)
  }

  async fetchRelations(
    roomId: string,
    eventId: string,
    options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<RelationsResponse | null> {
    return this.queries.fetchRelations(roomId, eventId, options)
  }

  async fetchRelationsByType(
    roomId: string,
    eventId: string,
    relType: string,
    options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<RelationsResponse | null> {
    return this.queries.fetchRelationsByType(roomId, eventId, relType, options)
  }

  async getEditHistoryViaApi(
    roomId: string,
    eventId: string,
    options?: { from?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<RelationsResponse | null> {
    return this.queries.fetchRelationsByType(roomId, eventId, 'm.replace', options)
  }

  /**
   * 取表情聚合（`m.annotation` 关系）。
   */
  async getReactionAggregations(roomId: string, eventId: string): Promise<AggregationsResponse | null> {
    return this.getAggregations(roomId, eventId, 'm.annotation')
  }

  // ── 事件检查委托（relationEventHelpers）──

  /**
   * 判断事件是否被编辑过。
   */
  isEdited(event: MatrixEvent): boolean {
    return isEdited(event)
  }

  /**
   * 取编辑后的内容；未编辑过时回退为原内容。
   */
  getEditedContent(event: MatrixEvent): Record<string, unknown> {
    return getEditedContent(event)
  }

  /**
   * 取回复的目标事件 ID；非回复消息返回 null。
   */
  getReplyToEventId(event: MatrixEvent): string | null {
    return getReplyToEventId(event)
  }

  /**
   * 取线程根事件 ID；非线程消息返回 null。
   */
  getThreadRootId(event: MatrixEvent): string | null {
    return getThreadRootId(event)
  }
}

export const matrixMessageRelationService = new MatrixMessageRelationService()
