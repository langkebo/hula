import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MatrixRequestDeduper, createDedupedFetcher } from '../MatrixRequestDeduper'

describe('MatrixRequestDeduper', () => {
  beforeEach(() => {
    MatrixRequestDeduper.clear()
  })

  describe('dedupe', () => {
    it('should deduplicate concurrent requests', async () => {
      let callCount = 0
      const fetcher = vi.fn().mockImplementation(async () => {
        callCount++
        await new Promise((resolve) => setTimeout(resolve, 50))
        return `result-${callCount}`
      })

      const results = await Promise.all([
        MatrixRequestDeduper.dedupe('key1', fetcher),
        MatrixRequestDeduper.dedupe('key1', fetcher),
        MatrixRequestDeduper.dedupe('key1', fetcher)
      ])

      expect(results[0]).toBe('result-1')
      expect(results[1]).toBe('result-1')
      expect(results[2]).toBe('result-1')
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('should allow different keys to execute independently', async () => {
      const fetcher1 = vi.fn().mockResolvedValue('result-1')
      const fetcher2 = vi.fn().mockResolvedValue('result-2')

      const [result1, result2] = await Promise.all([
        MatrixRequestDeduper.dedupe('key1', fetcher1),
        MatrixRequestDeduper.dedupe('key2', fetcher2)
      ])

      expect(result1).toBe('result-1')
      expect(result2).toBe('result-2')
      expect(fetcher1).toHaveBeenCalledTimes(1)
      expect(fetcher2).toHaveBeenCalledTimes(1)
    })

    it('should allow sequential requests after completion', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')

      await MatrixRequestDeduper.dedupe('key1', fetcher)
      await MatrixRequestDeduper.dedupe('key1', fetcher)

      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('should clean up pending entries after completion', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')

      await MatrixRequestDeduper.dedupe('key1', fetcher)
      expect(MatrixRequestDeduper.getPendingCount()).toBe(0)
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 when no pending requests', () => {
      expect(MatrixRequestDeduper.getPendingCount()).toBe(0)
    })
  })
})

describe('createDedupedFetcher', () => {
  beforeEach(() => {
    MatrixRequestDeduper.clear()
  })

  it('should create a deduped fetcher function', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({ id: '1', name: 'Test' })
    const dedupedFetch = createDedupedFetcher('test', mockFetcher)

    const result = await dedupedFetch('1')
    expect(result).toEqual({ id: '1', name: 'Test' })
    expect(mockFetcher).toHaveBeenCalledWith('1')
  })
})
