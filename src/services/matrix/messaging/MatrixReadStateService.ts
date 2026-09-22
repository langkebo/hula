import type { ReadReceiptsManager } from 'matrix-js-sdk'
import { NotificationCountType } from '@/types/matrix-js-sdk'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

/**
 * 单条已读回执的展示模型：谁（userId）读到了哪条事件（eventId）、何时读的（timestamp），
 * 以及可选的成员头像与展示名（由房间成员信息补全，缺失时 displayName 回退为 userId）。
 */
export interface ReadReceipt {
  userId: string
  eventId: string
  timestamp: number
  avatarUrl?: string
  displayName?: string
}

/**
 * 只读回执状态查询服务（债务 D7 从 `MatrixReceiptService` 拆出）。
 *
 * 只回答「谁读到了哪条事件」和「有多少未读」，不发送任何回执、不持有定时器或去重状态；
 * 回执发送、去重与延迟补发仍由 `MatrixReceiptService` 负责。
 *
 * 所有方法在 Matrix client 未初始化时安全降级为 `0` / `[]` / `false`，
 * 因此直接使用 `matrixClientService.getClient()` 的 null 守卫，而非会抛错的
 * `BaseMatrixService.getClient()`；调用方无需 try-catch。
 */
class MatrixReadStateService extends BaseMatrixService {
  /**
   * 读取指定事件的回执列表，并用房间成员信息补全头像与展示名。
   * client 未初始化或房间不存在时返回空数组。
   */
  getReadReceipts(roomId: string, eventId: string): ReadReceipt[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    // SDK 内部对 manager 做了 per-client memoize（getOrCreateManager），无需再自建缓存。
    const manager: ReadReceiptsManager = client.getReadReceiptsManager()
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

  /**
   * 读取指定事件的阅读者 MXID 列表，排除自己。
   * client 未初始化、房间不存在时返回空数组。
   */
  getEventReaders(roomId: string, eventId: string): string[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const myUserId = client.getUserId()
    return this.getReadReceipts(roomId, eventId)
      .filter((receipt) => receipt.userId !== myUserId)
      .map((receipt) => receipt.userId)
  }

  /**
   * 计算指定房间的未读数。
   *
   * 优先采用 SDK 的 `room.getUnreadNotificationCount(Total)`；无有效值且当前用户
   * 没有已读位置时回退为 Highlight + Total 之和；否则从本地时间线尾部向前统计
   * 自己以外的、位于已读位置之后的事件数。client 未初始化或房间不存在时返回 0。
   */
  getUnreadCount(roomId: string): number {
    const client = matrixClientService.getClient()
    if (!client) return 0

    const room = client.getRoom(roomId)
    if (!room) return 0

    const unreadNotificationCount = room.getUnreadNotificationCount?.(NotificationCountType.Total)
    if (typeof unreadNotificationCount === 'number' && unreadNotificationCount > 0) {
      return unreadNotificationCount
    }

    const myUserId = client.getUserId()
    if (!myUserId) return 0

    const receipt = room.getEventReadUpTo?.(myUserId, false)
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

  /**
   * 判断指定房间是否存在未读（Highlight 或 Total 任一大于 0）。
   * client 未初始化或房间不存在时返回 false。
   */
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

  /**
   * 列出所有存在未读的房间 ID。
   * client 未初始化时返回空数组；无未读房间时返回空数组。
   */
  getRoomsWithUnread(): string[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    return rooms.filter((room) => this.hasUnread(room.roomId)).map((room) => room.roomId)
  }
}

export const matrixReadStateService = new MatrixReadStateService()
export default matrixReadStateService
