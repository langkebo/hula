/**
 * FIFO-fair counting semaphore for concurrency limits (plan §19.6).
 *
 * Each named domain (media uploads, avatar resolves, admin batch, etc.)
 * takes a permit from a shared semaphore instance and releases it once
 * the in-flight work finishes. Use `run()` for scoped acquire/release so
 * exceptions can't leak permits.
 */
export class Semaphore {
  readonly name: string
  private readonly capacity: number
  private available: number
  private readonly waiters: Array<() => void> = []

  constructor(name: string, capacity: number) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error(`Semaphore "${name}" capacity must be >= 1`)
    }
    this.name = name
    this.capacity = capacity
    this.available = capacity
  }

  get inUse(): number {
    return this.capacity - this.available
  }

  get queued(): number {
    return this.waiters.length
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1
      return
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  release(): void {
    const next = this.waiters.shift()
    if (next) {
      next()
    } else if (this.available < this.capacity) {
      this.available += 1
    }
  }

  async run<T>(task: () => Promise<T> | T): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }
}

const registry = new Map<string, Semaphore>()

/**
 * Plan §19.6 domain caps. Each named semaphore is a singleton so all call
 * sites for the same domain share a single permit pool.
 */
export const SemaphoreLimits = {
  mediaUpload: 3,
  mediaDownload: 6,
  avatarResolve: 8,
  adminBatch: 4,
  aiStreaming: 2
} as const

export type SemaphoreName = keyof typeof SemaphoreLimits | (string & {})

export function getSemaphore(name: SemaphoreName, capacity?: number): Semaphore {
  let sem = registry.get(name)
  if (!sem) {
    const cap = capacity ?? (name in SemaphoreLimits ? SemaphoreLimits[name as keyof typeof SemaphoreLimits] : 1)
    sem = new Semaphore(name, cap)
    registry.set(name, sem)
  }
  return sem
}

export function __resetSemaphoresForTest(): void {
  registry.clear()
}
