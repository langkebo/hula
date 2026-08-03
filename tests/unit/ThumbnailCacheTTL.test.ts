/**
 * Task 17: 媒体缓存 7 天 TTL + LRU 淘汰
 *
 * 测试对象：ThumbnailCacheJanitor（纯逻辑，注入 deleteFile/saveMetadata，不依赖 Tauri 运行时）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_AGE_MS, MAX_TOTAL_SIZE, ThumbnailCacheJanitor } from '@/stores/domains/widget/thumbnailCacheJanitor'

describe('ThumbnailCacheJanitor TTL + LRU', () => {
  let now: number
  let deleteFile: ReturnType<typeof vi.fn>

  beforeEach(() => {
    now = 1_000_000
    deleteFile = vi.fn().mockResolvedValue(true)
  })

  const makeJanitor = () => new ThumbnailCacheJanitor({ deleteFile }, { now: () => now })

  it('marks entries older than 7 days as expired (isFresh)', () => {
    const janitor = makeJanitor()
    janitor.recordCache('thumb1.jpg', 1024)
    // 未过期
    expect(janitor.isFresh('thumb1.jpg')).toBe(true)
    // 恰好 7 天：仍新鲜（边界含等号）
    now += MAX_AGE_MS
    expect(janitor.isFresh('thumb1.jpg')).toBe(true)
    // 7 天 + 1ms：过期
    now += 1
    expect(janitor.isFresh('thumb1.jpg')).toBe(false)
  })

  it('evicts LRU entries when total size exceeds 500MB', async () => {
    const janitor = makeJanitor()
    const largeSize = 200 * 1024 * 1024 // 200MB
    await janitor.add('old', largeSize) // 200MB
    now += 1000
    await janitor.add('new1', largeSize) // 400MB
    expect(janitor.size()).toBe(2)
    expect(deleteFile).not.toHaveBeenCalled()

    now += 1000
    // 再加 200MB → 总计 600MB，'old'（最久未访问）应被淘汰
    const evicted = await janitor.add('new2', largeSize)
    expect(evicted).toEqual(['old'])
    expect(janitor.getMetadata('old')).toBeUndefined()
    expect(janitor.getMetadata('new1')).toBeDefined()
    expect(janitor.getMetadata('new2')).toBeDefined()
    expect(janitor.getTotalSize()).toBe(largeSize * 2) // 400MB
    expect(deleteFile).toHaveBeenCalledWith('old')
  })

  it('cleanupExpired removes expired entries and deletes their files', async () => {
    const janitor = makeJanitor()
    // 先记录 expired（t0）
    janitor.recordCache('expired.jpg', 512)
    // 前进时间超过 TTL，再记录 fresh（新时刻，未过期）
    now += MAX_AGE_MS + 1
    janitor.recordCache('fresh.jpg', 512)
    const removed = await janitor.cleanupExpired()
    expect(removed).toEqual(['expired.jpg'])
    expect(janitor.size()).toBe(1)
    expect(janitor.getMetadata('fresh.jpg')).toBeDefined()
    expect(janitor.getMetadata('expired.jpg')).toBeUndefined()
    expect(deleteFile).toHaveBeenCalledWith('expired.jpg')
    expect(deleteFile).toHaveBeenCalledTimes(1)
  })

  it('updates lastAccessed on cache hit (touch)', () => {
    const janitor = makeJanitor()
    janitor.recordCache('thumb.jpg', 1024)
    const before = janitor.getMetadata('thumb.jpg')!.lastAccessed
    now += 5000
    janitor.touch('thumb.jpg')
    const after = janitor.getMetadata('thumb.jpg')!.lastAccessed
    expect(after).toBeGreaterThan(before)
    expect(after).toBe(now)
  })

  it('persists metadata via saveMetadata callback', () => {
    const saveMetadata = vi.fn()
    const janitor = new ThumbnailCacheJanitor({ deleteFile, saveMetadata })
    janitor.recordCache('a.jpg', 10)
    expect(saveMetadata).toHaveBeenCalled()
    // forget 也应触发持久化
    saveMetadata.mockClear()
    janitor.forget('a.jpg')
    expect(saveMetadata).toHaveBeenCalled()
  })

  it('loads initial metadata via loadMetadata on construction', () => {
    const initial = new Map([['pre.jpg', { createdAt: 0, lastAccessed: 0, size: 99 }]])
    const loadMetadata = vi.fn().mockReturnValue(initial)
    const janitor = new ThumbnailCacheJanitor({ deleteFile, loadMetadata })
    expect(janitor.size()).toBe(1)
    expect(janitor.getMetadata('pre.jpg')?.size).toBe(99)
    expect(loadMetadata).toHaveBeenCalled()
  })

  it('does not evict when under the size limit', async () => {
    const janitor = makeJanitor()
    const evicted = await janitor.add('a', 100)
    expect(evicted).toEqual([])
    await janitor.add('b', 100)
    expect(janitor.size()).toBe(2)
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('evicts multiple entries until under limit', async () => {
    // 用小 maxTotalSize 便于触发多轮淘汰
    const janitor = new ThumbnailCacheJanitor({ deleteFile }, { now: () => now, maxTotalSize: 10 })
    now += 1
    await janitor.add('a', 4) // 4
    now += 1
    await janitor.add('b', 4) // 8
    now += 1
    await janitor.add('c', 4) // 12 > 10 → 淘汰 'a' → 8
    expect(janitor.getMetadata('a')).toBeUndefined()
    now += 1
    await janitor.add('d', 4) // 12 > 10 → 淘汰 'b' → 8
    expect(janitor.getMetadata('b')).toBeUndefined()
    expect(janitor.size()).toBe(2) // c, d
  })

  it('keeps at least one entry (never evicts the last)', async () => {
    const janitor = new ThumbnailCacheJanitor({ deleteFile }, { now: () => now, maxTotalSize: 10 })
    await janitor.add('only', 1000) // 远超上限但仅一个
    expect(janitor.size()).toBe(1)
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('MAX_TOTAL_SIZE equals 500MB', () => {
    expect(MAX_TOTAL_SIZE).toBe(500 * 1024 * 1024)
  })
})
