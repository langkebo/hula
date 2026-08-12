import type { RoomInfo } from '@/services/types'
import type { MSC3575RoomData, MSC3575SlidingSyncResponse, SlidingSync, SlidingSyncState } from '@/types/matrix-js-sdk'
import { SlidingSyncEvent } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('SlidingSync')

export interface SlidingSyncUnreadUpdate {
  roomId: string
  unreadCount: number
  highlightCount: number
  notificationCount: number
}

interface SlidingSyncCallbacks {
  onUnreadCountsUpdate?: (updates: SlidingSyncUnreadUpdate[]) => void
  onRoomUpdate?: (roomId: string) => void
  onRoomListRefresh?: () => void
}

interface SlidingSyncRoomUpdate {
  roomId: string
  timeline: unknown[]
  state: Record<string, unknown>
  notificationCount: number
  highlightCount: number
}

class MatrixSlidingSyncService {
  private slidingSync: SlidingSync | null = null
  private _isInitialized: boolean = false
  private callbacks: SlidingSyncCallbacks = {}
  private hasCompletedInitialSync = false
  private roomCache: Map<
    string,
    {
      notification_count?: number
      highlight_count?: number
      timeline?: unknown[]
      state?: Record<string, unknown>
    }
  > = new Map()
  private readonly lifecycleListener = (
    state: SlidingSyncState,
    resp: MSC3575SlidingSyncResponse | null,
    err?: Error
  ) => this.onLifecycle(state, resp, err)
  private readonly roomDataListener = (roomId: string, roomData: MSC3575RoomData) => this.onRoomData(roomId, roomData)

  get isInitialized(): boolean {
    return this._isInitialized
  }

  registerCallbacks(callbacks: SlidingSyncCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  async initialize(): Promise<void> {
    const syncInstance = matrixClientService.getSlidingSync()
    if (!syncInstance) {
      this.slidingSync = null
      this._isInitialized = false
      this.hasCompletedInitialSync = false
      logger.info('Sliding Sync 未启用，跳过服务初始化')
      return
    }

    // 关键修复：即使 slidingSync 是同一实例，也必须先 detach 再 attach。
    // 原因：SlidingSync.stop() 会 removeAllListeners，forceReconnect 后监听器全部丢失。
    // 若此处 early-return（同实例 + isInitialized），监听器永不重注册，
    // 导致 unread counts、room updates 全部失效。
    if (this.slidingSync) {
      this.detachListeners(this.slidingSync)
    }

    this.slidingSync = syncInstance
    this._isInitialized = true
    this.hasCompletedInitialSync = false
    this.roomCache.clear()

    this.slidingSync.on(SlidingSyncEvent.Lifecycle, this.lifecycleListener)
    this.slidingSync.on(SlidingSyncEvent.RoomData, this.roomDataListener)

    logger.info('Service initialized')
  }

  destroy(): void {
    if (this.slidingSync) {
      this.detachListeners(this.slidingSync)
    }
    this.slidingSync = null
    this._isInitialized = false
    this.hasCompletedInitialSync = false
    this.roomCache.clear()
  }

  private detachListeners(instance: SlidingSync): void {
    instance.off(SlidingSyncEvent.Lifecycle, this.lifecycleListener)
    instance.off(SlidingSyncEvent.RoomData, this.roomDataListener)
  }

  private onLifecycle(state: SlidingSyncState, resp: MSC3575SlidingSyncResponse | null, err?: Error) {
    if (err) {
      if (this.isRateLimitError(err)) {
        // 429 限流是常见暂时性问题，不输出日志避免刷屏
      } else {
        logger.error(`Lifecycle error: ${err.message}`)
      }
      return
    }

    // 正常的 Request finished / Sync complete 不输出日志，避免刷屏
    if (state === 'COMPLETE' && resp) {
      this.onSyncComplete(resp)
    }
  }

  private isRateLimitError(err?: Error): boolean {
    const candidate = err as Error & {
      errcode?: string
      statusCode?: number
      httpStatus?: number
    }

    return (
      candidate?.errcode === 'M_LIMIT_EXCEEDED' ||
      candidate?.statusCode === 429 ||
      candidate?.httpStatus === 429 ||
      candidate?.message.includes('429') === true ||
      candidate?.message.includes('Rate limited') === true
    )
  }

  private onSyncComplete(resp: MSC3575SlidingSyncResponse) {
    if (!resp?.rooms) return

    const unreadUpdates: SlidingSyncUnreadUpdate[] = []
    const roomUpdates: string[] = []
    const shouldRefreshRoomList = this.hasCompletedInitialSync && this.shouldRefreshRoomList(resp)

    for (const roomId of Object.keys(resp.rooms)) {
      const roomData = resp.rooms[roomId]

      if (roomData.notification_count !== undefined || roomData.highlight_count !== undefined) {
        unreadUpdates.push({
          roomId,
          unreadCount: roomData.notification_count ?? 0,
          highlightCount: roomData.highlight_count ?? 0,
          notificationCount: roomData.notification_count ?? 0
        })
      }

      if (roomData.timeline && roomData.timeline.length > 0) {
        roomUpdates.push(roomId)
      }
    }

    if (unreadUpdates.length > 0) {
      this.callbacks.onUnreadCountsUpdate?.(unreadUpdates)
    }

    for (const roomId of roomUpdates) {
      this.callbacks.onRoomUpdate?.(roomId)
    }

    if (shouldRefreshRoomList) {
      // Room list refresh 是高频事件，不输出日志
      this.callbacks.onRoomListRefresh?.()
    }

    this.hasCompletedInitialSync = true
  }

  private onRoomData(roomId: string, roomData: MSC3575RoomData) {
    this.roomCache.set(roomId, {
      notification_count: roomData.notification_count,
      highlight_count: roomData.highlight_count,
      timeline: roomData.timeline,
      state: roomData.state
    })

    if (roomData.summary) {
      this.callbacks.onRoomUpdate?.(roomId)
    }

    if (roomData.notification_count !== undefined) {
      this.callbacks.onUnreadCountsUpdate?.([
        {
          roomId,
          unreadCount: roomData.notification_count,
          highlightCount: roomData.highlight_count ?? 0,
          notificationCount: roomData.notification_count
        }
      ])
    }

    // Room data 更新是高频事件，不输出日志避免刷屏
  }

  private shouldRefreshRoomList(resp: MSC3575SlidingSyncResponse): boolean {
    return Object.values(resp.rooms).some((roomData) => {
      const hasStateDelta = !!roomData.state && Object.keys(roomData.state).length > 0
      const hasSummaryDelta = !!roomData.summary && Object.keys(roomData.summary).length > 0

      return Boolean(
        roomData.initial ||
          roomData.name ||
          roomData.is_dm !== undefined ||
          roomData.prev_batch !== undefined ||
          roomData.timeline?.length ||
          hasStateDelta ||
          hasSummaryDelta
      )
    })
  }

  updateVisibleRange(startIndex: number, endIndex: number): void {
    if (!this.slidingSync) return

    try {
      this.slidingSync.setListRanges('default', [[startIndex, endIndex]])
      logger.debug(`Updated visible range: ${startIndex}-${endIndex}`)
    } catch (err) {
      logger.error(`Failed to update visible range: ${err}`)
    }
  }

  setListSort(listName: string, sort: string[]): void {
    if (!this.slidingSync) return

    try {
      const list = this.slidingSync.getList(listName)
      if (list) {
        list.setSort(sort)
        logger.debug(`Set sort for ${listName}: ${sort.join(', ')}`)
      }
    } catch (err) {
      logger.error(`Failed to set sort: ${err}`)
    }
  }

  setListFilters(listName: string, filters: Record<string, unknown>): void {
    if (!this.slidingSync) return

    try {
      const list = this.slidingSync.getList(listName)
      if (list) {
        list.setFilters(filters)
        logger.debug(`Set filters for ${listName}`)
      }
    } catch (err) {
      logger.error(`Failed to set filters: ${err}`)
    }
  }

  subscribeRoom(roomId: string, subscribe: boolean = true): void {
    if (!this.slidingSync) return

    try {
      if (subscribe) {
        this.slidingSync.subscribeToRoom(roomId, {
          timelineLimit: 50,
          invite: true
        })
        logger.debug(`Subscribed to room: ${roomId}`)
      } else {
        this.slidingSync.unsubscribeFromRoom(roomId)
        logger.debug(`Unsubscribed from room: ${roomId}`)
      }
    } catch (err) {
      logger.error(`Failed to ${subscribe ? 'subscribe' : 'unsubscribe'}: ${err}`)
    }
  }

  getSyncPosition(): string | null {
    if (!this.slidingSync) return null
    return this.slidingSync.getSyncToken()
  }

  getListRoomCount(listName: string = 'default'): number {
    if (!this.slidingSync) return 0

    try {
      const list = this.slidingSync.getList(listName)
      return list?.rooms?.length ?? 0
    } catch (err) {
      // R-13: log silent catch in getListRoomCount
      logger.warn('getListRoomCount failed:', err)
      return 0
    }
  }

  async getIncrementalUpdate(roomId: string): Promise<SlidingSyncRoomUpdate | null> {
    if (!this.slidingSync) return null

    const cached = this.roomCache.get(roomId)
    if (!cached) return null

    return {
      roomId,
      timeline: cached.timeline ?? [],
      state: cached.state ?? {},
      notificationCount: cached.notification_count ?? 0,
      highlightCount: cached.highlight_count ?? 0
    }
  }

  applySlidingSyncUnreadCounts(roomInfos: RoomInfo[]): void {
    if (!this.slidingSync) return

    for (const roomInfo of roomInfos) {
      try {
        const cached = this.roomCache.get(roomInfo.roomId)
        if (cached) {
          roomInfo.unreadCount = cached.notification_count ?? 0
          roomInfo.highlightCount = cached.highlight_count ?? 0
          roomInfo.notificationCount = cached.notification_count ?? 0
        }
      } catch {
        // Silently skip rooms not in cache
      }
    }
  }
}

const matrixSlidingSyncService = new MatrixSlidingSyncService()
export default matrixSlidingSyncService
