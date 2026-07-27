/**
 * 媒体缓存 TTL + LRU 淘汰 Composable (§9.4)
 *
 * 为 thumbnailCache 等媒体缓存提供：
 * - TTL 过期检查（默认 7 天）
 * - LRU 大小淘汰（默认 500MB 上限）
 * - 启动时清理过期项
 *
 * 缓存条目按 lastAccessed 排序，淘汰最久未使用的项。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('useMediaCacheTTL')

interface MediaCacheTTLConfig {
  /** 最大缓存时长（毫秒），默认 7 天 */
  maxAgeMs: number
  /** 最大总缓存大小（字节），默认 500MB */
  maxTotalSizeBytes: number
}

interface CacheEntry {
  size: number
  createdAt: number
  lastAccessed: number
}

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 天
const DEFAULT_MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024 // 500MB

export function useMediaCacheTTL(config?: Partial<MediaCacheTTLConfig>) {
  const maxAgeMs = config?.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  const maxTotalSizeBytes = config?.maxTotalSizeBytes ?? DEFAULT_MAX_TOTAL_SIZE_BYTES

  /** 按 lastAccessed 排序的有序 Map（最旧的在前面） */
  const entries = new Map<string, CacheEntry>()

  /**
   * 记录一个缓存项
   * @param key 缓存键（通常是 URL）
   * @param size 文件大小（字节）
   * @param timestamp 记录时间戳（可选，默认当前时间）
   */
  function record(key: string, size: number, timestamp: number = Date.now()): void {
    // 如果已存在，先删除以更新顺序
    entries.delete(key)
    entries.set(key, {
      size,
      createdAt: timestamp,
      lastAccessed: timestamp
    })
  }

  /**
   * 检查缓存项是否过期
   */
  function isExpired(key: string, now: number = Date.now()): boolean {
    const entry = entries.get(key)
    if (!entry) return true
    return now - entry.createdAt > maxAgeMs
  }

  /**
   * 更新项的最近访问时间（LRU 顺序）
   */
  function touch(key: string, timestamp: number = Date.now()): void {
    const entry = entries.get(key)
    if (!entry) return
    entries.delete(key)
    entry.lastAccessed = timestamp
    entries.set(key, entry)
  }

  /**
   * 检查缓存项是否存在
   */
  function has(key: string): boolean {
    return entries.has(key)
  }

  /**
   * 删除一个缓存项
   */
  function remove(key: string): void {
    entries.delete(key)
  }

  /**
   * 获取当前缓存总大小（字节）
   */
  function getTotalSize(): number {
    let total = 0
    for (const entry of entries.values()) {
      total += entry.size
    }
    return total
  }

  /**
   * 清理所有过期项
   * @returns 被清理的 key 列表
   */
  function purgeExpired(now: number = Date.now()): string[] {
    const purged: string[] = []
    for (const [key, entry] of entries) {
      if (now - entry.createdAt > maxAgeMs) {
        entries.delete(key)
        purged.push(key)
      }
    }
    if (purged.length > 0) {
      logger.info(`[MediaCacheTTL] 清理 ${purged.length} 个过期缓存项`)
    }
    return purged
  }

  /**
   * 执行 LRU 大小淘汰，使总大小不超过 maxTotalSizeBytes
   * @returns 被淘汰的 key 列表
   */
  function enforceSizeLimit(): string[] {
    const evicted: string[] = []
    let totalSize = getTotalSize()

    if (totalSize <= maxTotalSizeBytes) {
      return evicted
    }

    // entries 的迭代顺序就是 lastAccessed 的顺序（最旧在前）
    // 注意：Map 的迭代顺序是插入顺序，我们通过 delete + set 来维护 LRU 顺序
    for (const [key, entry] of entries) {
      if (totalSize <= maxTotalSizeBytes) break
      entries.delete(key)
      totalSize -= entry.size
      evicted.push(key)
    }

    if (evicted.length > 0) {
      const sizeMB = (maxTotalSizeBytes / 1024 / 1024).toFixed(0)
      logger.info(`[MediaCacheTTL] LRU 淘汰 ${evicted.length} 个缓存项（限制 ${sizeMB}MB）`)
    }

    return evicted
  }

  /**
   * 清空所有缓存项
   */
  function clear(): void {
    entries.clear()
  }

  /**
   * 获取当前缓存项数量
   */
  function getSize(): number {
    return entries.size
  }

  return {
    record,
    isExpired,
    touch,
    has,
    remove,
    getTotalSize,
    purgeExpired,
    enforceSizeLimit,
    clear,
    size: getSize
  }
}
