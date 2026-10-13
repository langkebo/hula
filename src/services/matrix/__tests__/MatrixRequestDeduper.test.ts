import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixRequestDeduper } from '../MatrixRequestDeduper'

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

  // 以下三组锁定「本类是 in-flight 合并、不是结果缓存」这一**真实语义**
  // （原实现把语义写成 `windowMs`/`dedupWindowMs`，读起来像 100ms 结果缓存，与行为不符）。
  describe('in-flight 语义边界（防再度被误读为结果缓存）', () => {
    it('已完成 ⇏ 复用结果：第二次调用必然重新执行 fetcher', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')

      await MatrixRequestDeduper.dedupe('key1', fetcher)
      await MatrixRequestDeduper.dedupe('key1', fetcher)

      // 若哪天改成「窗口内返回旧结果」，unread_count 这类实时读取会拿到陈旧数据 —— 此处判红
      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('卡住的条目超过安全阀（60s）⇒ 不再被复用，重新发起', async () => {
      vi.useFakeTimers()
      try {
        const stuck = new Promise<string>(() => {}) // 永不 settle
        const stuckFetcher = vi.fn().mockReturnValue(stuck)

        void MatrixRequestDeduper.dedupe('key1', stuckFetcher)
        expect(MatrixRequestDeduper.getPendingCount()).toBe(1)

        // 阀内：仍复用（不再执行 fetcher）
        void MatrixRequestDeduper.dedupe('key1', stuckFetcher)
        expect(stuckFetcher).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(60_001)

        const fresh = vi.fn().mockResolvedValue('fresh')
        await expect(MatrixRequestDeduper.dedupe('key1', fresh)).resolves.toBe('fresh')
        expect(fresh).toHaveBeenCalledTimes(1)
      } finally {
        MatrixRequestDeduper.clear()
        vi.useRealTimers()
      }
    })

    it('stuck 条目被接替后，其完成不会误删接替者（否则合并能力静默失效）', async () => {
      vi.useFakeTimers()
      try {
        let resolveStuck!: (value: string) => void
        const stuck = new Promise<string>((resolve) => {
          resolveStuck = resolve
        })
        void MatrixRequestDeduper.dedupe('key1', () => stuck)

        // 越过安全阀，让第二个请求接替该 key
        await vi.advanceTimersByTimeAsync(60_001)
        const takeover = new Promise<string>(() => {}) // 仍在飞
        void MatrixRequestDeduper.dedupe('key1', () => takeover)
        expect(MatrixRequestDeduper.getPendingCount()).toBe(1)

        // 原条目此刻完成：不得把接替者一并删掉
        resolveStuck('old')
        await vi.advanceTimersByTimeAsync(0)

        expect(MatrixRequestDeduper.getPendingCount()).toBe(1)
      } finally {
        MatrixRequestDeduper.clear()
        vi.useRealTimers()
      }
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 when no pending requests', () => {
      expect(MatrixRequestDeduper.getPendingCount()).toBe(0)
    })
  })
})
