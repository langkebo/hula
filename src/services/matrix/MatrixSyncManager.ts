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
 * Error statistics snapshot returned by {@link MatrixSyncManager.getErrorStats}.
 *
 * All counters are over the lifetime of the current SlidingSync instance
 * (reset on `stop()`). `consecutiveErrors` resets to 0 on the next successful
 * Complete event; `totalErrors` and `totalRequests` are cumulative.
 */
export interface SyncErrorStats {
  /** Consecutive errors since the last successful Complete event. */
  consecutiveErrors: number
  /** Total errors since the instance was created. */
  totalErrors: number
  /** Total requests (success + error) since the instance was created. */
  totalRequests: number
  /** Unix timestamp (ms) of the most recent error, or null if no errors. */
  lastErrorTime: number | null
}

/**
 * Internal seam: sliding-window quality tracker for SlidingSync.
 *
 * Hidden inside MatrixSyncManager — not part of the public interface.
 * Records RequestFinished (with/without error) and Complete events to
 * maintain:
 *   - consecutive/total error counters
 *   - a sliding window of the last 100 request outcomes (for success rate)
 *   - a sliding window of the last 10 inter-Complete intervals (for latency)
 *
 * @see codebase-design — internal seam private to MatrixSyncManager's
 *   implementation; tested through the public interface.
 */
class SyncQualityTracker {
  private static readonly OUTCOME_WINDOW = 100
  private static readonly LATENCY_WINDOW = 10

  private consecutiveErrors = 0
  private totalErrors = 0
  private totalRequests = 0
  private lastErrorTime: number | null = null

  /** Sliding window of recent request outcomes (true = success, false = error). */
  private readonly outcomes: boolean[] = []
  /** Sliding window of recent inter-Complete intervals (ms). */
  private readonly latencies: number[] = []
  /** Timestamp of the previous Complete event, for interval calculation. */
  private lastCompleteTs: number | null = null

  /** Record a RequestFinished event. `error` is non-null when the request failed. */
  recordRequest(error: Error | undefined): void {
    this.totalRequests++
    const success = !error
    this.outcomes.push(success)
    if (this.outcomes.length > SyncQualityTracker.OUTCOME_WINDOW) {
      this.outcomes.shift()
    }

    if (error) {
      this.consecutiveErrors++
      this.totalErrors++
      this.lastErrorTime = Date.now()
    }
    // Note: consecutiveErrors is reset in recordComplete()
  }

  /** Record a Complete event (successful sync cycle). */
  recordComplete(): void {
    this.consecutiveErrors = 0

    const now = Date.now()
    if (this.lastCompleteTs !== null) {
      const interval = now - this.lastCompleteTs
      this.latencies.push(interval)
      if (this.latencies.length > SyncQualityTracker.LATENCY_WINDOW) {
        this.latencies.shift()
      }
    }
    this.lastCompleteTs = now

    // Complete also counts as a successful request for the outcome window
    this.totalRequests++
    this.outcomes.push(true)
    if (this.outcomes.length > SyncQualityTracker.OUTCOME_WINDOW) {
      this.outcomes.shift()
    }
  }

  getErrorStats(): SyncErrorStats {
    return {
      consecutiveErrors: this.consecutiveErrors,
      totalErrors: this.totalErrors,
      totalRequests: this.totalRequests,
      lastErrorTime: this.lastErrorTime
    }
  }

  /** Average inter-Complete interval (ms) over the last 10 samples. Returns 0 if < 2 samples. */
  getSyncLatency(): number {
    if (this.latencies.length === 0) return 0
    const sum = this.latencies.reduce((acc, v) => acc + v, 0)
    return Math.round(sum / this.latencies.length)
  }

  /** Success rate over the last 100 requests. Returns 1 when no requests recorded. */
  getSuccessRate(): number {
    if (this.outcomes.length === 0) return 1
    const successes = this.outcomes.filter((o) => o).length
    return successes / this.outcomes.length
  }

  /** Reset all counters and windows (called on stop/recreate). */
  reset(): void {
    this.consecutiveErrors = 0
    this.totalErrors = 0
    this.totalRequests = 0
    this.lastErrorTime = null
    this.outcomes.length = 0
    this.latencies.length = 0
    this.lastCompleteTs = null
  }
}

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
  private readonly qualityTracker = new SyncQualityTracker()

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
      // 质量追踪：记录每次请求结果和 Complete 周期
      if (state === SlidingSyncState.Complete) {
        this.qualityTracker.recordComplete()
      } else if (state === SlidingSyncState.RequestFinished) {
        this.qualityTracker.recordRequest(err)
      }

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
   * listener to avoid memory leaks. The persisted pos in localStorage is
   * NOT cleared — it will be reused on the next `create()` call if within TTL.
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
    this.qualityTracker.reset()
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
   * Get the current network type (for testing/monitoring).
   * Returns null when no SlidingSync instance is active.
   */
  getCurrentNetworkType(): NetworkType | null {
    return this.currentNetworkType
  }

  /**
   * Get error statistics for the current SlidingSync instance.
   *
   * Returns a snapshot of { consecutiveErrors, totalErrors, totalRequests, lastErrorTime }.
   * All counters reset on `stop()`. `consecutiveErrors` resets to 0 on the next
   * successful Complete event.
   *
   * Deep module: hides the SyncQualityTracker's sliding window and counter logic
   * behind a single accessor. Callers (telemetry, diagnostics, UI health indicators)
   * get a complete picture without knowing the tracking implementation.
   */
  getErrorStats(): SyncErrorStats {
    return this.qualityTracker.getErrorStats()
  }

  /**
   * Get the average sync latency (ms) over the last 10 Complete events.
   *
   * Latency = inter-Complete interval (time between consecutive successful sync cycles).
   * Returns 0 when fewer than 2 Complete events have been recorded.
   *
   * Deep module: hides the latency sliding window and timestamp pairing logic.
   * Useful for network quality monitoring and adaptive timeout tuning.
   */
  getSyncLatency(): number {
    return this.qualityTracker.getSyncLatency()
  }

  /**
   * Get the success rate over the last 100 requests.
   *
   * Returns a value in [0, 1] where 1 = all requests succeeded, 0 = all failed.
   * Returns 1 when no requests have been recorded (no failures).
   *
   * Deep module: hides the outcome sliding window. Callers get a single number
   * for health dashboards without managing the window themselves.
   */
  getSuccessRate(): number {
    return this.qualityTracker.getSuccessRate()
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
    } catch {
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
   */
  async waitForReady(timeoutMs: number = 10000): Promise<boolean> {
    if (!this.instance) return false
    if (!this.readyPromise) return true
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
