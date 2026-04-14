import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { useRoomStore } from '@/stores/room'
import { info } from '@tauri-apps/plugin-log'

export class MatrixSlidingSyncService extends BaseManager {
  private slidingSync: any = null
  private _isInitialized = false
  // 存储事件处理器引用，用于清理
  private eventHandlers: Map<string, (...args: any[]) => void> = new Map()

  get isInitialized(): boolean {
    return this._isInitialized
  }

  /**
   * 初始化 Sliding Sync 服务
   */
  async initialize(throwOnError = true): Promise<void> {
    try {
      const syncInstance = matrixClientService.getSlidingSync()
      if (!syncInstance) {
        throw new Error('SlidingSync not initialized in MatrixClientService')
      }

      this.slidingSync = syncInstance
      this._isInitialized = true

      const lifecycleHandler = this.onLifecycle.bind(this)
      const roomDataHandler = this.onRoomData.bind(this)
      const listUpdateHandler = this.onListUpdate.bind(this)

      this.eventHandlers.set('sync', lifecycleHandler)
      this.eventHandlers.set('Room.data', roomDataHandler)
      this.eventHandlers.set('Lists.default', listUpdateHandler)

      this.slidingSync.on('sync', lifecycleHandler)
      this.slidingSync.on('Room.data', roomDataHandler)
      this.slidingSync.on('Lists.default', listUpdateHandler)

      info('[SlidingSync] Service initialized')
    } catch (error) {
      this.handleError(error, 'initialize', undefined as unknown as void, throwOnError)
    }
  }

  /**
   * 生命周期事件处理
   */
  private onLifecycle(state: string, resp: any, err: any) {
    if (err) {
      return
    }

    switch (state) {
      case 'COMPENSATING':
        info('[SlidingSync] Compensating...')
        break
      case 'CATCHUP':
        info('[SlidingSync] Catching up...')
        break
      case 'SYNCING':
        info('[SlidingSync] Syncing...')
        break
      case 'COMPLETE':
        info('[SlidingSync] Sync complete')
        this.onSyncComplete(resp)
        break
    }
  }

  /**
   * 同步完成后的处理
   */
  private onSyncComplete(resp: any) {
    if (!resp) return

    const roomStore = useRoomStore()

    // 处理房间列表更新
    if (resp.rooms) {
      for (const roomId of Object.keys(resp.rooms)) {
        const roomData = resp.rooms[roomId]

        // 更新未读计数
        if (roomData.notification_count !== undefined || roomData.highlight_count !== undefined) {
          const roomInfo = roomStore.rooms.get(roomId)
          if (roomInfo) {
            roomInfo.unreadCount = roomData.notification_count ?? roomInfo.unreadCount
            roomInfo.highlightCount = roomData.highlight_count ?? roomInfo.highlightCount
            roomInfo.notificationCount = roomData.notification_count ?? roomInfo.notificationCount
            roomStore.rooms.set(roomId, roomInfo)
          }
        }

        // 处理房间增量更新
        if (roomData.timeline && roomData.timeline.length > 0) {
          roomStore.updateRoom(roomId, {})
        }
      }
    }
  }

  /**
   * 房间数据更新
   */
  private onRoomData(roomId: string, roomData: any) {
    const roomStore = useRoomStore()

    // 更新房间信息
    if (roomData.summary) {
      roomStore.updateRoom(roomId, {})
    }

    // 更新未读计数
    if (roomData.notification_count !== undefined) {
      const roomInfo = roomStore.rooms.get(roomId)
      if (roomInfo) {
        roomInfo.unreadCount = roomData.notification_count
        roomInfo.highlightCount = roomData.highlight_count ?? 0
        roomStore.rooms.set(roomId, roomInfo)
      }
    }

    info(`[SlidingSync] Room data updated: ${roomId}`)
  }

  /**
   * 列表更新事件
   */
  private onListUpdate(rooms: string[], signal: any) {
    if (!signal?.initial) {
      info(`[SlidingSync] List updated: ${rooms.length} rooms`)
      // 触发房间列表刷新
      const roomStore = useRoomStore()
      roomStore.loadRooms()
    }
  }

  /**
   * 更新可见范围（虚拟滚动优化）
   *
   * @param startIndex 起始索引
   * @param endIndex 结束索引
   */
  updateVisibleRange(startIndex: number, endIndex: number, throwOnError = false): void {
    if (!this.slidingSync) return

    try {
      this.slidingSync.setListRanges('default', [[startIndex, endIndex]])
      info(`[SlidingSync] Updated visible range: ${startIndex}-${endIndex}`)
    } catch (error) {
      this.handleError(error, 'updateVisibleRange', undefined as unknown as void, throwOnError)
    }
  }

  /**
   * 设置列表排序方式
   *
   * @param listName 列表名称
   * @param sort 排序方式数组
   */
  setListSort(listName: string, sort: string[], throwOnError = false): void {
    if (!this.slidingSync) return

    try {
      const list = this.slidingSync.getList(listName)
      if (list) {
        list.setSort(sort)
        info(`[SlidingSync] Set sort for ${listName}: ${sort.join(', ')}`)
      }
    } catch (error) {
      this.handleError(error, 'setListSort', undefined as unknown as void, throwOnError)
    }
  }

  setListFilters(listName: string, filters: any, throwOnError = false): void {
    if (!this.slidingSync) return

    try {
      const list = this.slidingSync.getList(listName)
      if (list) {
        list.setFilters(filters)
        info(`[SlidingSync] Set filters for ${listName}`)
      }
    } catch (error) {
      this.handleError(error, 'setListFilters', undefined as unknown as void, throwOnError)
    }
  }

  subscribeRoom(roomId: string, subscribe: boolean = true, throwOnError = false): void {
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
    } catch (error) {
      this.handleError(error, 'subscribeRoom', undefined as unknown as void, throwOnError)
    }
  }

  /**
   * 获取当前 sync 位置
   */
  getSyncPosition(): string | null {
    if (!this.slidingSync) return null
    return this.slidingSync.getSyncToken()
  }

  /**
   * 获取列表中的房间数量
   */
  getListRoomCount(listName: string = 'default'): number {
    if (!this.slidingSync) return 0

    try {
      const list = this.slidingSync.getList(listName)
      return list?.rooms?.length ?? 0
    } catch {
      // getList 可能抛出异常，返回 0 表示列表不存在或获取失败
      return 0
    }
  }

  /**
   * 获取增量更新
   */
  async getIncrementalUpdate(roomId: string, throwOnError = true): Promise<any | null> {
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
    } catch (error) {
      return this.handleError(error, 'getIncrementalUpdate', null, throwOnError)
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (!this.slidingSync) return

    // 使用存储的引用移除事件监听器
    this.eventHandlers.forEach((handler, eventName) => {
      this.slidingSync.off(eventName, handler)
      info(`[SlidingSync] 已移除事件监听器: ${eventName}`)
    })

    // 清空监听器引用
    this.eventHandlers.clear()

    this.slidingSync = null
    this._isInitialized = false
    info('[SlidingSync] Service destroyed')
  }
}

const matrixSlidingSyncService = new MatrixSlidingSyncService()
export default matrixSlidingSyncService
