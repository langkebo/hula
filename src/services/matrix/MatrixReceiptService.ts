import type { MatrixEvent } from 'matrix-js-sdk'
import { NotificationCountType, ReceiptType } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface ReadReceipt {
  userId: string
  eventId: string
  timestamp: number
  avatarUrl?: string
  displayName?: string
}

class MatrixReceiptService {
  async sendReadReceipt(roomId: string, event: MatrixEvent): Promise<string | undefined> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReceipt] 客户端未初始化')
    }

    try {
      const response = await client.sendReadReceipt(event, ReceiptType.Read)
      info(`[MatrixReceipt] 发送阅读回执成功: ${roomId}/${event.getId()}`)
      return response?.event_id
    } catch (err) {
      error(`[MatrixReceipt] 发送阅读回执失败: ${err}`)
      throw err
    }
  }

  async sendReadReceiptByEventId(roomId: string, eventId: string): Promise<string | undefined> {
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
    const event = events.find(e => e.getId() === eventId)
    
    if (!event) {
      throw new Error(`[MatrixReceipt] 事件不存在: ${eventId}`)
    }

    return this.sendReadReceipt(roomId, event)
  }

  async sendReadMarker(roomId: string, eventId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReceipt] 客户端未初始化')
    }

    try {
      await client.setRoomReadMarkers(roomId, eventId, undefined as any, undefined as any)
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

    const receipts: ReadReceipt[] = []
    const receiptContent = (room as any).getReadReceipts?.() || []

    for (const receipt of receiptContent) {
      if (receipt.eventId === eventId) {
        const member = room.getMember(receipt.userId)
        receipts.push({
          userId: receipt.userId,
          eventId: receipt.eventId,
          timestamp: receipt.data?.ts || 0,
          avatarUrl: member?.getMxcAvatarUrl?.(),
          displayName: member?.name || receipt.userId
        })
      }
    }

    return receipts
  }

  getEventReaders(roomId: string, eventId: string): string[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const readers: string[] = []
    const myUserId = client.getUserId()

    const receiptContent = (room as any).getReadReceipts?.() || []
    for (const receipt of receiptContent) {
      if (receipt.eventId === eventId && receipt.userId !== myUserId) {
        readers.push(receipt.userId)
      }
    }

    return readers
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
      return room.getUnreadNotificationCount(NotificationCountType.Highlight) + 
             room.getUnreadNotificationCount(NotificationCountType.Total)
    }

    const timeline = room.getLiveTimeline()
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

    return room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0 || 
           room.getUnreadNotificationCount(NotificationCountType.Total) > 0
  }

  getRoomsWithUnread(): string[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    return rooms
      .filter(room => this.hasUnread(room.roomId))
      .map(room => room.roomId)
  }
}

export const matrixReceiptService = new MatrixReceiptService()
export default matrixReceiptService
