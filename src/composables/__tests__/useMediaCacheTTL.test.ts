import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaCacheTTL } from '@/composables/useMediaCacheTTL'

describe('useMediaCacheTTL — 媒体缓存 TTL + LRU 淘汰 (§9.4)', () => {
  let cache: ReturnType<typeof useMediaCacheTTL>

  beforeEach(() => {
    vi.useFakeTimers()
    cache = useMediaCacheTTL({
      maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 天
      maxTotalSizeBytes: 500 * 1024 * 1024 // 500MB
    })
  })

  describe('TTL 过期检查', () => {
    it('未过期的缓存项 isExpired 返回 false', () => {
      const now = Date.now()
      cache.record('url1', 1024, now)

      vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000) // 6 天后
      expect(cache.isExpired('url1')).toBe(false)
    })

    it('超过 7 天的缓存项 isExpired 返回 true', () => {
      const now = Date.now()
      cache.record('url1', 1024, now)

      vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1) // 7 天 + 1ms
      expect(cache.isExpired('url1')).toBe(true)
    })

    it('不存在的 key isExpired 返回 true', () => {
      expect(cache.isExpired('nonexistent')).toBe(true)
    })
  })

  describe('清理过期项', () => {
    it('purgeExpired 仅清理过期项，保留有效项', () => {
      const now = Date.now()
      cache.record('fresh', 1024, now)
      cache.record('stale', 2048, now - 8 * 24 * 60 * 60 * 1000) // 8 天前

      const purged = cache.purgeExpired()

      expect(purged).toHaveLength(1)
      expect(purged[0]).toBe('stale')
      expect(cache.has('fresh')).toBe(true)
      expect(cache.has('stale')).toBe(false)
    })
  })

  describe('LRU 大小淘汰', () => {
    it('总大小超过限制时淘汰最久未使用的项', () => {
      const smallLimit = useMediaCacheTTL({
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        maxTotalSizeBytes: 100 // 100 字节限制
      })

      const now = Date.now()
      smallLimit.record('old', 40, now)
      vi.advanceTimersByTime(1000)
      smallLimit.record('mid', 40, now + 1000)
      vi.advanceTimersByTime(1000)
      smallLimit.record('new', 40, now + 2000) // 总计 120 > 100

      // 应淘汰 'old'（最久未使用）
      const evicted = smallLimit.enforceSizeLimit()

      expect(evicted).toContain('old')
      expect(smallLimit.has('old')).toBe(false)
      expect(smallLimit.has('new')).toBe(true)
    })

    it('未超限时不淘汰任何项', () => {
      cache.record('item1', 1024, Date.now())
      const evicted = cache.enforceSizeLimit()
      expect(evicted).toHaveLength(0)
    })
  })

  describe('访问更新 LRU 顺序', () => {
    it('touch 将项移到最新位置，避免被淘汰', () => {
      const smallLimit = useMediaCacheTTL({
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        maxTotalSizeBytes: 100
      })

      const now = Date.now()
      smallLimit.record('a', 40, now)
      smallLimit.record('b', 40, now + 1000)

      // touch 'a' 使其成为最近使用
      smallLimit.touch('a', now + 2000)

      smallLimit.record('c', 40, now + 3000) // 总计 120 > 100

      const evicted = smallLimit.enforceSizeLimit()
      // 'b' 应被淘汰（最久未使用），'a' 因 touch 被保留
      expect(evicted).toContain('b')
      expect(smallLimit.has('a')).toBe(true)
    })
  })

  describe('总大小统计', () => {
    it('getTotalSize 返回所有有效项的总大小', () => {
      cache.record('a', 1024, Date.now())
      cache.record('b', 2048, Date.now())

      expect(cache.getTotalSize()).toBe(3072)
    })

    it('删除项后总大小减少', () => {
      cache.record('a', 1024, Date.now())
      cache.record('b', 2048, Date.now())

      cache.remove('a')
      expect(cache.getTotalSize()).toBe(2048)
    })
  })

  describe('重置', () => {
    it('clear 清空所有缓存项', () => {
      cache.record('a', 1024, Date.now())
      cache.record('b', 2048, Date.now())

      cache.clear()

      expect(cache.getTotalSize()).toBe(0)
      expect(cache.has('a')).toBe(false)
    })
  })
})
