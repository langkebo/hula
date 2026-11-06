import { type MatrixClient, SlidingSync, SlidingSyncEvent, SlidingSyncState } from 'matrix-js-sdk'
import { CLIENT_READY_TIMEOUT_MS } from '@/common/constants'
import { resolveMatrixRuntimeHomeserverUrl } from '@/services/backend'
import { createLogger } from '@/utils/Logger'
import type { MatrixClientConfig } from './MatrixClientService'

const logger = createLogger('SyncManager')

/**
 * Listener for SlidingSync Lifecycle events.
 * Receives (state, resp, err?) — same signature as SDK's SlidingSyncEvent.Lifecycle.
 */
export type SlidingSyncLifecycleListener = (state: SlidingSyncState, resp: unknown, err?: Error) => void

/**
 * Network type detected via Network Information API.
 * Falls back to 'wifi' when the API is unavailable (desktop/Tauri).
 */
type NetworkType = 'wifi' | '4g' | '3g' | 'slow-2g'

/** 滑窗参数预设：房间范围端点 / 每房间 timeline 条数 / 长轮询超时（ms）。 */
interface SlidingSyncPreset {
  roomRangeEnd: number
  timelineLimit: number
  pollTimeout: number
}

/** 按网络质量分四档：Wi-Fi/4G 放大范围换首屏速度，3G/2G 压小负载换取响应。 */
export const SLIDING_SYNC_PRESETS: Record<NetworkType, SlidingSyncPreset> = {
  wifi: { roomRangeEnd: 49, timelineLimit: 10, pollTimeout: 30000 },
  '4g': { roomRangeEnd: 29, timelineLimit: 5, pollTimeout: 25000 },
  '3g': { roomRangeEnd: 19, timelineLimit: 3, pollTimeout: 20000 },
  'slow-2g': { roomRangeEnd: 9, timelineLimit: 1, pollTimeout: 15000 }
}

/**
 * 用 Network Information API 探测网络类型；API 缺失或 effectiveType 未知时按 'wifi' 处理
 * （桌面 Firefox/Safari 与部分 Tauri 构建都没有该 API）。
 */
export function detectNetworkType(): NetworkType {
  const conn = (navigator as { connection?: { effectiveType?: string } }).connection
  if (!conn?.effectiveType) return 'wifi'
  const type = conn.effectiveType
  if (type === '4g') return '4g'
  if (type === '3g') return '3g'
  if (type === 'slow-2g') return 'slow-2g'
  return 'wifi' // 'wifi' or unknown → use full preset
}

export class MatrixSyncManager {
  private static readonly POS_STORAGE_KEY = 'matrix.sliding_sync.pos'
  // 后端 token time_to_idle=30min，前端 pos TTL 取 25min：超过后被 GC 会得到 400 M_UNKNOWN_POS
  private static readonly POS_TTL_MS = 25 * 60 * 1000 // 25min

  private instance: SlidingSync | null = null
  private readyResolve: (() => void) | null = null
  private readyPromise: Promise<void> | null = null
  private posPersistListener: SlidingSyncLifecycleListener | null = null
  private currentNetworkType: NetworkType | null = null
  private networkChangeHandler: (() => void) | null = null
  /**
   * 滑窗房间订阅（MSC3575 `room_subscriptions`），按插入序做 LRU。
   *
   * 必须主动订阅：服务端只在 pos 缺省或订阅集合变化时给 `initial: true`，而
   * `SlidingSyncSdk.onRoomData` 对 store 里没有的房间，`initial` 不为真直接 return ——
   * 新建/新加入的房间会永远进不了 store（createRoom 5s 取不到实例、打开无 timeline）。
   */
  private roomSubscriptions = new Map<string, true>()
  private activeRoomId: string | null = null
  /** 订阅集合上限：活跃房间 + 最近建/加入的房间，避免请求体随使用时长无限增长 */
  private static readonly MAX_ROOM_SUBSCRIPTIONS = 16

  /**
   * 按当前配置创建 SlidingSync 实例：预设随网络类型选择（`config.slidingSync` 显式值优先）；
   * localStorage 里有未过期 pos 时用它做增量同步起点。
   */
  create(client: MatrixClient, config: MatrixClientConfig): SlidingSync {
    const networkType = detectNetworkType()
    const preset = SLIDING_SYNC_PRESETS[networkType]
    this.currentNetworkType = networkType

    const ss = config.slidingSync ?? {}
    const roomRangeEnd = ss.roomRangeEnd ?? preset.roomRangeEnd
    const timelineLimit = ss.timelineLimit ?? preset.timelineLimit
    const pollTimeout = ss.pollTimeout ?? preset.pollTimeout

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

    // §9.2 多列表订阅：空间/DM 列表，使用最小 timeline_limit 减少首屏负载
    // spec §5 P3-3：已移除 friends 列表。原过滤常量 im.hula.friend_list 与后端不符
    // （后端好友列表房间 room_type 为 m.friends），该 list 恒空；且前端与 SDK 均无消费点
    // （好友数据走 SDK FriendManager → REST /friends），好友列表房间仍由 default 列表覆盖。
    const extensionListFilters: Record<string, Record<string, unknown>> = {
      spaces: { room_types: ['m.space'] },
      dms: { is_dm: true }
    }
    for (const [name, filters] of Object.entries(extensionListFilters)) {
      lists.set(name, {
        ranges: [[0, roomRangeEnd]],
        sort: ['by_recency'],
        timeline_limit: 1,
        required_state: [['m.room.name', '']],
        filters
      })
    }

    // 使用 runtime-resolved homeserver URL，确保 dev 环境下走 Vite proxy
    // 避免 SlidingSync 直接请求 https://matrix.test 导致 net::ERR_ABORTED
    const runtimeHomeserverUrl = resolveMatrixRuntimeHomeserverUrl(config.homeserverUrl)

    const slidingSync = new SlidingSync(
      runtimeHomeserverUrl,
      lists,
      { timeline_limit: timelineLimit, required_state: requiredState },
      client,
      pollTimeout
    )

    // 恢复持久化的 pos，实现增量 sync
    // 4.2.2: 仅当 room store 已有房间数据时才恢复增量 pos。若 room store
    // 为空（崩溃恢复 / 存储被清 / room store 未持久化），增量 pos 会让新
    // store 的 timeline 为空，因此清掉 pos 强制走全量初始同步。
    const persistedPos = this.loadPersistedPos()
    if (persistedPos && this.hasRoomData(client)) {
      slidingSync.setInitialPos(persistedPos)
      logger.info(`Sliding Sync restored pos from localStorage (pos=${persistedPos.slice(0, 8)}...)`)
    } else if (persistedPos) {
      this.clearPersistedPos()
      logger.info('SlidingSync room store empty — clearing persisted pos to force a full initial sync')
    }

    // 订阅 Lifecycle 事件，在 Complete 时持久化 pos，在 400 错误时清除 pos
    this.posPersistListener = (state, resp, err) => {
      if (state === SlidingSyncState.Complete && resp && typeof resp === 'object' && 'pos' in resp) {
        const pos = (resp as { pos: string }).pos
        if (pos) {
          this.persistPos(pos)
        }
      } else if (state === SlidingSyncState.RequestFinished && err) {
        // 400 错误表示 pos 已过期（session expiry），清除持久化 pos
        // 避免下次重启时重用过期 pos 导致再次 400
        const httpStatus = (err as { httpStatus?: number }).httpStatus
        if (httpStatus === 400) {
          this.clearPersistedPos()
          logger.info('SlidingSync pos cleared due to 400 error (session expiry)')
        }
      }
    }
    slidingSync.on(SlidingSyncEvent.Lifecycle, this.posPersistListener)

    // 网络变化只记日志，不热重建实例（会丢监听器 + startClient 引用失效）
    this.registerNetworkChangeListener()

    logger.info(
      `Sliding Sync created (network=${networkType}, rooms=${roomRangeEnd + 1}, timeline=${timelineLimit}, timeout=${pollTimeout}ms, homeserver=${runtimeHomeserverUrl})`
    )
    this.instance = slidingSync
    // 重建实例（forceReconnect / 重新登录）后必须重放订阅：SlidingSync 的订阅集合是实例内的，
    // 新实例不会继承；不重放则新建/打开过的房间又回到「拿不到 initial」的状态。
    this.pushRoomSubscriptions()
    return slidingSync
  }

  /** 取当前实例（仅用于 startClient 初始化；事件请走 on/offLifecycleEvent）。 */
  get(): SlidingSync | null {
    return this.instance
  }

  /** 订阅房间（幂等）：服务端据此强制 `initial: true` 下发全量状态与 timeline。 */
  subscribeRoom(roomId: string): void {
    const id = roomId?.trim()
    if (!id) return
    // 重新插入以刷新 LRU 位置（Map 保持插入序）
    this.roomSubscriptions.delete(id)
    this.roomSubscriptions.set(id, true)
    while (this.roomSubscriptions.size > MatrixSyncManager.MAX_ROOM_SUBSCRIPTIONS) {
      const oldest = this.roomSubscriptions.keys().next().value
      // 活跃房间永不淘汰：否则正在看的房间会丢 timeline
      if (oldest === undefined || oldest === this.activeRoomId) break
      this.roomSubscriptions.delete(oldest)
    }
    this.pushRoomSubscriptions()
  }

  /** 设置「当前正在看」的房间并订阅它；`null` 表示离开所有会话（保留其它订阅）。 */
  setActiveRoom(roomId: string | null): void {
    const next = roomId?.trim() || null
    if (next === this.activeRoomId) return
    this.activeRoomId = next
    if (next) {
      this.subscribeRoom(next)
      return
    }
    this.pushRoomSubscriptions()
  }

  /** 把当前订阅集合同步给 SDK（实例不存在时为空操作，`create()` 后会重放） */
  private pushRoomSubscriptions(): void {
    // 缺该方法（老 SDK / 测试桩）时退化为不订阅：订阅是增强，不能打断 startClient
    if (typeof this.instance?.modifyRoomSubscriptions !== 'function') return
    this.instance.modifyRoomSubscriptions(new Set(this.roomSubscriptions.keys()))
  }

  /** 订阅 Lifecycle 事件（封装 SDK 的 on，避免调用方直接持有实例）。 */
  onLifecycleEvent(listener: SlidingSyncLifecycleListener): void {
    this.instance?.on(SlidingSyncEvent.Lifecycle, listener)
  }

  /** 取消 Lifecycle 订阅。 */
  offLifecycleEvent(listener: SlidingSyncLifecycleListener): void {
    this.instance?.off(SlidingSyncEvent.Lifecycle, listener)
  }

  /**
   * 停掉并清空实例（同时摘掉 pos 持久化与网络监听，避免泄漏）。
   * 持久化的 pos 也要清：重建实例后 room store 会被重置，留着旧 pos 只会拿到增量、timeline 全空。
   */
  stop(): void {
    this.unregisterNetworkChangeListener()
    if (this.posPersistListener && this.instance) {
      this.instance.off(SlidingSyncEvent.Lifecycle, this.posPersistListener)
    }
    this.posPersistListener = null
    this.instance?.stop?.()
    this.instance = null
    this.currentNetworkType = null
    // 订阅集合属于「这个账号的会话」，登出/换账号后必须清空，否则会沿用上一账号的 roomId
    this.roomSubscriptions.clear()
    this.activeRoomId = null
    // Clear persisted pos so the next create() performs a fresh initial sync.
    // Without this, a rebuilt client (empty room store) would receive only
    // incremental updates via the restored pos, resulting in empty timelines.
    this.clearPersistedPos()
  }

  /**
   * Register a listener for network type changes via the Network Information API.
   *
   * When the network type changes (e.g., Wi-Fi → 4G), `adaptToNetwork()` is
   * called to log the change. The new preset takes effect on the next
   * `create()` call — hot-rebuilding the SlidingSync instance is avoided
   * to prevent listener loss and client.startClient reference invalidation.
   */
  private registerNetworkChangeListener(): void {
    this.unregisterNetworkChangeListener()
    const conn = (navigator as { connection?: { addEventListener?: (type: string, handler: () => void) => void } })
      .connection
    if (!conn?.addEventListener) return

    this.networkChangeHandler = () => this.adaptToNetwork()
    conn.addEventListener('change', this.networkChangeHandler)
  }

  /**
   * Unregister the network change listener.
   */
  private unregisterNetworkChangeListener(): void {
    if (!this.networkChangeHandler) return
    const conn = (navigator as { connection?: { removeEventListener?: (type: string, handler: () => void) => void } })
      .connection
    conn?.removeEventListener?.('change', this.networkChangeHandler)
    this.networkChangeHandler = null
  }

  /**
   * 网络类型变化时只记录，不热重建实例（热重建会丢 lifecycle 监听、并让
   * `startClient({ slidingSync })` 的引用失效）；新预设下次 `create()` 生效。
   */
  adaptToNetwork(): void {
    const newType = detectNetworkType()
    if (newType === this.currentNetworkType) return

    const oldPreset = this.currentNetworkType ? SLIDING_SYNC_PRESETS[this.currentNetworkType] : null
    const newPreset = SLIDING_SYNC_PRESETS[newType]
    logger.info(
      `Network changed: ${this.currentNetworkType ?? 'unknown'} → ${newType} ` +
        `(preset: rooms ${oldPreset?.roomRangeEnd ?? '-'}→${newPreset.roomRangeEnd}, ` +
        `timeline ${oldPreset?.timelineLimit ?? '-'}→${newPreset.timelineLimit}, ` +
        `timeout ${oldPreset?.pollTimeout ?? '-'}→${newPreset.pollTimeout}ms). ` +
        `New preset takes effect on next create().`
    )
    this.currentNetworkType = newType
  }

  /**
   * Persist the SlidingSync pos to localStorage with a timestamp.
   *
   * Called automatically on each SlidingSyncState.Complete event.
   * Uses try-catch to handle localStorage unavailability (privacy mode, quota).
   */
  private persistPos(pos: string): void {
    try {
      localStorage.setItem(MatrixSyncManager.POS_STORAGE_KEY, JSON.stringify({ pos, ts: Date.now() }))
    } catch {
      // localStorage may be unavailable (privacy mode, quota exceeded) — silently skip
      logger.warn('Failed to persist SlidingSync pos to localStorage')
    }
  }

  /**
   * Load the persisted pos from localStorage, checking TTL.
   *
   * @returns The pos string if valid and within TTL, otherwise null.
   */
  private loadPersistedPos(): string | null {
    try {
      const raw = localStorage.getItem(MatrixSyncManager.POS_STORAGE_KEY)
      if (!raw) return null

      const data = JSON.parse(raw) as { pos: string; ts: number }
      if (typeof data.pos !== 'string' || typeof data.ts !== 'number') {
        localStorage.removeItem(MatrixSyncManager.POS_STORAGE_KEY)
        return null
      }

      // Check TTL — expired pos is stale and should not be reused
      if (Date.now() - data.ts > MatrixSyncManager.POS_TTL_MS) {
        localStorage.removeItem(MatrixSyncManager.POS_STORAGE_KEY)
        logger.info('SlidingSync pos expired (TTL 25min), removing from localStorage')
        return null
      }

      return data.pos
    } catch (err) {
      // R-17b: log silent catch in getPersistedPos (loadPersistedPos)
      logger.warn('getPersistedPos failed:', err)
      // Corrupted data or localStorage unavailable — silently skip
      return null
    }
  }

  /**
   * 判断 client 的 room store 是否已有房间数据。
   *
   * 用于 4.2.2：pos 是滑动同步的增量游标，只有当 room store 里还有房间
   * 数据时，恢复增量 pos 才是安全的；否则会得到空 timeline（增量同步只
   * 返回自 pos 以来变化的房间，无法重建未变化的房间）。
   */
  private hasRoomData(client: MatrixClient): boolean {
    try {
      const rooms = client.getRooms?.()
      return Array.isArray(rooms) && rooms.length > 0
    } catch {
      return false
    }
  }

  /**
   * Clear the persisted pos from localStorage.
   *
   * Called when the server rejects the pos with a 400 error (session expiry),
   * so the next restart performs a fresh initial sync instead of retrying
   * the stale pos.
   */
  clearPersistedPos(): void {
    try {
      localStorage.removeItem(MatrixSyncManager.POS_STORAGE_KEY)
    } catch {
      // localStorage unavailable — nothing to clear
    }
  }

  /**
   * Reset the "sliding sync ready" promise so callers can await the next PREPARED/SYNCING.
   */
  resetReady(): void {
    if (this.readyPromise) {
      this.readyResolve?.()
    }
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve
    })
  }

  /**
   * Mark sliding sync as ready (called when sync reaches PREPARED or SYNCING).
   */
  markReady(): void {
    if (this.readyResolve) {
      this.readyResolve()
      this.readyResolve = null
    }
  }

  /**
   * Wait for sliding sync to be ready, with a timeout.
   *
   * Returns false when sync was never started (no readyPromise) instead of
   * silently returning true — callers would proceed as if sync is ready
   * when in fact nothing has been initialised.
   */
  async waitForReady(timeoutMs: number = CLIENT_READY_TIMEOUT_MS): Promise<boolean> {
    if (!this.instance) return false
    if (!this.readyPromise) return false
    try {
      await Promise.race([
        this.readyPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ])
      return true
    } catch {
      return false
    }
  }
}
