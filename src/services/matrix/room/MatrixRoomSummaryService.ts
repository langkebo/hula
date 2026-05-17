import { error, info, warn } from '@tauri-apps/plugin-log'
import { type MatrixClient, type MatrixEvent, NotificationCountType, type Room } from 'matrix-js-sdk'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixRoomStoreAdapter from './MatrixRoomStoreAdapter'

interface RoomSummaryManager {
  createRoomSummary(roomId: string): Promise<Record<string, unknown>>
  updateRoomSummary(roomId: string, updates: Record<string, unknown>): Promise<Record<string, unknown>>
  deleteRoomSummary(roomId: string): Promise<void>
  syncRoomSummary(roomId: string): Promise<Record<string, unknown> | null>
  batchWriteMemberSummaries(roomId: string, members: Array<Record<string, unknown>>): Promise<void>
  updateMemberSummary(roomId: string, userId: string, data: Record<string, unknown>): Promise<void>
  deleteMemberSummary(roomId: string, userId: string): Promise<void>
  getSummaryState(roomId: string, type: string, key?: string): Promise<Record<string, unknown> | null>
  updateSummaryState(roomId: string, type: string, key: string, content: Record<string, unknown>): Promise<void>
  recalculateStats(roomId: string): Promise<Record<string, unknown> | null>
  recalculateHeroes(roomId: string): Promise<void>
  clearUnread(roomId: string): Promise<void>
}

export interface RoomSummary {
  roomId: string
  name: string
  avatarUrl: string
  isSpace: boolean
  unreadCount: number
}

export interface RoomStats {
  roomId: string
  totalMessages: number
  totalMembers: number
  lastEventTs: number | null
  createdAt: number | null
}

export interface RoomMemberSummary {
  userId: string
  displayName: string
  membership: string
  avatarUrl: string
}

export interface RoomListMemberSummary {
  userId: string
  name: string
  avatarUrl?: string
  powerLevel?: number
}

export interface RoomListSnapshot {
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

export type MatrixRoomSummaryInfo = RoomSummary
export type MatrixRoomStats = RoomStats
export type MatrixRoomMemberInfo = RoomMemberSummary

class MatrixRoomSummaryService extends BaseMatrixService {
  initialize(client: MatrixClient): void {
    this.setFallbackClient(client)
  }

  async getRoomSummary(roomId: string): Promise<RoomSummary | null> {
    try {
      const room = this.getClient().getRoom(roomId)
      return room ? this.buildSummary(room) : null
    } catch (err) {
      warn(`[MatrixRoomSummaryService] 获取房间摘要失败: ${String(err)}`)
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
      warn(`[MatrixRoomSummaryService] 获取全部房间摘要失败: ${String(err)}`)
      return []
    }
  }

  getRoomListSnapshot(roomId: string): RoomListSnapshot | null {
    try {
      const room = this.getClient().getRoom(roomId)
      return room ? this.buildRoomListSnapshot(room) : null
    } catch (err) {
      warn(`[MatrixRoomSummaryService] 获取房间列表快照失败: ${String(err)}`)
      return null
    }
  }

  getAllRoomListSnapshots(): RoomListSnapshot[] {
    try {
      const rooms = this.getClient().getRooms()
      return rooms.map((room) => this.buildRoomListSnapshot(room))
    } catch (err) {
      warn(`[MatrixRoomSummaryService] 获取全部房间列表快照失败: ${String(err)}`)
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
      warn(`[MatrixRoomSummaryService] 获取房间统计失败: ${String(err)}`)
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
        membership: member.membership,
        avatarUrl: member.getMxcAvatarUrl() || ''
      }))
    } catch (err) {
      warn(`[MatrixRoomSummaryService] 获取房间成员失败: ${String(err)}`)
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
    const snapshot = matrixRoomStoreAdapter.convertRoomToRoomInfo(room, client.isRoomEncrypted?.(room.roomId) ?? false)

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

  // ==================== REST API Methods (via RoomSummaryManager) ====================

  private getRoomSummaryManager(): RoomSummaryManager | null {
    const client = this.getClient()
    return (
      (client as unknown as { getRoomSummaryManager?: () => RoomSummaryManager | null }).getRoomSummaryManager?.() ??
      null
    )
  }

  private ensureRoomSummaryManager(): RoomSummaryManager {
    const manager = this.getRoomSummaryManager()
    if (!manager) {
      throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    }
    return manager
  }

  async createRoomSummaryViaApi(roomId: string): Promise<Record<string, unknown> | null> {
    const manager = this.getRoomSummaryManager()
    if (!manager) return null
    try {
      const result = await manager.createRoomSummary(roomId)
      info(`[MatrixRoomSummary] 创建房间摘要成功: ${roomId}`)
      return result
    } catch (err) {
      error(`[MatrixRoomSummary] 创建房间摘要失败: ${err}`)
      return null
    }
  }

  async updateRoomSummaryViaApi(
    roomId: string,
    updates: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const manager = this.getRoomSummaryManager()
    if (!manager) return null
    try {
      const result = await manager.updateRoomSummary(roomId, updates)
      info(`[MatrixRoomSummary] 更新房间摘要成功: ${roomId}`)
      return result
    } catch (err) {
      error(`[MatrixRoomSummary] 更新房间摘要失败: ${err}`)
      throw err
    }
  }

  async deleteRoomSummaryViaApi(roomId: string): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.deleteRoomSummary) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.deleteRoomSummary(roomId)
      info(`[MatrixRoomSummary] 删除房间摘要成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 删除房间摘要失败: ${err}`)
      throw err
    }
  }

  async syncRoomSummaryViaApi(roomId: string): Promise<Record<string, unknown> | null> {
    const manager = this.getRoomSummaryManager()
    if (!manager?.syncRoomSummary) return null
    try {
      const result = await manager.syncRoomSummary(roomId)
      info(`[MatrixRoomSummary] 同步房间摘要成功: ${roomId}`)
      return result
    } catch (err) {
      error(`[MatrixRoomSummary] 同步房间摘要失败: ${err}`)
      return null
    }
  }

  async batchWriteMemberSummaries(roomId: string, members: Array<Record<string, unknown>>): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.batchWriteMemberSummaries) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.batchWriteMemberSummaries(roomId, members)
      info(`[MatrixRoomSummary] 批量写入成员摘要成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 批量写入成员摘要失败: ${err}`)
      throw err
    }
  }

  async updateMemberSummary(roomId: string, userId: string, data: Record<string, unknown>): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.updateMemberSummary) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.updateMemberSummary(roomId, userId, data)
      info(`[MatrixRoomSummary] 更新成员摘要成功: ${roomId}/${userId}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 更新成员摘要失败: ${err}`)
      throw err
    }
  }

  async deleteMemberSummary(roomId: string, userId: string): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.deleteMemberSummary) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.deleteMemberSummary(roomId, userId)
      info(`[MatrixRoomSummary] 删除成员摘要成功: ${roomId}/${userId}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 删除成员摘要失败: ${err}`)
      throw err
    }
  }

  async getRoomSummaryStateViaApi(roomId: string, type: string, key?: string): Promise<Record<string, unknown> | null> {
    const manager = this.getRoomSummaryManager()
    if (!manager?.getSummaryState) return null
    try {
      return await manager.getSummaryState(roomId, type, key)
    } catch (err) {
      error(`[MatrixRoomSummary] 获取摘要状态失败: ${err}`)
      return null
    }
  }

  async updateRoomSummaryStateViaApi(
    roomId: string,
    type: string,
    key: string,
    content: Record<string, unknown>
  ): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.updateSummaryState) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.updateSummaryState(roomId, type, key, content)
      info(`[MatrixRoomSummary] 更新摘要状态成功: ${roomId}/${type}/${key}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 更新摘要状态失败: ${err}`)
      throw err
    }
  }

  async recalculateRoomStats(roomId: string): Promise<Record<string, unknown> | null> {
    const manager = this.getRoomSummaryManager()
    if (!manager?.recalculateStats) return null
    try {
      return await manager.recalculateStats(roomId)
    } catch (err) {
      error(`[MatrixRoomSummary] 重算统计失败: ${err}`)
      return null
    }
  }

  async recalculateHeroes(roomId: string): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.recalculateHeroes) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.recalculateHeroes(roomId)
      info(`[MatrixRoomSummary] 重算 heroes 成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 重算 heroes 失败: ${err}`)
      throw err
    }
  }

  async clearUnreadSummary(roomId: string): Promise<void> {
    const manager = this.ensureRoomSummaryManager()
    if (!manager.clearUnread) throw new Error(this.t('matrix_error.room.summary_manager_unavailable'))
    try {
      await manager.clearUnread(roomId)
      info(`[MatrixRoomSummary] 清理未读摘要成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoomSummary] 清理未读摘要失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomSummaryService = new MatrixRoomSummaryService()

export default matrixRoomSummaryService
