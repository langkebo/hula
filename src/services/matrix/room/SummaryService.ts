import type { Room } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import {
  type RoomSummary as SynapseRoomSummary,
  synapseRoomSummaryService
} from '../extensions/SynapseRoomSummaryService'
import { getRoomTopic as readRoomTopic } from './roomTopic'

const logger = createLogger('SummaryService')

export interface MatrixRoomSummary {
  roomId: string
  name: string | null
  topic: string | null
  avatarUrl: string | null
  memberCount: number
  joinedCount: number
  ownerId: string | null
  joinRule: 'public' | 'invite' | 'knock' | 'private' | null
  canonicalAlias: string | null
  createdTs: number | null
  isPublic: boolean
}

/**
 * Room summary domain service.
 *
 * 房间摘要的**唯一**实现：synapse-rust 的 `room_summary` 扩展（经 SDK
 * `RoomSummaryManager`，见 `SynapseRoomSummaryService`）优先，取不到再回退到本地
 * `Room` 状态。历史上有过第二份本地实现（`MatrixRoomSummaryService`）与一个批量
 * 变体（`MatrixRoomLiteSummary` 版 `getRoomSummaries`），二者均零生产消费者，已在
 * C2 收敛中删除 —— 需要摘要请只走本服务或 `matrixRoomReadFacade`。
 *
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomSummaryAggregateService extends BaseMatrixService {
  private getRoomTopic(room: Room): string | null {
    // `Room` 没有 `topic` 属性（旧代码读 `room.topic` 恒为 undefined）；真实来源是状态事件。
    return readRoomTopic(room)
  }

  private normalizeJoinRule(joinRule: string | null | undefined): MatrixRoomSummary['joinRule'] {
    if (joinRule === 'public' || joinRule === 'invite' || joinRule === 'knock' || joinRule === 'private') {
      return joinRule
    }
    return null
  }

  private getLocalRoomOwnerId(room: Room): string | null {
    const createEvent = room.currentState?.getStateEvents?.('m.room.create', '')
    const content = (createEvent?.getContent?.() ?? {}) as { creator?: unknown }

    if (typeof content.creator === 'string' && content.creator) {
      return content.creator
    }

    const sender = createEvent?.getSender?.()
    return typeof sender === 'string' && sender ? sender : null
  }

  private getLocalRoomCreatedTs(room: Room): number | null {
    const createEvent = room.currentState?.getStateEvents?.('m.room.create', '')
    const ts = createEvent?.getTs?.()
    return typeof ts === 'number' ? ts : null
  }

  toLocalRoomSummary(room: Room): MatrixRoomSummary {
    const joinedMembers = room.getJoinedMembers()
    const joinRule = this.normalizeJoinRule(room.getJoinRule())

    return {
      roomId: room.roomId,
      name: room.name,
      topic: this.getRoomTopic(room),
      avatarUrl: room.getMxcAvatarUrl() ?? null,
      memberCount: joinedMembers.length,
      joinedCount: joinedMembers.length,
      ownerId: this.getLocalRoomOwnerId(room),
      joinRule,
      canonicalAlias: room.getCanonicalAlias() ?? null,
      createdTs: this.getLocalRoomCreatedTs(room),
      isPublic: joinRule === 'public'
    }
  }

  toServerRoomSummary(summary: SynapseRoomSummary, room: Room | null): MatrixRoomSummary {
    const joinRule = this.normalizeJoinRule(summary.join_rule ?? room?.getJoinRule?.())

    return {
      roomId: summary.room_id,
      name: summary.name ?? null,
      topic: summary.topic ?? null,
      avatarUrl: summary.avatar_url ?? null,
      memberCount: summary.member_count ?? summary.heroes.length,
      joinedCount: summary.joined_member_count ?? summary.member_count ?? summary.heroes.length,
      ownerId: room ? this.getLocalRoomOwnerId(room) : null,
      joinRule,
      canonicalAlias: summary.canonical_alias ?? null,
      createdTs: room ? this.getLocalRoomCreatedTs(room) : null,
      isPublic: joinRule === 'public'
    }
  }

  async getRoomSummary(roomId: string, throwOnError = true): Promise<MatrixRoomSummary | null> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      const summary = await synapseRoomSummaryService.getRoomSummary(roomId, true)
      if (summary) {
        return this.toServerRoomSummary(summary, room)
      }

      return room ? this.toLocalRoomSummary(room) : null
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要失败: ${err}`)
      if (throwOnError) {
        throw err
      }

      const room = client.getRoom(roomId)
      return room ? this.toLocalRoomSummary(room) : null
    }
  }
}

export const matrixRoomSummaryAggregateService = new MatrixRoomSummaryAggregateService()
