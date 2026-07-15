import { type MatrixClient, SlidingSync } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import type { MatrixClientConfig } from './MatrixClientService'

const logger = createLogger('SyncManager')

export class MatrixSyncManager {
  private instance: SlidingSync | null = null
  private readyResolve: (() => void) | null = null
  private readyPromise: Promise<void> | null = null

  /**
   * Create a SlidingSync instance from the current config.
   */
  create(client: MatrixClient, config: MatrixClientConfig): SlidingSync {
    const ss = config.slidingSync ?? {}
    const roomRangeEnd = ss.roomRangeEnd ?? 49
    const timelineLimit = ss.timelineLimit ?? 10
    const pollTimeout = ss.pollTimeout ?? 30000

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
      { timeline_limit: timelineLimit, required_state: requiredState },
      client,
      pollTimeout
    )

    logger.info(`Sliding Sync created (rooms=${roomRangeEnd + 1}, timeline=${timelineLimit}, timeout=${pollTimeout}ms)`)
    this.instance = slidingSync
    return slidingSync
  }

  /**
   * Get the current SlidingSync instance, if any.
   */
  get(): SlidingSync | null {
    return this.instance
  }

  /**
   * Stop and clear the current instance.
   */
  stop(): void {
    this.instance?.stop?.()
    this.instance = null
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
