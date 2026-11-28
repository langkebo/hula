import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { MatrixContentField } from '@/common/matrixConstants'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('MatrixReactionService')

export interface ReactionInfo {
  key: string
  count: number
  me: boolean
  users: string[]
}

type ReactionRelatesTo = {
  rel_type?: string
  event_id?: string
  key?: string
}

type ReactionContent = {
  'm.relates_to'?: ReactionRelatesTo
  [key: string]: unknown
}

class MatrixReactionService extends BaseMatrixService {
  /** 进行中的反应提交（scope:room:event:emoji），用于拦截同一 emoji 的重复点击。 */
  private readonly pendingReactions = new Set<string>()

  private pendingKey(scope: 'add' | 'toggle', roomId: string, eventId: string, emoji: string): string {
    return `${scope}:${roomId}:${eventId}:${emoji}`
  }

  async addReaction(roomId: string, eventId: string, emoji: string): Promise<string> {
    const pendingKey = this.pendingKey('add', roomId, eventId, emoji)
    if (this.pendingReactions.has(pendingKey)) {
      logger.info(`[MatrixReaction] 反应提交中，忽略重复点击: ${eventId} -> ${emoji}`)
      return ''
    }
    this.pendingReactions.add(pendingKey)

    try {
      if (!navigator.onLine) {
        const offlineId = offlineQueueService.enqueue('reaction', roomId, { roomId, eventId, emoji })
        logger.info(`[MatrixReaction] 离线状态，已将表情回复入队: ${roomId}/${eventId} -> ${emoji}`)
        return offlineId
      }

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error(this.t('matrix_error.common.client_not_initialized'))
      }

      // SDK ReactionsManager.reactToMessage 内部构造 m.reaction 事件并调用 sendEvent，
      // 返回新 reaction 的 event_id（修复后不再丢弃）。
      const eventIdResult = await client.getReactionsManager().reactToMessage(roomId, eventId, emoji)
      logger.info(`[MatrixReaction] 添加反应成功: ${eventId} -> ${emoji}`)
      return eventIdResult ?? ''
    } catch (err) {
      logger.error(`[MatrixReaction] 添加反应失败: ${err}`)
      throw err
    } finally {
      this.pendingReactions.delete(pendingKey)
    }
  }

  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('redact', roomId, { roomId, eventId: reactionEventId })
      logger.info(`[MatrixReaction] 离线状态，已将移除反应操作入队: ${roomId}/${reactionEventId}`)
      return
    }

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      // SDK ReactionsManager.redactReaction 内部调用 client.redactEvent。
      await client.getReactionsManager().redactReaction(roomId, reactionEventId)
      logger.info(`[MatrixReaction] 移除反应成功: ${reactionEventId}`)
    } catch (err) {
      logger.error(`[MatrixReaction] 移除反应失败: ${err}`)
      throw err
    }
  }

  async toggleReaction(roomId: string, eventId: string, emoji: string): Promise<{ added: boolean; eventId?: string }> {
    const pendingKey = this.pendingKey('toggle', roomId, eventId, emoji)
    if (this.pendingReactions.has(pendingKey)) {
      logger.info(`[MatrixReaction] 反应切换中，忽略重复点击: ${eventId} -> ${emoji}`)
      return { added: false }
    }
    this.pendingReactions.add(pendingKey)

    const client = matrixClientService.getClient()
    if (!client) {
      this.pendingReactions.delete(pendingKey)
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const myUserId = client.getUserId()
      if (!myUserId) {
        throw new Error(this.t('matrix_error.common.user_id_not_exists'))
      }

      const existingReaction = this.findUserReaction(roomId, eventId, emoji, myUserId)

      if (existingReaction) {
        await this.removeReaction(roomId, existingReaction.getId()!)
        return { added: false }
      } else {
        const newEventId = await this.addReaction(roomId, eventId, emoji)
        return { added: true, eventId: newEventId }
      }
    } catch (err) {
      logger.error(`[MatrixReaction] 切换反应失败: ${err}`)
      throw err
    } finally {
      this.pendingReactions.delete(pendingKey)
    }
  }

  /**
   * 本地 timeline 中已撤回事件的 event_id 集合。
   *
   * synapse-rust 的 `/relations` 会把已撤回的回应照旧返回，且不带 `unsigned.redacted_because`
   * ⇒ `MatrixEvent.isRedacted()` 恒为 false。只依赖它会让取消回应后的 chip 残留，
   * 必须用本地下发的 redaction 事件（room v11+ 目标在 `content.redacts`）交叉校验。
   */
  private collectRedactedEventIds(room: Room): Set<string> {
    const redacted = new Set<string>()
    const events = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()
    for (const event of events) {
      if (!event.isRedaction()) continue
      const targetId = event.getRedactionTargetId()
      if (targetId) redacted.add(targetId)
    }
    return redacted
  }

  /**
   * 收集某个根事件的全部回应事件。
   *
   * 关系容器（`m.annotation` + `m.reaction` 分桶，索引命中）与 live timeline 按 event_id
   * 合并去重（容器优先）：容器只收 sync 期间进来的关系事件，滚动历史里早已存在的老回应
   * 只存在于 timeline，必须补充进来才能得到完整计数。
   */
  private collectReactionEvents(room: Room, eventId: string): MatrixEvent[] {
    const merged: MatrixEvent[] = []
    const seen = new Set<string>()
    const redacted = this.collectRedactedEventIds(room)
    const push = (event: MatrixEvent) => {
      // 撤回后的回应仍在关系容器 / 时间线里（synapse-rust 的 relations 也照旧返回），
      // 必须显式排除，否则取消回应后计数不降、chip 不消失。
      if (event.isRedacted()) return
      const reactionEventId = event.getId()
      if (reactionEventId) {
        if (seen.has(reactionEventId) || redacted.has(reactionEventId)) return
        seen.add(reactionEventId)
      }
      merged.push(event)
    }

    const fromContainer = room.getChildEventsForEvent?.(eventId, 'm.annotation', 'm.reaction')?.getRelations?.()
    for (const event of fromContainer ?? []) push(event)
    const events = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()
    for (const event of events) {
      if (event.getType() !== 'm.reaction') continue
      const relatesTo = (event.getContent() as ReactionContent)[MatrixContentField.RELATES_TO]
      if (relatesTo?.rel_type === 'm.annotation' && relatesTo.event_id === eventId) push(event)
    }

    return merged
  }

  /** 把回应事件聚合成 `{ key, count, me, users }[]`，按数量降序。 */
  private aggregateReactions(events: MatrixEvent[], myUserId: string | null): ReactionInfo[] {
    const reactionMap = new Map<string, { count: number; users: string[] }>()

    for (const event of events) {
      const content = event.getContent() as ReactionContent
      const relatesTo = content[MatrixContentField.RELATES_TO]
      if (relatesTo?.rel_type !== 'm.annotation') continue
      const key = relatesTo.key
      if (!key) continue

      const info = reactionMap.get(key) ?? { count: 0, users: [] }
      info.count += 1
      const sender = event.getSender()
      if (sender) info.users.push(sender)
      reactionMap.set(key, info)
    }

    const reactions: ReactionInfo[] = []
    reactionMap.forEach((value, key) => {
      reactions.push({
        key,
        count: value.count,
        me: Boolean(myUserId && value.users.includes(myUserId)),
        users: value.users
      })
    })

    return reactions.sort((a, b) => b.count - a.count)
  }

  findUserReaction(roomId: string, eventId: string, emoji: string, userId: string): MatrixEvent | null {
    const client = matrixClientService.getClient()
    if (!client) return null

    const room = client.getRoom(roomId)
    if (!room) return null

    const found = this.collectReactionEvents(room, eventId).find((event) => {
      const relatesTo = (event.getContent() as ReactionContent)[MatrixContentField.RELATES_TO]
      return relatesTo?.key === emoji && event.getSender() === userId
    })

    return found ?? null
  }

  getReactionsForEvent(roomId: string, eventId: string): ReactionInfo[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    return this.aggregateReactions(this.collectReactionEvents(room, eventId), client.getUserId())
  }

  /**
   * 从服务端刷新某事件的回应（`/relations/m.annotation`）并就地聚合。
   *
   * 用途：打开回应列表 / 长按菜单时补一次全量 —— 本地关系容器只覆盖 sync 窗口内的回应，
   * 更早的回应可能不在容器里。注意 `room.getRelations()` **不回填**关系容器（回填由 sync 负责），
   * 因此这里直接用返回值聚合，避免调用方拿到「刷新了但仍读不到」的假象。
   */
  async refreshReactions(roomId: string, eventId: string, limit = 200): Promise<ReactionInfo[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    try {
      const result = await room.getRelations(eventId, 'm.annotation', 'm.reaction', { limit })
      const redacted = this.collectRedactedEventIds(room)
      const events = (result?.events ?? []).filter((event) => {
        if (event.isRedacted()) return false
        const reactionEventId = event.getId()
        return !(reactionEventId && redacted.has(reactionEventId))
      })
      // 服务端是本条消息回应的权威来源：全部已撤回时必须返回空，
      // 不能回退本地聚合（关系容器里的副本可能还没收到 redaction，会复活旧 chip）。
      return this.aggregateReactions(events, client.getUserId())
    } catch (err) {
      logger.warn(`[MatrixReaction] 服务端刷新回应失败，回退本地: ${eventId} ${String(err)}`)
      return this.getReactionsForEvent(roomId, eventId)
    }
  }

  async getReactionEvents(roomId: string, eventId: string): Promise<MatrixEvent[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    return this.collectReactionEvents(room, eventId)
  }
}

export const matrixReactionService = new MatrixReactionService()
