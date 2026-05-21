import { info } from '@tauri-apps/plugin-log'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class MatrixCacheManager {
  private static caches = new Map<string, CacheEntry<unknown>>()
  private static maxCacheSize = 500
  private static hits = 0
  private static misses = 0
  private static statsInterval: ReturnType<typeof setInterval> | null = null

  static get<T>(key: string): T | null {
    const entry = MatrixCacheManager.caches.get(key)
    if (!entry) {
      MatrixCacheManager.misses++
      return null
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      MatrixCacheManager.caches.delete(key)
      MatrixCacheManager.misses++
      return null
    }

    MatrixCacheManager.hits++
    return entry.data as T
  }

  static set<T>(key: string, data: T, ttlMs: number = 30000): void {
    if (MatrixCacheManager.caches.size >= MatrixCacheManager.maxCacheSize) {
      const oldestKey = MatrixCacheManager.findOldestEntry()
      if (oldestKey) MatrixCacheManager.caches.delete(oldestKey)
    }

    MatrixCacheManager.caches.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  static has(key: string): boolean {
    return MatrixCacheManager.get(key) !== null
  }

  static delete(key: string): boolean {
    return MatrixCacheManager.caches.delete(key)
  }

  static deleteByPrefix(prefix: string): number {
    let count = 0
    for (const key of MatrixCacheManager.caches.keys()) {
      if (key.startsWith(prefix)) {
        MatrixCacheManager.caches.delete(key)
        count++
      }
    }
    return count
  }

  static clear(): void {
    MatrixCacheManager.caches.clear()
    info('[Cache] 缓存已清空')
  }

  static getStats(): { size: number; maxSize: number; hitRate: number; hits: number; misses: number } {
    const total = MatrixCacheManager.hits + MatrixCacheManager.misses
    return {
      size: MatrixCacheManager.caches.size,
      maxSize: MatrixCacheManager.maxCacheSize,
      hitRate: total > 0 ? MatrixCacheManager.hits / total : 0,
      hits: MatrixCacheManager.hits,
      misses: MatrixCacheManager.misses
    }
  }

  static enableStatsReporting(intervalMs = 60000): void {
    if (MatrixCacheManager.statsInterval) return
    MatrixCacheManager.statsInterval = setInterval(() => {
      const stats = MatrixCacheManager.getStats()
      if (stats.size > 0) {
      }
    }, intervalMs)
  }

  static disableStatsReporting(): void {
    if (MatrixCacheManager.statsInterval) {
      clearInterval(MatrixCacheManager.statsInterval)
      MatrixCacheManager.statsInterval = null
    }
  }

  static async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 30000): Promise<T> {
    const cached = MatrixCacheManager.get<T>(key)
    if (cached !== null) return cached

    const data = await fetcher()
    MatrixCacheManager.set(key, data, ttlMs)
    return data
  }

  private static findOldestEntry(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of MatrixCacheManager.caches.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    return oldestKey
  }
}

export function createCachedFetcher<T>(
  keyPrefix: string,
  fetcher: (id: string) => Promise<T>,
  ttlMs: number = 30000
): (id: string, forceRefresh?: boolean) => Promise<T> {
  return async (id: string, forceRefresh = false): Promise<T> => {
    const cacheKey = `${keyPrefix}:${id}`

    if (!forceRefresh) {
      const cached = MatrixCacheManager.get<T>(cacheKey)
      if (cached !== null) return cached
    }

    const data = await fetcher(id)
    MatrixCacheManager.set(cacheKey, data, ttlMs)
    return data
  }
}
