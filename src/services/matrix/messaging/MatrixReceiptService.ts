import type { MatrixClient, MatrixEvent, ReadReceiptsManager, Room } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

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

class MatrixReceiptService extends BaseMatrixService {
  private cachedClient: MatrixClient | null = null
  private cachedManager: ReadReceiptsManager | null = null
  private pendingMarkAsReadTasks = new Map<string, PendingMarkAsReadTask>()
  private loggedDroppedReceiptRooms = new Set<string>()
  /**
   * 已成功发送的回执事件 ID（按 roomId）。用于去重：同一事件被多个路径
   * （房间已读、单条已读、线程已读、延迟补发）同时触发时，只发一次，
   * 避免服务端收到重复回执、也避免无意义的网络往返。
   * 仅在发送成功后才写入，发送失败不记录（下次可重试）。
   */
  private lastSentReceiptEventId = new Map<string, string>()

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

  /**
   * 发送房间最新事件回执。
   * 返回是否真的发出（或已存在）回执：偏好关闭 / 房间无事件时返回 false，
   * 供调用方判断能否回读服务端未读数（未发回执时服务端计数不会清零）。
   */
  private async sendLatestReadReceipt(roomId: string, room: Room): Promise<boolean> {
    const timeline = room.getLiveTimeline()
    const events = timeline.getEvents()
    const lastEvent = events[events.length - 1]

    if (!lastEvent) return false

    // 如果 lastEvent 是 MatrixEvent 实例，直接使用；否则提取 eventId 用 sendReadReceiptByEventId
    if (typeof lastEvent.getId === 'function') {
      return (await this.sendReadReceipt(roomId, lastEvent)) !== undefined
    }
    const eventId = (lastEvent as unknown as { event_id?: string }).event_id
    if (eventId) {
      return (await this.sendReadReceiptByEventId(roomId, eventId)) !== undefined
    }
    return false
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
      this.flushPendingMarkAsRead(roomId).catch((err) => {
        logger.error(`[MatrixReceipt] 补发已读回执未捕获异常: ${err}`)
      })
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
        this.flushPendingMarkAsRead(roomId).catch((err) => {
          logger.error(`[MatrixReceipt] 补发已读回执未捕获异常: ${err}`)
        })
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

  /**
   * 唯一的回执发送闸门：关闭「发送已读回执」后，所有实际发出回执的路径
   * （sendReadReceipt / sendReadReceiptByEventId / markRoomAsRead 及其延迟补发）
   * 都必须经过它，避免三处各写一遍判断而漏掉其中一条。
   */
  private shouldSendReadReceipts(): boolean {
    return useSettingStore().sendReadReceiptsEnabled
  }

  async sendReadReceipt(roomId: string, event: MatrixEvent): Promise<string | undefined> {
    if (!this.shouldSendReadReceipts()) {
      return undefined
    }

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

      // 去重：同一事件已标记/已发送过则跳过，避免重复回执。
      // 关键：标记必须在 await 之前【同步】完成。否则 changeRoom 末尾的 markSessionRead
      // 与单条已读并发触发同一 eventId 时，两次都会通过下方检查、各自 await 后双发回执。
      if (this.lastSentReceiptEventId.get(roomId) === eventId) {
        logger.info(`[MatrixReceipt] 阅读回执已发送过，跳过重复发送: ${roomId}/${eventId}`)
        return eventId
      }
      // 同步占位：吞噬并发的重复发送（原子去重）
      this.lastSentReceiptEventId.set(roomId, eventId)

      // SDK ReadReceiptsManager.sendReadReceiptByEventId 接受 (roomId, eventId)
      // 不要使用 sendReadReceipt(event)，因为它需要 MatrixEvent 实例
      const manager = this.getReadReceiptsManager()
      try {
        await manager.sendReadReceiptByEventId(roomId, eventId)
      } catch (sendErr) {
        // 发送失败：清除占位，允许后续重试（延迟补发任务会再次尝试）
        if (this.lastSentReceiptEventId.get(roomId) === eventId) {
          this.lastSentReceiptEventId.delete(roomId)
        }
        throw sendErr
      }
      logger.info(`[MatrixReceipt] 发送阅读回执成功: ${roomId}/${eventId}`)
      return eventId
    } catch (err) {
      logger.error(`[MatrixReceipt] 发送阅读回执失败: ${err}`)
      throw err
    }
  }

  async sendReadReceiptByEventId(roomId: string, eventId: string): Promise<string | undefined> {
    if (!this.shouldSendReadReceipts()) {
      return undefined
    }

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

  /**
   * 设置 m.fully_read 阅读位置标记。
   * 刻意不受「发送已读回执」偏好约束：它写的是自己的账户数据（阅读位置），
   * 不是对同房间成员可见的 m.read 回执，关闭回执不应冻结本地阅读位置。
   */
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

  /**
   * 标记房间已读。
   * 返回是否真的发出（或已存在）回执：关闭「发送已读回执」偏好、房间未就绪
   * （仅入延迟补发队列）时返回 false。调用方据此决定是否回读服务端未读数——
   * 未发回执时服务端 unread_count 不会清零，回读会把本地刚清掉的角标弹回来。
   */
  async markRoomAsRead(roomId: string): Promise<boolean> {
    if (!this.shouldSendReadReceipts()) {
      return false
    }

    this.getClient()

    try {
      const room = await this.waitForRoomAvailable(roomId)
      if (!room) {
        this.enqueuePendingMarkAsRead(roomId)
        return false
      }

      this.loggedDroppedReceiptRooms.delete(roomId)
      this.clearPendingMarkAsReadTask(roomId)
      return await this.sendLatestReadReceipt(roomId, room)
    } catch (err) {
      logger.error(`[MatrixReceipt] 标记房间已读失败: ${err}`)
      throw err
    }
  }

  /**
   * FT-133: 显式清理缓存的 client/manager 引用和 pending 任务。
   * 应在登出/会话切换时调用，避免缓存持有旧 client 引用阻碍 GC。
   */
  clearCache(): void {
    this.cachedClient = null
    this.cachedManager = null
    this.lastSentReceiptEventId.clear()

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
