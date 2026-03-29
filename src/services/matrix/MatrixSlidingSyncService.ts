import matrixClientService from './MatrixClientService'
import { useRoomStore } from '@/stores/room'
import { info, error } from '@tauri-apps/plugin-log'
import type { Room, RoomSummary } from 'matrix-js-sdk'

export class MatrixSlidingSyncService {
  private slidingSync: any = null
  private isInitialized = false

  /**
   * 初始化 Sliding Sync 服务
   */
  async initialize(): Promise<void> {
    const syncInstance = matrixClientService.getSlidingSync()
    if (!syncInstance) {
      throw new Error('SlidingSync not initialized in MatrixClientService')
    }

    this.slidingSync = syncInstance
    this.isInitialized = true

    // 绑定事件监听
    this.slidingSync.on('sync', this.onLifecycle.bind(this))
    this.slidingSync.on('Room.data', this.onRoomData.bind(this))
    this.slidingSync.on('Lists.default', this.onListUpdate.bind(this))

    info('[SlidingSync] Service initialized')
  }

  /**
   * 生命周期事件处理
   */
  private onLifecycle(state: string, resp: any, err: any) {
    if (err) {
      error(`[SlidingSync] Lifecycle error: ${err.message}`)
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
          roomStore.updateRoom(roomId)
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
      roomStore.updateRoom(roomId)
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
  updateVisibleRange(startIndex: number, endIndex: number): void {
    if (!this.slidingSync) return

    try {
      // 设置可见范围，只加载可见区域的完整数据
      this.slidingSync.setListRanges('default', [[startIndex, endIndex]])
      info(`[SlidingSync] Updated visible range: ${startIndex}-${endIndex}`)
    } catch (err) {
      error(`[SlidingSync] Failed to update visible range: ${err}`)
    }
  }

  /**
   * 设置列表排序方式
   *
   * @param listName 列表名称
   * @param sort 排序方式数组
   */
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

  /**
   * 设置列表过滤器
   *
   * @param listName 列表名称
   * @param filters 过滤条件
   */
  setListFilters(listName: string, filters: any): void {
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

  /**
   * 订阅/取消订阅房间
   *
   * @param roomId 房间 ID
   * @param subscribe 是否订阅
   */
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
      return 0
    }
  }

  /**
   * 获取增量更新
   */
  async getIncrementalUpdate(roomId: string): Promise<any | null> {
    if (!this.slidingSync) return null

    try {
      const room = this.slidingSync.getRoom(roomId)
      if (!room) return null

      // 获取增量数据
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

  /**
   * 销毁服务
   */
  destroy(): void {
    if (!this.slidingSync) return

    this.slidingSync.removeAllListeners()
    this.slidingSync = null
    this.isInitialized = false
    info('[SlidingSync] Service destroyed')
  }
}

const matrixSlidingSyncService = new MatrixSlidingSyncService()
export default matrixSlidingSyncService
