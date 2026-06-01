import type { Room } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { type RoomSummary as SynapseRoomSummary, synapseRustExtensionsService } from '../SynapseRustExtensionsService'

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

export interface MatrixRoomLiteSummary {
  name: string | null
  topic: string | null
  avatarUrl: string | null
  memberCount: number
}

/**
 * Room summary domain service.
 *
 * Combines the synapse-rust `room_summary` extension with local
 * `Room` state fallback, plus a lite batched variant used by lists.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomSummaryAggregateService extends BaseMatrixService {
  private getRoomTopic(room: Room): string | null {
    return room.topic ?? null
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
      const summary = await synapseRustExtensionsService.getRoomSummary(roomId, true)
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

  async getRoomSummaries(roomIds: string[]): Promise<Map<string, MatrixRoomLiteSummary>> {
    this.getClient()
    try {
      return this.fallbackGetRoomSummaries(roomIds)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要失败: ${err}`)
      throw err
    }
  }

  private async fallbackGetRoomSummaries(roomIds: string[]): Promise<Map<string, MatrixRoomLiteSummary>> {
    const client = this.getClient()
    const results = new Map<string, MatrixRoomLiteSummary>()

    for (const roomId of roomIds) {
      const room = client.getRoom(roomId)
      if (room) {
        results.set(roomId, {
          name: room.name,
          topic: this.getRoomTopic(room),
          avatarUrl: room.getMxcAvatarUrl() ?? null,
          memberCount: room.getJoinedMembers().length
        })
      }
    }

    return results
  }
}

export const matrixRoomSummaryAggregateService = new MatrixRoomSummaryAggregateService()
