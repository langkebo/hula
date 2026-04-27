import type { MatrixClient, MatrixEvent, ReadReceiptsManager } from 'matrix-js-sdk'
import { NotificationCountType } from '@/types/matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'

export interface ReadReceipt {
  userId: string
  eventId: string
  timestamp: number
  avatarUrl?: string
  displayName?: string
}

class MatrixReceiptService {
  private cachedClient: MatrixClient | null = null
  private cachedManager: ReadReceiptsManager | null = null

  private getReadReceiptsManager(): ReadReceiptsManager {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReceipt] 客户端未初始化')
    }

    if (this.cachedClient !== client || !this.cachedManager) {
      this.cachedClient = client
      this.cachedManager = client.getReadReceiptsManager()
    }

    return this.cachedManager
  }

  async sendReadReceipt(roomId: string, event: MatrixEvent): Promise<string | undefined> {
    try {
      const eventId = event.getId()
      if (!eventId) {
        throw new Error('[MatrixReceipt] 事件 ID 不存在')
      }

      const manager = this.getReadReceiptsManager()
      await manager.sendReadReceipt(roomId, eventId)
      info(`[MatrixReceipt] 发送阅读回执成功: ${roomId}/${event.getId()}`)
      return eventId
    } catch (err) {
      error(`[MatrixReceipt] 发送阅读回执失败: ${err}`)
      throw err
    }
  }

  async sendReadReceiptByEventId(roomId: string, eventId: string): Promise<string | undefined> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('receipt', roomId, { roomId, eventId })
      info(`[MatrixReceipt] 离线状态，已将阅读回执入队: ${roomId}/${eventId}`)
      return eventId
    }

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixReceipt] 客户端未初始化')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`[MatrixReceipt] 房间不存在: ${roomId}`)
      }

      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()
      const event = events.find((e) => e.getId() === eventId)

      if (!event) {
        throw new Error(`[MatrixReceipt] 事件不存在: ${eventId}`)
      }

      return this.sendReadReceipt(roomId, event)
    } catch (err) {
      error(`[MatrixReceipt] 通过事件ID发送阅读回执失败: ${err}`)
      throw err
    }
  }

  async sendReadMarker(roomId: string, eventId: string): Promise<void> {
    try {
      const manager = this.getReadReceiptsManager()
      await manager.setReadMarker(roomId, eventId)
      info(`[MatrixReceipt] 设置阅读标记成功: ${roomId}/${eventId}`)
    } catch (err) {
      error(`[MatrixReceipt] 设置阅读标记失败: ${err}`)
      throw err
    }
  }

  async markRoomAsRead(roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReceipt] 客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`[MatrixReceipt] 房间不存在: ${roomId}`)
      }

      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()
      const lastEvent = events[events.length - 1]

      if (lastEvent) {
        await this.sendReadReceipt(roomId, lastEvent)
      }
    } catch (err) {
      error(`[MatrixReceipt] 标记房间已读失败: ${err}`)
      throw err
    }
  }

  getReadReceipts(roomId: string, eventId: string): ReadReceipt[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const manager = this.getReadReceiptsManager()
    return manager.getReceipt(roomId, eventId).map((receipt) => {
      const member = room.getMember(receipt.userId)
      return {
        userId: receipt.userId,
        eventId: receipt.eventId,
        timestamp: receipt.ts,
        avatarUrl: member?.getMxcAvatarUrl?.() ?? undefined,
        displayName: member?.name || receipt.userId
      }
    })
  }

  getEventReaders(roomId: string, eventId: string): string[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const myUserId = client.getUserId()
    return this.getReadReceipts(roomId, eventId)
      .filter((receipt) => receipt.userId !== myUserId)
      .map((receipt) => receipt.userId)
  }

  getUnreadCount(roomId: string): number {
    const client = matrixClientService.getClient()
    if (!client) return 0

    const room = client.getRoom(roomId)
    if (!room) return 0

    const myUserId = client.getUserId()
    if (!myUserId) return 0

    const receipt = room.getEventReadUpTo(myUserId, false)
    if (!receipt) {
      return (
        (room.getUnreadNotificationCount?.(NotificationCountType.Highlight) ?? 0) +
        (room.getUnreadNotificationCount?.(NotificationCountType.Total) ?? 0)
      )
    }

    const timeline = room.getLiveTimeline()
    if (!timeline) return 0
    const events = timeline.getEvents()
    let unreadCount = 0

    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      if (event.getId() === receipt) break
      if (event.getSender() !== myUserId) {
        unreadCount++
      }
    }

    return unreadCount
  }

  hasUnread(roomId: string): boolean {
    const client = matrixClientService.getClient()
    if (!client) return false

    const room = client.getRoom(roomId)
    if (!room) return false

    return (
      (room.getUnreadNotificationCount?.(NotificationCountType.Highlight) ?? 0) > 0 ||
      (room.getUnreadNotificationCount?.(NotificationCountType.Total) ?? 0) > 0
    )
  }

  getRoomsWithUnread(): string[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    return rooms.filter((room) => this.hasUnread(room.roomId)).map((room) => room.roomId)
  }
}

export const matrixReceiptService = new MatrixReceiptService()
export default matrixReceiptService
