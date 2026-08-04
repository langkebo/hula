/**
 * MatrixEventRouter — 事件路由 + 房间监听器管理深模块
 *
 * 职责：
 * - 管理 SDK 事件监听器的注册与注销（sync/room/room_timeline/redaction/decrypted/typing/receipt）
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
import { type MatrixClient, type MatrixEvent, type Room, SlidingSyncState } from 'matrix-js-sdk'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import type { SearchEventDoc } from '@/workers/matrixWorkerTypes'
import type { MatrixSyncManager } from './MatrixSyncManager'

/** 同步状态处理回调（由 facade 设置，委托给 ConnectionManager） */
export type SyncStateHandler = (state: string, prevState?: string, data?: unknown) => void

/** SlidingSync Lifecycle 错误回调（由 facade 设置，委托给 ConnectionManager.handleSyncLifecycleError） */
export type SyncLifecycleErrorHandler = (err: Error) => void

/** SlidingSync Lifecycle 成功回调（由 facade 设置，委托给 ConnectionManager.resetSyncErrorCount） */
export type SyncLifecycleResetHandler = () => void

/** 事件解密回调（由 facade 设置，委托给 CryptoStateTracker） */
export type EventDecryptedHandler = (event: MatrixEvent, err?: Error) => void

/**
 * 事件路由器
 *
 * 深模块：小接口（setup/detach/on/off/emit）+ 大实现
 * （7 个 SDK 事件监听器、Room 级监听器管理、Worker 转发、Mitt 事件桥接）
 */
export class MatrixEventRouter {
  private readonly eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  private readonly roomListeners: Map<string, { room: Room; handlers: Map<string, (...args: unknown[]) => void> }> =
    new Map()
  private observedClient: MatrixClient | null = null

  private syncStateHandler: SyncStateHandler | null = null
  private lifecycleErrorHandler: SyncLifecycleErrorHandler | null = null
  private lifecycleResetHandler: SyncLifecycleResetHandler | null = null
  private eventDecryptedHandler: EventDecryptedHandler | null = null

  // ---- SDK 事件监听器（箭头函数绑定 this）-----------------------------------------

  private readonly syncListener = (state: string, prevState?: string, data?: unknown) => {
    this.emit('sync', { state, prevState, data })
    this.syncStateHandler?.(state, prevState, data)
  }

  private readonly roomListener = (room: Room) => {
    this.emit('room', room)

    const homeserverUrl = this.observedClient?.getHomeserverUrl() || ''

    const updateRoom = () => {
      void matrixWorkerHost
        .upsertSearchRooms([
          {
            roomId: room.roomId,
            name: room.name,
            avatarUrl: room.getAvatarUrl(homeserverUrl, 48, 48, 'crop') || undefined,
            memberCount: room.getJoinedMemberCount()
          }
        ])
        .catch(() => {
          // Worker 转发失败不输出日志，避免刷屏
        })
    }

    updateRoom()

    const roomAny = room as unknown as {
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
      void matrixWorkerHost.upsertSearchEvents([searchEventDoc]).catch(() => {
        // Worker 转发失败不输出日志，避免刷屏
      })
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
    const room = args[1] as Room | undefined
    if (room) {
      useMitt.emit(MittEnum.ROOM_RECEIPT_CHANGED, { roomId: room.roomId })
    }
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

  /** 设置 SlidingSync Lifecycle 错误处理器（由 facade 设置，委托给 ConnectionManager.handleSyncLifecycleError） */
  setLifecycleErrorHandler(handler: SyncLifecycleErrorHandler): void {
    this.lifecycleErrorHandler = handler
  }

  /** 设置 SlidingSync Lifecycle 成功处理器（由 facade 设置，委托给 ConnectionManager.resetSyncErrorCount） */
  setLifecycleResetHandler(handler: SyncLifecycleResetHandler): void {
    this.lifecycleResetHandler = handler
  }

  /** 设置事件解密处理器（由 facade 设置，委托给 CryptoStateTracker） */
  setEventDecryptedHandler(handler: EventDecryptedHandler): void {
    this.eventDecryptedHandler = handler
  }

  /**
   * 注册所有 SDK 事件监听器
   *
   * 隐藏的复杂实现：
   * - 7 个 client.on() 注册（sync/room/room_timeline/redaction/decrypted/typing/receipt）
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

    // client EventEmitter 监听器累积超过默认上限 10（7 个本路由 + VoIP/Push/Presence/SpecialFriend 等），
    // 提升实例级 maxListeners 至 50 以避免 MaxListenersExceededWarning。
    const clientAny = client as unknown as { setMaxListeners?: (n: number) => void }
    clientAny.setMaxListeners?.(50)

    client.on('sync', this.syncListener)
    client.on('room', this.roomListener)
    client.on('room_timeline', this.roomTimelineListener)
    client.on('Event.redaction', this.redactionListener)
    client.on('Event.decrypted', this.eventDecryptedListener as never)
    client.on('Room.typing', this.typingListener)
    client.on('Room.receipt', this.receiptListener)

    // 订阅 SlidingSync Lifecycle 事件，补全 SDK 瞬时错误感知 seam。
    this.syncManager_onLifecycleEvent(syncManager, this.syncLifecycleListener)

    this.observedClient = client
  }

  /**
   * 注销所有 SDK 事件监听器
   *
   * 隐藏的复杂实现：
   * - 7 个 client.off() 注销
   * - SlidingSync Lifecycle 取消订阅
   * - Room 级监听器批量清理
   */
  detach(client: MatrixClient, syncManager: MatrixSyncManager): void {
    client.off('sync', this.syncListener)
    client.off('room', this.roomListener)
    client.off('room_timeline', this.roomTimelineListener)
    client.off('Event.redaction', this.redactionListener)
    client.off('Event.decrypted', this.eventDecryptedListener as never)
    client.off('Room.typing', this.typingListener)
    client.off('Room.receipt', this.receiptListener)

    this.syncManager_offLifecycleEvent(syncManager, this.syncLifecycleListener)
    this.detachRoomListeners()
    this.observedClient = null
  }

  /** 注销所有 Room 级监听器 */
  detachRoomListeners(): void {
    for (const [, entry] of this.roomListeners) {
      const roomAny = entry.room as unknown as {
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

  /** 触发事件（通知所有外部订阅者） */
  emit(event: string, ...data: unknown[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(...data))
    }
  }

  /** 清理所有外部事件监听器（供 facade 在 dispose 时调用） */
  clearExternalListeners(): void {
    this.eventListeners.clear()
  }

  /** 获取当前观察的 client（供 facade 访问） */
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
    syncManager.onLifecycleEvent(handler as never)
  }

  /** 封装 syncManager.offLifecycleEvent 调用，便于测试 mock */
  private syncManager_offLifecycleEvent(
    syncManager: MatrixSyncManager,
    handler: (state: SlidingSyncState, resp: unknown, err?: Error) => void
  ): void {
    syncManager.offLifecycleEvent(handler as never)
  }
}
