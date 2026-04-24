import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MatrixCacheManager, createCachedFetcher } from '../MatrixCacheManager'

describe('MatrixCacheManager', () => {
  beforeEach(() => {
    MatrixCacheManager.clear()
  })

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      MatrixCacheManager.set('key1', { name: 'test' })
      const result = MatrixCacheManager.get<{ name: string }>('key1')
      expect(result).toEqual({ name: 'test' })
    })

    it('should return null for non-existent keys', () => {
      expect(MatrixCacheManager.get('nonexistent')).toBeNull()
    })

    it('should respect TTL and expire entries', async () => {
      MatrixCacheManager.set('short-lived', 'data', 10)
      expect(MatrixCacheManager.get('short-lived')).toBe('data')

      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(MatrixCacheManager.get('short-lived')).toBeNull()
    })
  })

  describe('has', () => {
    it('should return true for existing non-expired entries', () => {
      MatrixCacheManager.set('key1', 'value1')
      expect(MatrixCacheManager.has('key1')).toBe(true)
    })

    it('should return false for non-existent keys', () => {
      expect(MatrixCacheManager.has('nonexistent')).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete an entry', () => {
      MatrixCacheManager.set('key1', 'value1')
      expect(MatrixCacheManager.delete('key1')).toBe(true)
      expect(MatrixCacheManager.get('key1')).toBeNull()
    })
  })

  describe('deleteByPrefix', () => {
    it('should delete all entries with matching prefix', () => {
      MatrixCacheManager.set('room:1', 'data1')
      MatrixCacheManager.set('room:2', 'data2')
      MatrixCacheManager.set('space:1', 'data3')

      const count = MatrixCacheManager.deleteByPrefix('room:')
      expect(count).toBe(2)
      expect(MatrixCacheManager.get('room:1')).toBeNull()
      expect(MatrixCacheManager.get('space:1')).toBe('data3')
    })
  })

  describe('clear', () => {
    it('should clear all entries', () => {
      MatrixCacheManager.set('key1', 'value1')
      MatrixCacheManager.set('key2', 'value2')
      MatrixCacheManager.clear()
      expect(MatrixCacheManager.get('key1')).toBeNull()
      expect(MatrixCacheManager.get('key2')).toBeNull()
    })
  })

  describe('getOrFetch', () => {
    it('should return cached data when available', async () => {
      MatrixCacheManager.set('cached-key', 'cached-data')
      const fetcher = vi.fn().mockResolvedValue('fresh-data')

      const result = await MatrixCacheManager.getOrFetch('cached-key', fetcher)
      expect(result).toBe('cached-data')
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('should fetch and cache when not available', async () => {
      const fetcher = vi.fn().mockResolvedValue('fresh-data')

      const result = await MatrixCacheManager.getOrFetch('new-key', fetcher)
      expect(result).toBe('fresh-data')
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(MatrixCacheManager.get('new-key')).toBe('fresh-data')
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      MatrixCacheManager.set('key1', 'value1')
      const stats = MatrixCacheManager.getStats()
      expect(stats.size).toBe(1)
      expect(stats.maxSize).toBe(500)
    })
  })
})

describe('createCachedFetcher', () => {
  beforeEach(() => {
    MatrixCacheManager.clear()
  })

  it('should create a fetcher that caches results', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ id: '1', name: 'Test' })
    const cachedFetch = createCachedFetcher('test', mockFetcher, 60000)

    const result1 = await cachedFetch('1')
    expect(result1).toEqual({ id: '1', name: 'Test' })
    expect(mockFetcher).toHaveBeenCalledTimes(1)

    const result2 = await cachedFetch('1')
    expect(result2).toEqual({ id: '1', name: 'Test' })
    expect(mockFetcher).toHaveBeenCalledTimes(1)
  })

  it('should force refresh when requested', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ id: '1', name: 'Test' })
    const cachedFetch = createCachedFetcher('test', mockFetcher, 60000)

    await cachedFetch('1')
    await cachedFetch('1', true)
    expect(mockFetcher).toHaveBeenCalledTimes(2)
  })
})
