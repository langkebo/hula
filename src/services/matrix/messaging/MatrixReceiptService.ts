import type { MatrixClient, MatrixEvent, ReadReceiptsManager, Room } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { NotificationCountType } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixReceiptService')

const ROOM_READY_TIMEOUT_MS = 3000
const ROOM_READY_POLL_INTERVAL_MS = 100
const DEFERRED_READ_RETRY_INTERVAL_MS = 1000
const DEFERRED_READ_MAX_AGE_MS = 15000

interface WaitForRoomOptions {
  timeoutMs?: number
}

interface PendingMarkAsReadTask {
  roomId: string
  queuedAt: number
  timer: ReturnType<typeof setTimeout> | null
}

export interface ReadReceipt {
  userId: string
  eventId: string
  timestamp: number
  avatarUrl?: string
  displayName?: string
}

class MatrixReceiptService extends BaseMatrixService {
  private cachedClient: MatrixClient | null = null
  private cachedManager: ReadReceiptsManager | null = null
  private pendingMarkAsReadTasks = new Map<string, PendingMarkAsReadTask>()
  private loggedDroppedReceiptRooms = new Set<string>()

  private getRoomIfAvailable(roomId: string): Room | null {
    return this.getClient().getRoom(roomId) ?? null
  }

  private async waitForRoomAvailable(roomId: string, options: WaitForRoomOptions = {}): Promise<Room | null> {
    const client = this.getClient()
    const timeoutMs = options.timeoutMs ?? ROOM_READY_TIMEOUT_MS

    let room = client.getRoom(roomId)
    if (room) {
      return room
    }

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, ROOM_READY_POLL_INTERVAL_MS))
      room = client.getRoom(roomId)
      if (room) {
        return room
      }
    }

    return null
  }

  private clearPendingMarkAsReadTask(roomId: string): void {
    const task = this.pendingMarkAsReadTasks.get(roomId)
    if (!task) {
      return
    }
    if (task.timer) {
      clearTimeout(task.timer)
    }
    this.pendingMarkAsReadTasks.delete(roomId)
  }

  private async sendLatestReadReceipt(roomId: string, room: Room): Promise<void> {
    const timeline = room.getLiveTimeline()
    const events = timeline.getEvents()
    const lastEvent = events[events.length - 1]

    if (!lastEvent) return

    // 如果 lastEvent 是 MatrixEvent 实例，直接使用；否则提取 eventId 用 sendReadReceiptByEventId
    if (typeof lastEvent.getId === 'function') {
      await this.sendReadReceipt(roomId, lastEvent)
    } else {
      const eventId = (lastEvent as unknown as { event_id?: string }).event_id
      if (eventId) {
        await this.sendReadReceiptByEventId(roomId, eventId)
      }
    }
  }

  private enqueuePendingMarkAsRead(roomId: string): void {
    const existingTask = this.pendingMarkAsReadTasks.get(roomId)
    if (existingTask) {
      return
    }

    const task: PendingMarkAsReadTask = {
      roomId,
      queuedAt: Date.now(),
      timer: null
    }
    this.pendingMarkAsReadTasks.set(roomId, task)
    task.timer = setTimeout(() => {
      void this.flushPendingMarkAsRead(roomId)
    }, DEFERRED_READ_RETRY_INTERVAL_MS)
  }

  private async flushPendingMarkAsRead(roomId: string): Promise<void> {
    const task = this.pendingMarkAsReadTasks.get(roomId)
    if (!task) {
      return
    }

    try {
      const room = this.getRoomIfAvailable(roomId)
      if (room) {
        this.clearPendingMarkAsReadTask(roomId)
        await this.sendLatestReadReceipt(roomId, room)
        return
      }

      if (Date.now() - task.queuedAt >= DEFERRED_READ_MAX_AGE_MS) {
        this.clearPendingMarkAsReadTask(roomId)
        if (!this.loggedDroppedReceiptRooms.has(roomId)) {
          this.loggedDroppedReceiptRooms.add(roomId)
          logger.info(`[MatrixReceipt] 房间长时间未就绪，已跳过本次已读补发: ${roomId}`)
        }
        return
      }

      task.timer = setTimeout(() => {
        void this.flushPendingMarkAsRead(roomId)
      }, DEFERRED_READ_RETRY_INTERVAL_MS)
    } catch (err) {
      this.clearPendingMarkAsReadTask(roomId)
      logger.error(`[MatrixReceipt] 补发已读回执失败: ${err}`)
    }
  }

  private getReadReceiptsManager(): ReadReceiptsManager {
    const client = this.getClient()

    if (this.cachedClient !== client || !this.cachedManager) {
      this.cachedClient = client
      this.cachedManager = client.getReadReceiptsManager()
    }

    return this.cachedManager!
  }

  async sendReadReceipt(roomId: string, event: MatrixEvent): Promise<string | undefined> {
    try {
      // event 可能是普通对象（如从 Sliding Sync/Worker 传来的序列化数据），需要兼容处理
      const eventId =
        typeof event.getId === 'function'
          ? event.getId()
          : ((event as unknown as { event_id?: string; id?: string }).event_id ??
            (event as unknown as { event_id?: string; id?: string }).id)
      if (!eventId) {
        throw new Error(this.t('matrix_error.messaging.receipt_event_id_missing'))
      }

      // SDK ReadReceiptsManager.sendReadReceiptByEventId 接受 (roomId, eventId)
      // 不要使用 sendReadReceipt(event)，因为它需要 MatrixEvent 实例
      const manager = this.getReadReceiptsManager()
      await manager.sendReadReceiptByEventId(roomId, eventId)
      logger.info(`[MatrixReceipt] 发送阅读回执成功: ${roomId}/${eventId}`)
      return eventId
    } catch (err) {
      logger.error(`[MatrixReceipt] 发送阅读回执失败: ${err}`)
      throw err
    }
  }

  async sendReadReceiptByEventId(roomId: string, eventId: string): Promise<string | undefined> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('receipt', roomId, { roomId, eventId })
      logger.info(`[MatrixReceipt] 离线状态，已将阅读回执入队: ${roomId}/${eventId}`)
      return eventId
    }

    try {
      const room = await this.waitForRoomAvailable(roomId)
      if (!room) {
        return undefined
      }

      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()
      const event = events.find((e) => e.getId() === eventId)

      if (!event) {
        throw new Error(this.t('matrix_error.messaging.event_not_found', { eventId }))
      }

      return this.sendReadReceipt(roomId, event)
    } catch (err) {
      logger.error(`[MatrixReceipt] 通过事件ID发送阅读回执失败: ${err}`)
      throw err
    }
  }

  async sendReadMarker(roomId: string, eventId: string): Promise<void> {
    try {
      const manager = this.getReadReceiptsManager()
      await manager.setReadMarker(roomId, eventId)
      logger.info(`[MatrixReceipt] 设置阅读标记成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`[MatrixReceipt] 设置阅读标记失败: ${err}`)
      throw err
    }
  }

  async markRoomAsRead(roomId: string): Promise<void> {
    this.getClient()

    try {
      const room = await this.waitForRoomAvailable(roomId)
      if (!room) {
        this.enqueuePendingMarkAsRead(roomId)
        return
      }

      this.loggedDroppedReceiptRooms.delete(roomId)
      this.clearPendingMarkAsReadTask(roomId)
      await this.sendLatestReadReceipt(roomId, room)
    } catch (err) {
      logger.error(`[MatrixReceipt] 标记房间已读失败: ${err}`)
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

  /**
   * FT-133: 显式清理缓存的 client/manager 引用和 pending 任务。
   * 应在登出/会话切换时调用，避免缓存持有旧 client 引用阻碍 GC。
   */
  clearCache(): void {
    this.cachedClient = null
    this.cachedManager = null

    this.pendingMarkAsReadTasks.forEach((task) => {
      if (task.timer) {
        clearTimeout(task.timer)
      }
    })
    this.pendingMarkAsReadTasks.clear()
    this.loggedDroppedReceiptRooms.clear()

    logger.info('[MatrixReceipt] 缓存已清理 (cachedClient/cachedManager/pendingTasks)')
  }
}

export const matrixReceiptService = new MatrixReceiptService()
export default matrixReceiptService
