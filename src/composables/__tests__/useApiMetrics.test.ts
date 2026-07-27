import { beforeEach, describe, expect, it } from 'vitest'
import { useApiMetrics } from '@/composables/useApiMetrics'

describe('useApiMetrics — API 性能指标监控 (§9.5)', () => {
  let metrics: ReturnType<typeof useApiMetrics>

  beforeEach(() => {
    metrics = useApiMetrics()
  })

  describe('recordApiCall', () => {
    it('记录单次 API 调用并计算平均延迟', () => {
      metrics.recordApiCall('friend.add', 100, true)
      metrics.recordApiCall('friend.add', 200, true)

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.apiCalls['friend.add'].count).toBe(2)
      expect(snapshot.apiCalls['friend.add'].successCount).toBe(2)
      expect(snapshot.apiCalls['friend.add'].avgLatencyMs).toBe(150)
    })

    it('记录失败的 API 调用', () => {
      metrics.recordApiCall('friend.add', 100, true)
      metrics.recordApiCall('friend.add', 200, false)

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.apiCalls['friend.add'].count).toBe(2)
      expect(snapshot.apiCalls['friend.add'].successCount).toBe(1)
      expect(snapshot.apiCalls['friend.add'].failureCount).toBe(1)
    })

    it('计算 P95 延迟', () => {
      // 20 次调用，延迟 10-200ms
      for (let i = 1; i <= 20; i++) {
        metrics.recordApiCall('room.join', i * 10, true)
      }

      const snapshot = metrics.getMetricsSnapshot()
      // P95 = 第 19 大的值 (index 18 in sorted 0-19) = 190ms
      expect(snapshot.apiCalls['room.join'].p95LatencyMs).toBeGreaterThanOrEqual(180)
      expect(snapshot.apiCalls['room.join'].p95LatencyMs).toBeLessThanOrEqual(200)
    })
  })

  describe('recordSync', () => {
    it('记录 Sliding Sync 耗时', () => {
      metrics.recordSync(500)
      metrics.recordSync(700)

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.slidingSync.count).toBe(2)
      expect(snapshot.slidingSync.avgDurationMs).toBe(600)
    })
  })

  describe('recordReplay', () => {
    it('记录离线队列回放成功率', () => {
      metrics.recordReplay(true)
      metrics.recordReplay(true)
      metrics.recordReplay(false)

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.offlineReplay.totalCount).toBe(3)
      expect(snapshot.offlineReplay.successCount).toBe(2)
      expect(snapshot.offlineReplay.successRate).toBeCloseTo(0.667, 2)
    })
  })

  describe('recordRetry', () => {
    it('记录重试触发率', () => {
      // 10 次 API 调用，3 次触发重试
      for (let i = 0; i < 10; i++) {
        metrics.recordApiCall('test.feature', 100, true)
      }
      metrics.recordRetry()
      metrics.recordRetry()
      metrics.recordRetry()

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.retryRate).toBeCloseTo(0.3, 2)
    })
  })

  describe('getMetricsSnapshot', () => {
    it('空状态下返回零值快照', () => {
      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.apiCalls).toEqual({})
      expect(snapshot.slidingSync.count).toBe(0)
      expect(snapshot.offlineReplay.totalCount).toBe(0)
      expect(snapshot.retryRate).toBe(0)
    })

    it('重试率超过 10% 时标记为异常', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordApiCall('test.feature', 100, true)
      }
      // 2 次重试 = 20% 重试率
      metrics.recordRetry()
      metrics.recordRetry()

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.isRetryRateAbnormal).toBe(true)
    })

    it('重试率低于 5% 时不标记为异常', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordApiCall('test.feature', 100, true)
      }
      metrics.recordRetry() // 1% 重试率

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.isRetryRateAbnormal).toBe(false)
    })
  })

  describe('reset', () => {
    it('重置所有指标', () => {
      metrics.recordApiCall('test.feature', 100, true)
      metrics.recordSync(500)
      metrics.recordReplay(true)
      metrics.recordRetry()

      metrics.reset()

      const snapshot = metrics.getMetricsSnapshot()
      expect(snapshot.apiCalls).toEqual({})
      expect(snapshot.slidingSync.count).toBe(0)
      expect(snapshot.offlineReplay.totalCount).toBe(0)
      expect(snapshot.retryRate).toBe(0)
    })
  })
})
