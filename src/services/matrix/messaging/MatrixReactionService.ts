import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { MatrixContentField } from '@/common/matrixConstants'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

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
  async addReaction(roomId: string, eventId: string, emoji: string): Promise<string> {
    if (!navigator.onLine) {
      const offlineId = offlineQueueService.enqueue('reaction', roomId, { roomId, eventId, emoji })
      logger.info(`[MatrixReaction] 离线状态，已将表情回复入队: ${roomId}/${eventId} -> ${emoji}`)
      return offlineId
    }

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      // SDK ReactionsManager.reactToMessage 内部构造 m.reaction 事件并调用 sendEvent，
      // 返回新 reaction 的 event_id（修复后不再丢弃）。
      const eventIdResult = await client.getReactionsManager().reactToMessage(roomId, eventId, emoji)
      logger.info(`[MatrixReaction] 添加反应成功: ${eventId} -> ${emoji}`)
      return eventIdResult ?? ''
    } catch (err) {
      logger.error(`[MatrixReaction] 添加反应失败: ${err}`)
      throw err
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
    const client = matrixClientService.getClient()
    if (!client) {
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
    }
  }

  /**
   * 收集某个根事件的全部回应事件。
   *
   * 优先读 SDK 的关系容器（`m.annotation` + `m.reaction` 分桶，索引命中，不扫时间线）；
   * 容器为空时回退扫 live timeline —— 关系容器只收 sync 期间进来的关系事件，
   * 滚动历史里早已存在的老回应不会进容器，回退保证这类消息仍能显示。
   */
  private collectReactionEvents(room: Room, eventId: string): MatrixEvent[] {
    const fromContainer = room.getChildEventsForEvent?.(eventId, 'm.annotation', 'm.reaction')?.getRelations?.()
    if (fromContainer?.length) return fromContainer

    const events = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()
    return events.filter((event) => {
      if (event.getType() !== 'm.reaction') return false
      const relatesTo = (event.getContent() as ReactionContent)[MatrixContentField.RELATES_TO]
      return relatesTo?.rel_type === 'm.annotation' && relatesTo.event_id === eventId
    })
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
      const events = result?.events ?? []
      if (!events.length) return this.getReactionsForEvent(roomId, eventId)
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
