/**
 * MatrixEventRouter — 事件路由 + 房间监听器管理深模块
 *
 * 职责：
 * - 管理 SDK 事件监听器的注册与注销（sync/room/room_timeline/redaction/decrypted/typing/receipt/to_device）
 * - 管理 Room 级别监听器（Room.name / RoomState.events）+ setMaxListeners(30)
 * - 订阅 SlidingSync Lifecycle 事件（通过 syncManager 封装）
 * - 提供外部事件系统（on/off/emit）供消费者订阅
 * - 转发 timeline/redaction 事件到 Worker（搜索索引更新）
 *
 * 不负责：
 * - 连接状态映射（由 ConnectionManager 负责）
 * - Crypto 状态追踪（由 MatrixCryptoStateTracker 负责）
 *
 * @see codebase-design — 深模块：setup/detach/on/off/emit 小接口 + 复杂监听器管理实现
 */

import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { createLogger } from '@/utils/Logger'
import type { SearchEventDoc } from '@/workers/matrixWorkerTypes'
import type { MatrixSyncManager } from './MatrixSyncManager'
import { BURN_READ_TO_DEVICE_EVENT, type BurnReadToDeviceContent } from './messaging/burnReadSignal'
import {
  ClientEvent,
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
  type Room,
  RoomEvent,
  RoomMemberEvent,
  SlidingSyncState
} from './sdk'

/** 同步状态处理回调（由 facade 设置，委托给 ConnectionManager） */
type SyncStateHandler = (state: string, prevState?: string, data?: unknown) => void

/** SlidingSync Lifecycle 错误回调（由 facade 设置，委托给 ConnectionManager.handleSyncLifecycleError） */
type SyncLifecycleErrorHandler = (err: Error) => void

/** SlidingSync Lifecycle 成功回调（由 facade 设置，委托给 ConnectionManager.resetSyncErrorCount） */
type SyncLifecycleResetHandler = () => void

/** 事件解密回调（由 facade 设置，委托给 CryptoStateTracker） */
type EventDecryptedHandler = (event: MatrixEvent, err?: Error) => void

const logger = createLogger('MatrixEventRouter')

/** 搜索索引事件的聚合窗口（ms）：同步风暴时把逐条写索引合并为批量请求。 */
const SEARCH_EVENT_BATCH_WINDOW_MS = 50
/** 单批事件上限：超出按最旧丢弃，形成背压保护（索引可重建，丢批优于内存持续膨胀）。 */
const SEARCH_EVENT_BATCH_MAX = 200
/** 真实写入报错的最大重试次数；超过后丢批并告警一次。 */
const SEARCH_FLUSH_MAX_RETRIES = 3
/**
 * worker 未启动时的退避参数（起点 / 单次上限 / 总时限）。
 *
 * 冷启动实测 spawn + SDK 求值需要 0.6–1.5s，旧实现按「50ms 窗口 × 3 次」重试，
 * 预算只有约 150ms，冷启动期间到达的事件必然被丢弃。改为指数退避 + 总时限：
 * 等待期间既不算作写入失败，也不会无限攒内存（单批上限仍在生效）。
 */
const SEARCH_FLUSH_WAIT_BASE_MS = 50
const SEARCH_FLUSH_WAIT_MAX_MS = 1_600
const SEARCH_FLUSH_WAIT_DEADLINE_MS = 30_000

/**
 * 事件路由器
 *
 * 深模块：小接口（setup/detach/on/off/emit）+ 大实现
 * （8 个 SDK 事件监听器、Room 级监听器管理、Worker 转发、Mitt 事件桥接）
 */
export class MatrixEventRouter {
  private readonly eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  /** 待写入搜索索引的事件缓冲（P-02：50ms 窗口聚合，降低跨线程消息数）。 */
  private pendingSearchEvents: SearchEventDoc[] = []
  private searchFlushTimer: ReturnType<typeof setTimeout> | null = null
  /** 因单批上限被丢弃的事件数，仅在下次落批时汇总告警一次。 */
  private droppedSearchEvents = 0
  /** 连续写入失败次数（不含等待 worker 启动）；成功一次即清零。 */
  private searchFlushRetries = 0
  /** 等待 worker 启动的退避次数。 */
  private searchFlushWaitAttempts = 0
  /** 开始等待 worker 启动的时间戳（ms）；成功落批后清空。 */
  private searchFlushWaitingSince: number | null = null
  private readonly roomListeners: Map<string, { room: Room; handlers: Map<string, (...args: unknown[]) => void> }> =
    new Map()
  private observedClient: MatrixClient | null = null

  private syncStateHandler: SyncStateHandler | null = null
  private lifecycleErrorHandler: SyncLifecycleErrorHandler | null = null
  private lifecycleResetHandler: SyncLifecycleResetHandler | null = null
  private eventDecryptedHandler: EventDecryptedHandler | null = null

  // ---- SDK 事件监听器（箭头函数绑定 this）-----------------------------------------

  private readonly syncListener = (state: unknown, prevState?: unknown, data?: unknown) => {
    this.emit('sync', { state, prevState, data })
    this.syncStateHandler?.(state as string, prevState as string | undefined, data)
  }

  private readonly roomListener = (room: Room) => {
    this.emit('room', room)

    const homeserverUrl = this.observedClient?.getHomeserverUrl() || ''

    const updateRoom = () => {
      const avatarUrl = room.getAvatarUrl(homeserverUrl, 48, 48, 'crop') || undefined
      void matrixWorkerHost
        .upsertSearchRooms([
          {
            roomId: room.roomId,
            name: room.name,
            memberCount: room.getJoinedMemberCount(),
            ...(avatarUrl !== undefined ? { avatarUrl } : {})
          }
        ])
        .catch(() => {
          // Worker 转发失败不输出日志，避免刷屏
        })
    }

    updateRoom()

    const roomAny = room as {
      on: (event: string, handler: (...args: unknown[]) => void) => void
      off: (event: string, handler: (...args: unknown[]) => void) => void
      setMaxListeners?: (n: number) => void
      getLiveState?: () => {
        setMaxListeners?: (n: number) => void
      }
    }
    if (typeof roomAny.on === 'function') {
      // 针对具体 Room/RoomState 实例设置监听器上限，避免全局副作用。
      // SDK 的 RoomState 继承自 EventEmitter，默认 maxListeners=10。
      // 多房间场景下 RoomState.members 监听器会超过 10（实测 50 个房间时达 51），
      // 触发内存泄漏警告。实例级设置仅影响当前对象，不污染全局。
      roomAny.setMaxListeners?.(30)
      roomAny.getLiveState?.().setMaxListeners?.(30)

      const roomNameHandler: (...args: unknown[]) => void = () => updateRoom()
      const roomStateEventsHandler: (...args: unknown[]) => void = (event: unknown) => {
        const matrixEvent = event as MatrixEvent
        const type = matrixEvent.getType()
        if (type === 'm.room.avatar' || type === 'm.room.name' || type === 'm.room.member') {
          updateRoom()
        }
      }

      roomAny.on('Room.name', roomNameHandler)
      roomAny.on('RoomState.events', roomStateEventsHandler)

      this.roomListeners.set(room.roomId, {
        room,
        handlers: new Map([
          ['Room.name', roomNameHandler],
          ['RoomState.events', roomStateEventsHandler]
        ])
      })
    }
  }

  private readonly roomTimelineListener = (event: MatrixEvent, room: Room | undefined) => {
    this.emit('timeline', { event, room })

    if (event.getType() === 'm.room.message' && event.getContent().msgtype === 'm.text') {
      const searchEventDoc: SearchEventDoc = {
        eventId: event.getId()!,
        roomId: event.getRoomId()!,
        sender: event.getSender()!,
        timestamp: event.getTs(),
        msgtype: 'm.text',
        body: event.getContent().body as string
      }
      this.queueSearchEvent(searchEventDoc)
    }
  }

  private readonly redactionListener = (...args: unknown[]) => {
    const event = args[0] as MatrixEvent
    const redactedEventId = event.getAssociatedId()
    if (redactedEventId) {
      void matrixWorkerHost.redactSearchEvent(redactedEventId).catch(() => {
        // Worker 转发失败不输出日志，避免刷屏
      })
    }
  }

  private readonly eventDecryptedListener = (event: MatrixEvent, err?: Error) => {
    const roomId = event.getRoomId()
    const room = roomId ? this.observedClient?.getRoom(roomId) : undefined
    this.eventDecryptedHandler?.(event, err)
    this.emit('eventDecrypted', { event, err, room })
  }

  private readonly typingListener = (...args: unknown[]) => {
    const room = args[1] as Room | undefined
    if (room) {
      useMitt.emit(MittEnum.ROOM_TYPING_CHANGED, { roomId: room.roomId })
    }
  }

  private readonly receiptListener = (...args: unknown[]) => {
    const event = args[0] as MatrixEvent | undefined
    const room = args[1] as Room | undefined
    if (!room) return
    useMitt.emit(MittEnum.ROOM_RECEIPT_CHANGED, { roomId: room.roomId })
    this.emitBurnReadFromReceipts(event, room)
  }

  /**
   * 把「对端对本人焚毁消息的 m.read 回执」翻译成 BURN_MESSAGE_READ。
   *
   * 服务端 burn sweep 只把待焚毁行标记 processed，既不 redact 房间事件、也不广播任何事件，
   * 因此接收方阅读后补发的 m.read 回执（经 Sliding Sync receipts 扩展广播）是发送端
   * 跨端阅读信号的主通道；发送端据此启动倒计时，最终本地焚毁，形成双端闭环。
   *
   * 接收方关闭「发送已读回执」时不会有该回执，此时改由 toDeviceBurnListener 兜底。
   */
  private emitBurnReadFromReceipts(event: MatrixEvent | undefined, room: Room): void {
    const content = event?.getContent() as Record<string, unknown> | undefined
    if (!content) return
    const selfUserId = this.observedClient?.getUserId()
    if (!selfUserId) return

    for (const [eventId, byType] of Object.entries(content)) {
      const readMap = (byType as Record<string, unknown> | undefined)?.['m.read'] as Record<string, unknown> | undefined
      if (!readMap) continue
      const peerRead = Object.keys(readMap).some((userId) => userId !== selfUserId)
      if (!peerRead) continue
      this.emitBurnReadIfOwned(room, eventId)
    }
  }

  /**
   * 接收方关闭已读回执时的兜底通道：`com.tjg.burn_read` to-device 定向信号。
   *
   * 该事件只投递给原消息发送者的设备，不含房间广播，因此不会向其他成员泄露阅读状态。
   */
  private readonly toDeviceBurnListener = (...args: unknown[]) => {
    const event = args[0] as MatrixEvent | undefined
    if (!event || event.getType() !== BURN_READ_TO_DEVICE_EVENT) return

    const selfUserId = this.observedClient?.getUserId()
    if (!selfUserId) return
    // 自己发出的信号直接忽略，避免自触发
    if (event.getSender() === selfUserId) return

    const content = event.getContent() as Partial<BurnReadToDeviceContent> | undefined
    const roomId = content?.room_id
    const eventId = content?.event_id
    if (!roomId || !eventId) return

    const room = this.observedClient?.getRoom(roomId)
    if (!room) return
    this.emitBurnReadIfOwned(room, eventId)
  }

  /**
   * 若 `eventId` 指向本人发送的焚毁消息，则发出 BURN_MESSAGE_READ。
   *
   * 四项校验（防止伪造信号烧毁任意消息）：事件存在、发送者是本人、内容带
   * `m.burn_after_read`；调用方负责校验信号来源不是本人。
   */
  private emitBurnReadIfOwned(room: Room, eventId: string): void {
    const selfUserId = this.observedClient?.getUserId()
    if (!selfUserId) return

    const target = room.findEventById(eventId)
    if (!target) return
    if (target.getSender() !== selfUserId) return
    if (!(target.getContent() as Record<string, unknown> | undefined)?.['m.burn_after_read']) return

    useMitt.emit(MittEnum.BURN_MESSAGE_READ, { eventId, readAt: Date.now() })
  }

  private readonly syncLifecycleListener = (state: SlidingSyncState, _resp: unknown, err?: Error): void => {
    if (state === SlidingSyncState.RequestFinished && err) {
      this.lifecycleErrorHandler?.(err)
      this.emit('sync-request-error', err)
    } else if (state === SlidingSyncState.Complete) {
      this.lifecycleResetHandler?.()
    }
  }

  // ---- 公开接口 ----------------------------------------------------------------

  /**
   * 设置同步状态处理器（由 facade 在 startClient 时设置）
   *
   * 处理器内部委托给 ConnectionManager.mapSyncState + updateConnectionState + syncManager.markReady
   */
  setSyncStateHandler(handler: SyncStateHandler): void {
    this.syncStateHandler = handler
  }

  /** 设置同步生命周期错误处理器
   */
  setLifecycleErrorHandler(handler: SyncLifecycleErrorHandler): void {
    this.lifecycleErrorHandler = handler
  }

  /** 设置同步生命周期重置处理器
   */
  setLifecycleResetHandler(handler: SyncLifecycleResetHandler): void {
    this.lifecycleResetHandler = handler
  }

  /** 设置事件解密处理器
   */
  setEventDecryptedHandler(handler: EventDecryptedHandler): void {
    this.eventDecryptedHandler = handler
  }

  /**
   * 注册所有 SDK 事件监听器
   *
   * 隐藏的复杂实现：
   * - 8 个 client.on() 注册（sync/room/room_timeline/redaction/decrypted/typing/receipt/to_device）
   * - SlidingSync Lifecycle 订阅（通过 syncManager 封装）
   * - 防重复注册（observedClient 去重）
   * - 旧 client 自动 detach
   */
  setup(client: MatrixClient, syncManager: MatrixSyncManager): void {
    if (this.observedClient === client) {
      return
    }

    if (this.observedClient) {
      this.detach(this.observedClient, syncManager)
    }

    // client EventEmitter 监听器累积超过默认上限 10（8 个本路由 + VoIP/Push/Presence/SpecialFriend 等），
    // 提升实例级 maxListeners 至 50 以避免 MaxListenersExceededWarning。
    const clientAny = client as { setMaxListeners?: (n: number) => void }
    clientAny.setMaxListeners?.(50)

    client.on(ClientEvent.Sync, this.syncListener)
    client.on(ClientEvent.Room, this.roomListener)
    client.on(RoomEvent.Timeline, this.roomTimelineListener)
    client.on(RoomEvent.Redaction, this.redactionListener)
    client.on(MatrixEventEvent.Decrypted, this.eventDecryptedListener)
    client.on(RoomMemberEvent.Typing, this.typingListener)
    client.on(RoomEvent.Receipt, this.receiptListener)
    client.on(ClientEvent.ToDeviceEvent, this.toDeviceBurnListener)

    // 订阅 SlidingSync Lifecycle 事件，补全 SDK 瞬时错误感知 seam。
    this.syncManager_onLifecycleEvent(syncManager, this.syncLifecycleListener)

    this.observedClient = client
  }

  /**
   * 注销所有 SDK 事件监听器
   *
   * 隐藏的复杂实现：
   * - 8 个 client.off() 注销
   * - SlidingSync Lifecycle 取消订阅
   * - Room 级监听器批量清理
   */
  detach(client: MatrixClient, syncManager: MatrixSyncManager): void {
    client.off(ClientEvent.Sync, this.syncListener)
    client.off(ClientEvent.Room, this.roomListener)
    client.off(RoomEvent.Timeline, this.roomTimelineListener)
    client.off(RoomEvent.Redaction, this.redactionListener)
    client.off(MatrixEventEvent.Decrypted, this.eventDecryptedListener)
    client.off(RoomMemberEvent.Typing, this.typingListener)
    client.off(RoomEvent.Receipt, this.receiptListener)
    client.off(ClientEvent.ToDeviceEvent, this.toDeviceBurnListener)

    this.syncManager_offLifecycleEvent(syncManager, this.syncLifecycleListener)
    // 收尾路径：写一次成功则保留索引，失败不再回队重试（router 正在脱离当前 client）
    this.flushSearchEvents(true)
    this.detachRoomListeners()
    this.observedClient = null
  }

  /** 缓冲一条搜索索引事件，按 50ms 窗口批量落盘（P-02）。 */
  private queueSearchEvent(doc: SearchEventDoc): void {
    this.pendingSearchEvents.push(doc)
    if (this.pendingSearchEvents.length > SEARCH_EVENT_BATCH_MAX) {
      const overflow = this.pendingSearchEvents.length - SEARCH_EVENT_BATCH_MAX
      this.pendingSearchEvents.splice(0, overflow)
      this.droppedSearchEvents += overflow
    }
    if (this.searchFlushTimer) return
    this.searchFlushTimer = setTimeout(() => this.flushSearchEvents(), SEARCH_EVENT_BATCH_WINDOW_MS)
  }

  /**
   * 落批：一次跨线程写入整批事件。
   *
   * `discardOnFailure` 用于 detach 等收尾路径（此时不再保留数据）；
   * 正常路径下 worker 未启动或写入失败都把批次放回缓冲，下个窗口重试——
   * 旧实现直接丢弃，worker 启动稍晚就会永久丢掉这段时间的搜索索引。
   */
  private flushSearchEvents(discardOnFailure = false): void {
    if (this.searchFlushTimer) {
      clearTimeout(this.searchFlushTimer)
      this.searchFlushTimer = null
    }
    if (this.pendingSearchEvents.length === 0) {
      this.resetSearchFlushState()
      return
    }
    if (!matrixWorkerHost.isStarted) {
      if (discardOnFailure) {
        // P-12：detach 收尾时 worker 可能已被登出流程 terminate。索引已随 worker 销毁，
        // 此处静默丢弃缓冲，不再发一个注定失败的请求（旧实现会绕过 guard 并报写入失败）。
        this.pendingSearchEvents = []
        this.droppedSearchEvents = 0
        this.resetSearchFlushState()
        return
      }
      this.requeueSearchEvents(undefined, 'worker-not-started')
      return
    }

    const batch = this.pendingSearchEvents
    this.pendingSearchEvents = []
    if (this.droppedSearchEvents > 0) {
      logger.warn(`搜索索引背压丢弃 ${this.droppedSearchEvents} 条事件（单批上限 ${SEARCH_EVENT_BATCH_MAX}）`)
      this.droppedSearchEvents = 0
    }
    void matrixWorkerHost
      .upsertSearchEvents(batch)
      .then(() => {
        this.resetSearchFlushState()
      })
      .catch((err) => {
        if (discardOnFailure) {
          logger.warn('搜索索引批量写入失败（收尾丢弃）:', err)
          return
        }
        logger.warn('搜索索引批量写入失败，稍后重试:', err)
        this.requeueSearchEvents(batch, 'write-failed')
      })
  }

  /**
   * 把批次放回缓冲并安排下一次落批。
   *
   * - `worker-not-started`：worker 还没起来，按指数退避重试，不消耗写入失败预算；
   *   超过 {@link SEARCH_FLUSH_WAIT_DEADLINE_MS} 仍未启动才丢批。
   * - `write-failed`：真实写入报错，保留 {@link SEARCH_FLUSH_MAX_RETRIES} 次上限。
   */
  private requeueSearchEvents(
    batch: SearchEventDoc[] | undefined,
    reason: 'worker-not-started' | 'write-failed'
  ): void {
    if (batch) {
      this.pendingSearchEvents = batch.concat(this.pendingSearchEvents)
    }
    if (reason === 'worker-not-started') {
      const now = Date.now()
      this.searchFlushWaitingSince ??= now
      if (now - this.searchFlushWaitingSince >= SEARCH_FLUSH_WAIT_DEADLINE_MS) {
        const dropped = this.pendingSearchEvents.length
        this.pendingSearchEvents = []
        this.resetSearchFlushState()
        if (dropped > 0) {
          logger.warn(`worker 在 ${SEARCH_FLUSH_WAIT_DEADLINE_MS}ms 内仍未启动，丢弃 ${dropped} 条搜索索引事件`)
        }
        return
      }
      const delay = Math.min(SEARCH_FLUSH_WAIT_BASE_MS * 2 ** this.searchFlushWaitAttempts, SEARCH_FLUSH_WAIT_MAX_MS)
      this.searchFlushWaitAttempts += 1
      this.searchFlushTimer = setTimeout(() => this.flushSearchEvents(), delay)
      return
    }

    if (this.searchFlushRetries >= SEARCH_FLUSH_MAX_RETRIES) {
      const dropped = this.pendingSearchEvents.length
      this.pendingSearchEvents = []
      this.resetSearchFlushState()
      if (dropped > 0) {
        logger.warn(`搜索索引连续 ${SEARCH_FLUSH_MAX_RETRIES} 次写入失败，丢弃 ${dropped} 条事件`)
      }
      return
    }
    this.searchFlushRetries += 1
    this.searchFlushTimer = setTimeout(() => this.flushSearchEvents(), SEARCH_EVENT_BATCH_WINDOW_MS)
  }

  /** 落批成功或批次清空后重置退避/重试状态。 */
  private resetSearchFlushState(): void {
    this.searchFlushRetries = 0
    this.searchFlushWaitAttempts = 0
    this.searchFlushWaitingSince = null
  }

  /** 分离房间事件监听器
   */
  detachRoomListeners(): void {
    for (const [, entry] of this.roomListeners) {
      const roomAny = entry.room as {
        off: (event: string, handler: (...args: unknown[]) => void) => void
      }
      if (typeof roomAny.off === 'function') {
        for (const [event, handler] of entry.handlers) {
          roomAny.off(event, handler)
        }
      }
    }
    this.roomListeners.clear()
  }

  // ---- 外部事件系统（on/off/emit）-----------------------------------------------

  /** 订阅事件 */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  /** 取消订阅事件 */
  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /** 触发指定事件
   */
  emit(event: string, ...data: unknown[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(...data))
    }
  }

  /** 清除所有外部监听器
   */
  clearExternalListeners(): void {
    this.eventListeners.clear()
  }

  /** 获取当前观察的客户端实例
   */
  getObservedClient(): MatrixClient | null {
    return this.observedClient
  }

  // ---- 内部辅助方法 ------------------------------------------------------------

  /**
   * 封装 syncManager.onLifecycleEvent 调用，便于测试 mock
   * SlidingSyncState.RequestFinished + err → lifecycleErrorHandler
   */
  private syncManager_onLifecycleEvent(
    syncManager: MatrixSyncManager,
    handler: (state: SlidingSyncState, resp: unknown, err?: Error) => void
  ): void {
    syncManager.onLifecycleEvent(handler)
  }

  /** 封装 syncManager.offLifecycleEvent 调用，便于测试 mock */
  private syncManager_offLifecycleEvent(
    syncManager: MatrixSyncManager,
    handler: (state: SlidingSyncState, resp: unknown, err?: Error) => void
  ): void {
    syncManager.offLifecycleEvent(handler)
  }
}
