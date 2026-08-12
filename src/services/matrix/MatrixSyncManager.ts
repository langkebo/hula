import { type MatrixClient, SlidingSync, SlidingSyncEvent, SlidingSyncState } from 'matrix-js-sdk'
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
export type NetworkType = 'wifi' | '4g' | '3g' | 'slow-2g'

/**
 * SlidingSync parameter preset for a given network type.
 * - roomRangeEnd: number of rooms to sync (range [0, roomRangeEnd])
 * - timelineLimit: number of timeline events per room
 * - pollTimeout: long-polling timeout in ms
 */
export interface SlidingSyncPreset {
  roomRangeEnd: number
  timelineLimit: number
  pollTimeout: number
}

/**
 * Four-tier presets adapted to network quality.
 * Wi-Fi/4G use larger ranges for faster initial load; 3G/2G reduce payload
 * to minimize bandwidth and improve responsiveness on slow links.
 */
export const SLIDING_SYNC_PRESETS: Record<NetworkType, SlidingSyncPreset> = {
  wifi: { roomRangeEnd: 49, timelineLimit: 10, pollTimeout: 30000 },
  '4g': { roomRangeEnd: 29, timelineLimit: 5, pollTimeout: 25000 },
  '3g': { roomRangeEnd: 19, timelineLimit: 3, pollTimeout: 20000 },
  'slow-2g': { roomRangeEnd: 9, timelineLimit: 1, pollTimeout: 15000 }
}

/**
 * Detect the current network type using the Network Information API.
 *
 * Returns 'wifi' when:
 * - navigator.connection is unavailable (desktop Firefox/Safari, some Tauri builds)
 * - effectiveType is unknown
 *
 * On Android WebView (used by Tauri mobile), the API is well-supported.
 */
export function detectNetworkType(): NetworkType {
  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection
  if (!conn?.effectiveType) return 'wifi'
  const type = conn.effectiveType
  if (type === '4g') return '4g'
  if (type === '3g') return '3g'
  if (type === 'slow-2g') return 'slow-2g'
  return 'wifi' // 'wifi' or unknown → use full preset
}

export class MatrixSyncManager {
  private static readonly POS_STORAGE_KEY = 'matrix.sliding_sync.pos'
  private static readonly POS_TTL_MS = 24 * 60 * 60 * 1000 // 24h

  private instance: SlidingSync | null = null
  private readyResolve: (() => void) | null = null
  private readyPromise: Promise<void> | null = null
  private posPersistListener: SlidingSyncLifecycleListener | null = null
  private currentNetworkType: NetworkType | null = null
  private networkChangeHandler: (() => void) | null = null

  /**
   * Create a SlidingSync instance from the current config.
   *
   * Parameter defaults are selected dynamically based on the detected network
   * type (via `detectNetworkType()`). Explicit values in `config.slidingSync`
   * always take precedence over the preset.
   *
   * If a persisted pos exists in localStorage (within TTL), it is set as the
   * initial pos via `slidingSync.setInitialPos()`, enabling incremental sync
   * after restart. The pos is continuously updated as sync responses arrive.
   */
  create(client: MatrixClient, config: MatrixClientConfig): SlidingSync {
    // 根据网络类型选择预设参数（config 中的显式值优先）
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

    // §9.2 多列表订阅：好友/空间/DM 列表，使用最小 timeline_limit 减少首屏负载
    const extensionListFilters: Record<string, Record<string, unknown>> = {
      friends: { room_types: ['im.hula.friend_list'] },
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
    const persistedPos = this.loadPersistedPos()
    if (persistedPos) {
      slidingSync.setInitialPos(persistedPos)
      logger.info(`Sliding Sync restored pos from localStorage (pos=${persistedPos.slice(0, 8)}...)`)
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

    // 注册网络变化监听，在网络降级/升级时记录日志
    // 注意：不热重建 SlidingSync 实例（避免监听器丢失 + client.startClient 引用失效）
    // 新预设将在下次 create() 时生效
    this.registerNetworkChangeListener()

    logger.info(
      `Sliding Sync created (network=${networkType}, rooms=${roomRangeEnd + 1}, timeline=${timelineLimit}, timeout=${pollTimeout}ms, homeserver=${runtimeHomeserverUrl})`
    )
    this.instance = slidingSync
    return slidingSync
  }

  /**
   * Get the current SlidingSync instance, if any.
   *
   * 仅用于 client.startClient({ slidingSync }) 初始化。
   * 事件订阅请使用 onLifecycleEvent / offLifecycleEvent，不要直接操作返回的实例。
   */
  get(): SlidingSync | null {
    return this.instance
  }

  /**
   * Subscribe to SlidingSync Lifecycle events (RequestFinished, Complete, etc.).
   *
   * 封装 SDK 的 `slidingSync.on(SlidingSyncEvent.Lifecycle, listener)`，
   * 避免调用方直接访问原始 SlidingSync 实例。
   */
  onLifecycleEvent(listener: SlidingSyncLifecycleListener): void {
    this.instance?.on(SlidingSyncEvent.Lifecycle, listener)
  }

  /**
   * Unsubscribe from SlidingSync Lifecycle events.
   */
  offLifecycleEvent(listener: SlidingSyncLifecycleListener): void {
    this.instance?.off(SlidingSyncEvent.Lifecycle, listener)
  }

  /**
   * Stop and clear the current instance.
   *
   * Also removes the internal pos persistence listener and network change
   * listener to avoid memory leaks. The persisted `pos` IS cleared — when
   * `stop()` is called, the SlidingSync instance is being disposed and the
   * associated client's room store may be reset (e.g. client rebuild during
   * login). Retaining a stale `pos` would cause SlidingSync to fetch only
   * incremental updates on the next `create()`, leaving the new room store's
   * timelines empty (messages=0, isLast=true).
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
    const conn = (
      navigator as unknown as { connection?: { addEventListener?: (type: string, handler: () => void) => void } }
    ).connection
    if (!conn?.addEventListener) return

    this.networkChangeHandler = () => this.adaptToNetwork()
    conn.addEventListener('change', this.networkChangeHandler)
  }

  /**
   * Unregister the network change listener.
   */
  private unregisterNetworkChangeListener(): void {
    if (!this.networkChangeHandler) return
    const conn = (
      navigator as unknown as { connection?: { removeEventListener?: (type: string, handler: () => void) => void } }
    ).connection
    conn?.removeEventListener?.('change', this.networkChangeHandler)
    this.networkChangeHandler = null
  }

  /**
   * Called when the network type changes (Wi-Fi ↔ 4G ↔ 3G ↔ slow-2g).
   *
   * Logs the transition and the preset that will take effect on the next
   * `create()` call. Does NOT hot-rebuild the current SlidingSync instance
   * to avoid:
   * 1. Losing lifecycle listeners registered via `onLifecycleEvent()`
   * 2. Invalidating the `client.startClient({ slidingSync })` reference
   *
   * The new preset will be applied on the next app restart or manual
   * `stop()` + `create()` cycle.
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
        logger.info('SlidingSync pos expired (TTL 24h), removing from localStorage')
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
  async waitForReady(timeoutMs: number = 10000): Promise<boolean> {
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
