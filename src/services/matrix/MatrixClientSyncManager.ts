import { type MatrixClient, type MatrixEvent, type Room, SlidingSync } from 'matrix-js-sdk'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { setupSystemResumeListener } from '@/services/matrix/matrixClientPlatform'
import { PendingEventOrdering } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import type { SearchEventDoc } from '@/workers/matrixWorkerTypes'
import type {
  ConnectionState,
  MatrixClientConfig,
  StartClientOptions,
  SyncErrorLike
} from './MatrixClientService.types'

const logger = createLogger('MatrixClientSync')

interface MatrixClientSyncManagerDeps {
  getClient: () => MatrixClient | null
  getConfig: () => MatrixClientConfig | null
  getConnectionState: () => ConnectionState
  updateConnectionState: (state: ConnectionState) => void
  emit: (event: string, ...data: unknown[]) => void
}

export class MatrixClientSyncManager {
  private slidingSyncInstance: SlidingSync | null = null
  private observedClient: MatrixClient | null = null
  private slidingSyncReadyResolve: (() => void) | null = null
  private slidingSyncReadyPromise: Promise<void> | null = null
  private roomListeners: Map<string, { room: Room; handlers: Map<string, (...args: unknown[]) => void> }> = new Map()

  constructor(private readonly deps: MatrixClientSyncManagerDeps) {}

  beforeClientReset(): void {
    if (this.observedClient) {
      this.detachEventListeners(this.observedClient)
      this.observedClient = null
    }

    this.slidingSyncInstance?.stop?.()
    this.slidingSyncInstance = null
  }

  async startClient(): Promise<void> {
    const client = this.deps.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    this.setupResumeListener()

    try {
      const startOpts: StartClientOptions = {
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      if (this.deps.getConfig()?.accessToken) {
        this.slidingSyncInstance ??= this.createSlidingSync()
        this.resetSlidingSyncReady()
        startOpts.slidingSync = this.slidingSyncInstance
      } else {
        this.slidingSyncInstance = null
      }

      await client.startClient(startOpts)
      this.deps.updateConnectionState('CONNECTED')
      this.setupEventListeners()
      logger.info('客户端启动成功')
    } catch (err) {
      this.deps.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      logger.error(errorMessage, err)
      throw err
    }
  }

  async stopClient(): Promise<void> {
    const client = this.deps.getClient()

    try {
      if (!client) {
        return
      }

      this.detachEventListeners(client)
      this.observedClient = null
      this.slidingSyncInstance?.stop?.()
      client.stopClient()
      this.deps.updateConnectionState('DISCONNECTED')
      logger.info('客户端已停止')
    } catch (err) {
      logger.error('停止客户端失败:', err)
      throw err
    }
  }

  getSlidingSync(): SlidingSync | null {
    return this.slidingSyncInstance
  }

  resetSlidingSyncReady(): void {
    if (this.slidingSyncReadyPromise) {
      this.slidingSyncReadyResolve?.()
    }
    this.slidingSyncReadyPromise = new Promise<void>((resolve) => {
      this.slidingSyncReadyResolve = resolve
    })
  }

  markSlidingSyncReady(): void {
    if (this.slidingSyncReadyResolve) {
      this.slidingSyncReadyResolve()
      this.slidingSyncReadyResolve = null
    }
  }

  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    if (!this.slidingSyncInstance) {
      return false
    }
    if (!this.slidingSyncReadyPromise) {
      return true
    }

    try {
      await Promise.race([
        this.slidingSyncReadyPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ])
      return true
    } catch {
      return false
    }
  }

  private createSlidingSync(): SlidingSync {
    const client = this.deps.getClient()
    const config = this.deps.getConfig()
    if (!client || !config) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    const slidingSyncConfig = config.slidingSync ?? {}
    const roomRangeEnd = slidingSyncConfig.roomRangeEnd ?? 49
    const timelineLimit = slidingSyncConfig.timelineLimit ?? 10
    const pollTimeout = slidingSyncConfig.pollTimeout ?? 30000

    const requiredState: Array<[string, string]> = [
      ['m.room.name', ''],
      ['m.room.avatar', ''],
      ['m.room.encryption', ''],
      ['m.room.create', ''],
      ['m.room.power_levels', ''],
      ['m.room.member', '*']
    ]

    const lists = new Map()
    lists.set('default', {
      ranges: [[0, roomRangeEnd]],
      sort: ['by_recency'],
      timeline_limit: timelineLimit,
      required_state: requiredState
    })

    const slidingSync = new SlidingSync(
      config.homeserverUrl,
      lists,
      {
        timeline_limit: timelineLimit,
        required_state: requiredState
      },
      client,
      pollTimeout
    )

    logger.info(
      `Sliding Sync 实例已创建 (rooms=${roomRangeEnd + 1}, timeline=${timelineLimit}, timeout=${pollTimeout}ms)`
    )
    return slidingSync
  }

  private setupResumeListener(): void {
    setupSystemResumeListener(() => {
      if (this.deps.getClient() && this.deps.getConnectionState() === 'CONNECTED') {
        void this.forceReconnect()
      }
    })
  }

  private async forceReconnect(): Promise<void> {
    const client = this.deps.getClient()
    if (!client) {
      return
    }

    try {
      logger.info('[LIFECYCLE] Stopping current sync for reconnect')
      client.stopClient()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      this.deps.updateConnectionState('RECONNECTING')

      const startOpts: StartClientOptions = {
        initialSyncLimit: 10,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      if (this.deps.getConfig()?.accessToken) {
        this.slidingSyncInstance ??= this.createSlidingSync()
        this.resetSlidingSyncReady()
        startOpts.slidingSync = this.slidingSyncInstance
      }

      client.startClient(startOpts)
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      this.deps.updateConnectionState('ERROR')
    }
  }

  private readonly syncListener = (state: string, prevState?: string, data?: unknown) => {
    this.deps.emit('sync', { state, prevState, data })

    if (state === 'ERROR') {
      const errorData = data as SyncErrorLike | undefined
      if (errorData?.errcode === 'M_LIMIT_EXCEEDED' || errorData?.name === 'ConnectionError') {
        // 限流/超时是常见暂时性问题，不输出日志避免刷屏
      } else {
        logger.error(`同步错误: ${state}`, {
          prevState,
          errcode: errorData?.errcode,
          errorName: errorData?.name
        })
      }
    } else if (state !== prevState) {
      logger.info(`同步状态: ${state}`)
    }
    // 状态不变时不再输出日志，避免刷屏

    const nextConnectionState = this.mapSyncStateToConnectionState(state)
    if (nextConnectionState) {
      this.deps.updateConnectionState(nextConnectionState)
    }

    if (state === 'PREPARED' || state === 'SYNCING') {
      this.markSlidingSyncReady()
    }
  }

  private readonly roomListener = (room: Room) => {
    this.deps.emit('room', room)

    const homeserverUrl = this.deps.getClient()?.getHomeserverUrl() || ''
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
    }
    if (typeof roomAny.on === 'function') {
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
    this.deps.emit('timeline', { event, room })

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

  setupEventListeners(): void {
    const client = this.deps.getClient()
    if (!client || this.observedClient === client) {
      return
    }

    if (this.observedClient) {
      this.detachEventListeners(this.observedClient)
    }

    client.on('sync', this.syncListener)
    client.on('room', this.roomListener)
    client.on('room_timeline', this.roomTimelineListener)
    client.on('Event.redaction', this.redactionListener)
    client.on('Room.typing', this.typingListener)
    client.on('Room.receipt', this.receiptListener)
    this.observedClient = client
  }

  setObservedClient(client: MatrixClient | null): void {
    this.observedClient = client
  }

  private detachEventListeners(client: MatrixClient): void {
    client.off('sync', this.syncListener)
    client.off('room', this.roomListener)
    client.off('room_timeline', this.roomTimelineListener)
    client.off('Event.redaction', this.redactionListener)
    client.off('Room.typing', this.typingListener)
    client.off('Room.receipt', this.receiptListener)

    // 清理 Room 级别的事件监听器
    this.detachRoomListeners()
  }

  private detachRoomListeners(): void {
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

  private mapSyncStateToConnectionState(state: string): ConnectionState | null {
    switch (state) {
      case 'PREPARED':
      case 'SYNCING':
      case 'CATCHUP':
        return 'CONNECTED'
      case 'RECONNECTING':
        return 'RECONNECTING'
      case 'ERROR':
        return 'ERROR'
      case 'STOPPED':
        return 'DISCONNECTED'
      default:
        return null
    }
  }
}
