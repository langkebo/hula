import { type MatrixClient, type MatrixEvent, NotificationCountType, type Room } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { isRoomEncrypted } from '../roomEncryption'
import matrixRoomStoreAdapter from './MatrixRoomStoreAdapter'

const logger = createLogger('MatrixRoomSummaryService')

export interface RoomSummary {
  roomId: string
  name: string
  avatarUrl: string
  isSpace: boolean
  unreadCount: number
}

interface RoomStats {
  roomId: string
  totalMessages: number
  totalMembers: number
  lastEventTs: number | null
  createdAt: number | null
}

interface RoomMemberSummary {
  userId: string
  displayName: string
  membership: string
  avatarUrl: string
}

interface RoomListMemberSummary {
  userId: string
  name: string
  avatarUrl?: string
  powerLevel?: number
}

interface RoomListSnapshot {
  roomId: string
  name: string
  avatarUrl: string | null
  isDirect: boolean
  isEncrypted: boolean
  unreadCount: number
  highlightCount: number
  notificationCount: number
  lastMessage: string | null
  lastMessageTime: number | null
  members: RoomListMemberSummary[]
}

class MatrixRoomSummaryService extends BaseMatrixService {
  initialize(client: MatrixClient): void {
    this.setFallbackClient(client)
  }

  async getRoomSummary(roomId: string): Promise<RoomSummary | null> {
    try {
      const room = this.getClient().getRoom(roomId)
      return room ? this.buildSummary(room) : null
    } catch (err) {
      logger.warn(`[MatrixRoomSummaryService] 获取房间摘要失败: ${String(err)}`)
      return null
    }
  }

  async getRoomSummaries(roomIds: string[]): Promise<RoomSummary[]> {
    const results = await Promise.allSettled(roomIds.map((roomId) => this.getRoomSummary(roomId)))
    return results
      .filter((r): r is PromiseFulfilledResult<RoomSummary | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((summary): summary is RoomSummary => summary !== null)
  }

  async getAllRoomSummaries(): Promise<RoomSummary[]> {
    try {
      const rooms = this.getClient().getRooms()
      return rooms.map((room) => this.buildSummary(room))
    } catch (err) {
      logger.warn(`[MatrixRoomSummaryService] 获取全部房间摘要失败: ${String(err)}`)
      return []
    }
  }

  getRoomListSnapshot(roomId: string): RoomListSnapshot | null {
    try {
      const room = this.getClient().getRoom(roomId)
      return room ? this.buildRoomListSnapshot(room) : null
    } catch (err) {
      logger.warn(`[MatrixRoomSummaryService] 获取房间列表快照失败: ${String(err)}`)
      return null
    }
  }

  getAllRoomListSnapshots(): RoomListSnapshot[] {
    try {
      const rooms = this.getClient().getRooms()
      return rooms.map((room) => this.buildRoomListSnapshot(room))
    } catch (err) {
      logger.warn(`[MatrixRoomSummaryService] 获取全部房间列表快照失败: ${String(err)}`)
      return []
    }
  }

  async getRoomStats(roomId: string): Promise<RoomStats | null> {
    try {
      const room = this.getClient().getRoom(roomId)
      if (!room) {
        return null
      }

      const events = room.getLiveTimeline().getEvents()
      const createdEvent = room.currentState.getStateEvents('m.room.create', '')
      const lastEvent = events[events.length - 1]

      return {
        roomId,
        totalMessages: events.length,
        totalMembers: room.getJoinedMembers().length,
        lastEventTs: this.getEventTs(lastEvent),
        createdAt: this.getEventTs(createdEvent)
      }
    } catch (err) {
      logger.warn(`[MatrixRoomSummaryService] 获取房间统计失败: ${String(err)}`)
      return null
    }
  }

  async getRoomMembers(roomId: string): Promise<RoomMemberSummary[]> {
    try {
      const room = this.getClient().getRoom(roomId)
      if (!room) {
        return []
      }

      return room.getMembers().map((member) => ({
        userId: member.userId,
        displayName: member.name || member.userId,
        membership: member.membership ?? 'leave',
        avatarUrl: member.getMxcAvatarUrl() || ''
      }))
    } catch (err) {
      logger.warn(`[MatrixRoomSummaryService] 获取房间成员失败: ${String(err)}`)
      return []
    }
  }

  private buildSummary(room: Room): RoomSummary {
    const unreadCount =
      typeof room.getUnreadNotificationCount === 'function' ? (room.getUnreadNotificationCount() ?? 0) : 0

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatarUrl: room.getMxcAvatarUrl() || '',
      isSpace: room.isSpaceRoom(),
      unreadCount
    }
  }

  private buildRoomListSnapshot(room: Room): RoomListSnapshot {
    const client = this.getClient()
    const snapshot = matrixRoomStoreAdapter.convertRoomToRoomInfo(room, isRoomEncrypted(client, room.roomId))

    const notificationCount =
      typeof room.getUnreadNotificationCount === 'function'
        ? room.getUnreadNotificationCount(NotificationCountType.Total)
        : 0
    const highlightCount =
      typeof room.getUnreadNotificationCount === 'function'
        ? room.getUnreadNotificationCount(NotificationCountType.Highlight)
        : 0

    return matrixRoomStoreAdapter.applySlidingSyncUnreadCounts(snapshot, {
      notificationCount: typeof notificationCount === 'number' ? notificationCount : 0,
      highlightCount: typeof highlightCount === 'number' ? highlightCount : 0
    })
  }

  private getEventTs(event: MatrixEvent | null | undefined): number | null {
    if (!event || typeof event.getTs !== 'function') {
      return null
    }
    const ts = event.getTs()
    return typeof ts === 'number' ? ts : null
  }
}

export const matrixRoomSummaryService = new MatrixRoomSummaryService()

export default matrixRoomSummaryService
