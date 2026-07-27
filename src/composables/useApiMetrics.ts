/**
 * API 性能指标监控 Composable (§9.5)
 *
 * 聚合以下维度的运行时指标，供设置页「诊断信息」展示：
 * - API 端到端延迟（平均值 + P95）
 * - Sliding Sync 单次同步耗时
 * - 离线队列回放成功率
 * - 重试触发率（异常时 > 10% 自动告警）
 *
 * 指标数据仅存于内存，不上报服务端（隐私保护）。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('useApiMetrics')

/** 单个功能的 API 调用统计快照 */
interface ApiCallMetrics {
  count: number
  successCount: number
  failureCount: number
  avgLatencyMs: number
  p95LatencyMs: number
}

/** Sliding Sync 统计快照 */
interface SlidingSyncMetrics {
  count: number
  avgDurationMs: number
}

/** 离线队列回放统计快照 */
interface OfflineReplayMetrics {
  totalCount: number
  successCount: number
  successRate: number
}

/** 完整指标快照 */
interface ApiMetricsSnapshot {
  apiCalls: Record<string, ApiCallMetrics>
  slidingSync: SlidingSyncMetrics
  offlineReplay: OfflineReplayMetrics
  retryRate: number
  isRetryRateAbnormal: boolean
}

/** 重试率告警阈值（10%） */
const RETRY_RATE_ABNORMAL_THRESHOLD = 0.1

/**
 * 使用 nearest-rank 方法计算 P95
 * 对于已排序的 n 个值，P95 = sorted[ceil(0.95 * n) - 1] (1-based 索引转 0-based)
 */
function calculateP95(latencies: number[]): number {
  if (latencies.length === 0) return 0
  const sorted = [...latencies].sort((a, b) => a - b)
  const rank = Math.ceil(0.95 * sorted.length)
  const index = Math.max(0, Math.min(sorted.length - 1, rank - 1))
  return sorted[index]
}

interface ApiCallAccumulator {
  count: number
  successCount: number
  failureCount: number
  totalLatencyMs: number
  latencies: number[]
}

export function useApiMetrics() {
  const apiCallMap = new Map<string, ApiCallAccumulator>()
  let syncCount = 0
  let syncTotalDurationMs = 0
  let replayTotalCount = 0
  let replaySuccessCount = 0
  let retryCount = 0
  let totalApiCallCount = 0

  /**
   * 记录一次 API 调用
   * @param feature 功能标识（如 'friend.add'、'room.join'）
   * @param latencyMs 端到端延迟（毫秒）
   * @param success 是否成功
   */
  function recordApiCall(feature: string, latencyMs: number, success: boolean): void {
    let acc = apiCallMap.get(feature)
    if (!acc) {
      acc = {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        latencies: []
      }
      apiCallMap.set(feature, acc)
    }

    acc.count += 1
    acc.totalLatencyMs += latencyMs
    acc.latencies.push(latencyMs)
    if (success) {
      acc.successCount += 1
    } else {
      acc.failureCount += 1
    }

    totalApiCallCount += 1
  }

  /**
   * 记录一次 Sliding Sync 同步耗时
   * @param durationMs 单次同步耗时（毫秒）
   */
  function recordSync(durationMs: number): void {
    syncCount += 1
    syncTotalDurationMs += durationMs
  }

  /**
   * 记录一次离线队列回放结果
   * @param success 是否回放成功
   */
  function recordReplay(success: boolean): void {
    replayTotalCount += 1
    if (success) {
      replaySuccessCount += 1
    }
  }

  /**
   * 记录一次重试触发
   */
  function recordRetry(): void {
    retryCount += 1
  }

  /**
   * 获取当前指标的不可变快照
   */
  function getMetricsSnapshot(): ApiMetricsSnapshot {
    const apiCalls: Record<string, ApiCallMetrics> = {}
    for (const [feature, acc] of apiCallMap) {
      apiCalls[feature] = {
        count: acc.count,
        successCount: acc.successCount,
        failureCount: acc.failureCount,
        avgLatencyMs: acc.count === 0 ? 0 : acc.totalLatencyMs / acc.count,
        p95LatencyMs: calculateP95(acc.latencies)
      }
    }

    const retryRate = totalApiCallCount === 0 ? 0 : retryCount / totalApiCallCount
    const successRate = replayTotalCount === 0 ? 0 : replaySuccessCount / replayTotalCount

    const snapshot: ApiMetricsSnapshot = {
      apiCalls,
      slidingSync: {
        count: syncCount,
        avgDurationMs: syncCount === 0 ? 0 : syncTotalDurationMs / syncCount
      },
      offlineReplay: {
        totalCount: replayTotalCount,
        successCount: replaySuccessCount,
        successRate
      },
      retryRate,
      isRetryRateAbnormal: retryRate > RETRY_RATE_ABNORMAL_THRESHOLD
    }

    if (snapshot.isRetryRateAbnormal) {
      logger.warn(
        `[ApiMetrics] 重试率异常: ${(retryRate * 100).toFixed(1)}% (阈值 ${RETRY_RATE_ABNORMAL_THRESHOLD * 100}%)`
      )
    }

    return snapshot
  }

  /**
   * 重置所有指标（用于登出或诊断重置）
   */
  function reset(): void {
    apiCallMap.clear()
    syncCount = 0
    syncTotalDurationMs = 0
    replayTotalCount = 0
    replaySuccessCount = 0
    retryCount = 0
    totalApiCallCount = 0
  }

  return {
    recordApiCall,
    recordSync,
    recordReplay,
    recordRetry,
    getMetricsSnapshot,
    reset
  }
}
