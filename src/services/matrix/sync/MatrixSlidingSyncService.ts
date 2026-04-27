import type { SlidingSync, SlidingSyncState, MSC3575SlidingSyncResponse, MSC3575RoomData } from '@/types/matrix-js-sdk'
import { SlidingSyncEvent } from '@/types/matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import {
  SlidingSyncReconnectManager,
  type ReconnectCallbacks,
  type ReconnectState
} from './SlidingSyncReconnectManager'
import { info, error } from '@tauri-apps/plugin-log'
import type { RoomInfo } from '@/services/types'

export interface SlidingSyncUnreadUpdate {
  roomId: string
  unreadCount: number
  highlightCount: number
  notificationCount: number
}

export interface SlidingSyncCallbacks {
  onUnreadCountsUpdate?: (updates: SlidingSyncUnreadUpdate[]) => void
  onRoomUpdate?: (roomId: string) => void
  onRoomListRefresh?: () => void
}

export interface SlidingSyncRoomUpdate {
  roomId: string
  timeline: unknown[]
  state: Record<string, unknown>
  notificationCount: number
  highlightCount: number
}

export class MatrixSlidingSyncService {
  private slidingSync: SlidingSync | null = null
  private _isInitialized: boolean = false
  private callbacks: SlidingSyncCallbacks = {}
  private reconnectManager = new SlidingSyncReconnectManager()
  private hasCompletedInitialSync = false
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
      throw new Error('SlidingSync not initialized in MatrixClientService')
    }

    if (this.slidingSync && this.slidingSync !== syncInstance) {
      this.detachListeners(this.slidingSync)
    }

    if (this.slidingSync === syncInstance && this._isInitialized) {
      return
    }

    this.slidingSync = syncInstance
    this._isInitialized = true
    this.hasCompletedInitialSync = false

    this.slidingSync.on(SlidingSyncEvent.Lifecycle, this.lifecycleListener)
    this.slidingSync.on(SlidingSyncEvent.RoomData, this.roomDataListener)

    this.reconnectManager.setReconnectFn(async () => {
      const client = matrixClientService.getClient()
      if (client) {
        ;(client as unknown as { retryImmediately?: () => void }).retryImmediately?.()
      }
    })

    this.reconnectManager.registerCallbacks({
      onStateChange: (state) => {
        switch (state) {
          case 'reconnecting':
            matrixClientService.updateConnectionState('RECONNECTING')
            break
          case 'failed':
            matrixClientService.updateConnectionState('ERROR')
            break
          case 'connected':
            matrixClientService.updateConnectionState('CONNECTED')
            break
        }
      }
    })

    info('[SlidingSync] Service initialized')
  }

  registerReconnectCallbacks(callbacks: ReconnectCallbacks): void {
    this.reconnectManager.registerCallbacks(callbacks)
  }

  getReconnectState(): ReconnectState {
    return this.reconnectManager.getState()
  }

  getReconnectRetryCount(): number {
    return this.reconnectManager.getRetryCount()
  }

  forceReconnect(): void {
    this.reconnectManager.forceReconnect()
  }

  private detachListeners(instance: SlidingSync): void {
    instance.off(SlidingSyncEvent.Lifecycle, this.lifecycleListener)
    instance.off(SlidingSyncEvent.RoomData, this.roomDataListener)
  }

  private onLifecycle(state: SlidingSyncState, resp: MSC3575SlidingSyncResponse | null, err?: Error) {
    if (err) {
      error(`[SlidingSync] Lifecycle error: ${err.message}`)
      this.reconnectManager.onError(err)
      return
    }

    switch (state) {
      case 'FINISHED':
        info('[SlidingSync] Request finished')
        break
      case 'COMPLETE':
        info('[SlidingSync] Sync complete')
        this.reconnectManager.onConnected()
        if (resp) {
          this.onSyncComplete(resp)
        }
        break
    }
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
      info('[SlidingSync] Room list refresh requested')
      this.callbacks.onRoomListRefresh?.()
    }

    this.hasCompletedInitialSync = true
  }

  private onRoomData(roomId: string, roomData: MSC3575RoomData) {
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

    info(`[SlidingSync] Room data updated: ${roomId}`)
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
      info(`[SlidingSync] Updated visible range: ${startIndex}-${endIndex}`)
    } catch (err) {
      error(`[SlidingSync] Failed to update visible range: ${err}`)
    }
  }

  setListSort(listName: string, sort: string[]): void {
    if (!this.slidingSync) return

    try {
      const list = this.slidingSync.getList(listName)
      if (list) {
        list.setSort(sort)
        info(`[SlidingSync] Set sort for ${listName}: ${sort.join(', ')}`)
      }
    } catch (err) {
      error(`[SlidingSync] Failed to set sort: ${err}`)
    }
  }

  setListFilters(listName: string, filters: Record<string, unknown>): void {
    if (!this.slidingSync) return

    try {
      const list = this.slidingSync.getList(listName)
      if (list) {
        list.setFilters(filters)
        info(`[SlidingSync] Set filters for ${listName}`)
      }
    } catch (err) {
      error(`[SlidingSync] Failed to set filters: ${err}`)
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
        info(`[SlidingSync] Subscribed to room: ${roomId}`)
      } else {
        this.slidingSync.unsubscribeFromRoom(roomId)
        info(`[SlidingSync] Unsubscribed from room: ${roomId}`)
      }
    } catch (err) {
      error(`[SlidingSync] Failed to ${subscribe ? 'subscribe' : 'unsubscribe'}: ${err}`)
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
    } catch {
      return 0
    }
  }

  async getIncrementalUpdate(roomId: string): Promise<SlidingSyncRoomUpdate | null> {
    if (!this.slidingSync) return null

    try {
      const room = this.slidingSync.getRoom(roomId)
      if (!room) return null

      return {
        roomId,
        timeline: room.timeline ?? [],
        state: room.state ?? {},
        notificationCount: room.notification_count ?? 0,
        highlightCount: room.highlight_count ?? 0
      }
    } catch (err) {
      error(`[SlidingSync] Failed to get incremental update: ${err}`)
      return null
    }
  }

  applySlidingSyncUnreadCounts(roomInfos: RoomInfo[]): void {
    if (!this.slidingSync) return

    for (const roomInfo of roomInfos) {
      try {
        const syncRoom = this.slidingSync.getRoom(roomInfo.roomId)
        if (syncRoom) {
          roomInfo.unreadCount = syncRoom.notification_count ?? 0
          roomInfo.highlightCount = syncRoom.highlight_count ?? 0
          roomInfo.notificationCount = syncRoom.notification_count ?? 0
        }
      } catch (err) {
        error(`[SlidingSync] Failed to apply unread counts for room ${roomInfo.roomId}: ${err}`)
      }
    }
  }

  destroy(): void {
    if (!this.slidingSync) return

    this.detachListeners(this.slidingSync)
    this.reconnectManager.destroy()
    this.slidingSync = null
    this._isInitialized = false
    this.hasCompletedInitialSync = false
    this.callbacks = {}
    info('[SlidingSync] Service destroyed')
  }
}

const matrixSlidingSyncService = new MatrixSlidingSyncService()
export default matrixSlidingSyncService
