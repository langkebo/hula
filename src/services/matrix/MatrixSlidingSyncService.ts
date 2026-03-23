import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export class MatrixSlidingSyncService {
  private slidingSync: any = null

  async initialize(): Promise<void> {
    const syncInstance = matrixClientService.getSlidingSync()
    if (!syncInstance) {
      throw new Error('SlidingSync not initialized in MatrixClientService')
    }

    this.slidingSync = syncInstance

    this.slidingSync.on('sync', this.onLifecycle.bind(this))
    this.slidingSync.on('Room.data', this.onRoomData.bind(this))

    info('[SlidingSync] Service event listeners attached')
  }

  private onLifecycle(state: any, resp: any, err: any) {
    if (err) {
      error(`[SlidingSync] Lifecycle error: ${err.message}`)
      return
    }
    if (state === 'COMPLETE') {
      info('[SlidingSync] Sync complete')
    }
  }

  private onRoomData(roomId: string, roomData: any) {
    // Notify stores to update UI
    info(`[SlidingSync] Room data updated: ${roomId}`)
  }

  /**
   * 更新可见范围（用于虚拟滚动）
   * @param startIndex 起始索引
   * @param endIndex 结束索引
   */
  updateVisibleRange(startIndex: number, endIndex: number) {
    if (!this.slidingSync) return
    
    // Assuming we use a list named 'default'
    this.slidingSync.setListRanges('default', [[startIndex, endIndex]])
    
    info(`[SlidingSync] Updated visible range to ${startIndex}-${endIndex}`)
  }
}

const matrixSlidingSyncService = new MatrixSlidingSyncService()
export default matrixSlidingSyncService
