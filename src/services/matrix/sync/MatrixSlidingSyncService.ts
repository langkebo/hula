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

class MatrixSlidingSyncService {
  private slidingSync: SlidingSync | null = null
  private callbacks: SlidingSyncCallbacks = {}
  private hasCompletedInitialSync = false
  private roomCache: Map<
    string,
    {
      notification_count?: number | undefined
      highlight_count?: number | undefined
      timeline?: unknown[] | undefined
      /** SDK 的 roomData 字段（旧代码误写为 state: Record<string,unknown>，恒为 undefined） */
      required_state?: unknown[] | undefined
    }
  > = new Map()
  /** 已请求补订阅的房间及请求时间：带 TTL 以允许同步失败后重试 */
  private autoSubscribedRooms = new Map<string, number>()
  private readonly autoSubscribeRetryMs = 60_000
  private readonly lifecycleListener = (
    state: SlidingSyncState,
    resp: MSC3575SlidingSyncResponse | null,
    err?: Error
  ) => this.onLifecycle(state, resp, err)
  private readonly roomDataListener = (roomId: string, roomData: MSC3575RoomData) => this.onRoomData(roomId, roomData)

  registerCallbacks(callbacks: SlidingSyncCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  async initialize(): Promise<void> {
    const syncInstance = matrixClientService.getSlidingSync()
    if (!syncInstance) {
      this.slidingSync = null
      this.hasCompletedInitialSync = false
      logger.info('Sliding Sync 未启用，跳过服务初始化')
      return
    }

    // 关键修复：即使 slidingSync 是同一实例，也必须先 detach 再 attach。
    // 原因：SlidingSync.stop() 会 removeAllListeners，forceReconnect 后监听器全部丢失。
    // 若此处 early-return（同实例），监听器永不重注册，
    // 导致 unread counts、room updates 全部失效。
    if (this.slidingSync) {
      this.detachListeners(this.slidingSync)
    }

    this.slidingSync = syncInstance
    this.hasCompletedInitialSync = false
    this.roomCache.clear()
    this.autoSubscribedRooms.clear()

    this.slidingSync.on(SlidingSyncEvent.Lifecycle, this.lifecycleListener)
    this.slidingSync.on(SlidingSyncEvent.RoomData, this.roomDataListener)

    logger.info('Service initialized')
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
    this.ensureRoomInStore(roomId)

    this.roomCache.set(roomId, {
      notification_count: roomData.notification_count,
      highlight_count: roomData.highlight_count,
      timeline: roomData.timeline,
      required_state: roomData.required_state
    })

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

  /**
   * 接收方补订阅：滑窗增量下发中，store 里不存在的新房间 `initial` 为 false，
   * `SlidingSyncSdk.onRoomData` 会直接丢弃该房间 —— 被邀请/被拉入的新会话因此
   * 永远进不了 store（收不到消息、打开也没有 timeline）。
   * 这里对该房间发起一次订阅，服务端下一轮响应会强制 `initial: true`。
   */
  private ensureRoomInStore(roomId: string): void {
    if (matrixClientService.getRoom(roomId)) return

    const lastAttempt = this.autoSubscribedRooms.get(roomId)
    if (lastAttempt !== undefined && Date.now() - lastAttempt < this.autoSubscribeRetryMs) return

    this.autoSubscribedRooms.set(roomId, Date.now())
    logger.info(`发现本地缺失的房间，补订阅以强制初始同步: ${roomId}`)
    try {
      matrixClientService.subscribeRoomForSync(roomId)
    } catch (error) {
      // 订阅失败时清除标记，让后续同步包可以重试
      this.autoSubscribedRooms.delete(roomId)
      logger.warn(`补订阅房间失败，将在下次同步时重试: ${roomId}`, error)
    }
  }

  private shouldRefreshRoomList(resp: MSC3575SlidingSyncResponse): boolean {
    return Object.values(resp.rooms).some((roomData) => {
      // SDK 的 MSC3575RoomData 字段是 required_state / timeline；没有 state / summary。
      // 旧代码的 hasSummaryDelta 恒为 false（死条件），已删除；state 判据改用 required_state。
      const hasStateDelta = (roomData.required_state?.length ?? 0) > 0

      return Boolean(
        roomData.initial ||
          roomData.name ||
          roomData.is_dm !== undefined ||
          roomData.prev_batch !== undefined ||
          roomData.timeline?.length ||
          hasStateDelta
      )
    })
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
