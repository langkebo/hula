/**
 * Web Vitals 性能监控观察器
 * 集成 PerformanceReporter 实现 Prometheus + Grafana 上报
 */

import type { Metric } from 'web-vitals'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'
import { performanceReporter } from '@/utils/PerformanceReporter'

const logger = createLogger('WebVitalsObserver')
const SDK_REQUEST_STATS_POLL_INTERVAL = 30000

type Reporter = (metric: PerformanceMetric) => void

interface PerformanceMetric {
  type: 'web-vital' | 'longtask'
  name: string
  startTime?: number
  value: number
  delta?: number
  id?: string
  rating?: 'good' | 'needs-improvement' | 'poor'
  entries?: PerformanceEntry[]
  attribution?: Record<string, unknown>
  duration?: number
}

const defaultReporter: Reporter = (metric) => {
  if (metric.type === 'web-vital') {
    logger.info(`[WebVitals] ${metric.name}: ${metric.value?.toFixed(2)}`)
  } else {
    logger.info(`[WebVitals] longtask: ${metric.duration?.toFixed(2)}ms`)
  }
}

let hasStarted = false
let currentReporter: Reporter = defaultReporter
let sdkRequestStatsTimer: ReturnType<typeof setInterval> | null = null
let sdkRequestStatsSnapshots = new Map<string, string>()

const sampleSdkRequestStats = (): void => {
  const managerStats = matrixClientService.getManagerStatsList()
  if (managerStats.length === 0) return

  for (const { name: managerName, stats } of managerStats) {
    if (stats.total === 0 && stats.successful === 0 && stats.failed === 0 && stats.retried === 0) {
      continue
    }

    const snapshotKey = JSON.stringify(stats)
    if (sdkRequestStatsSnapshots.get(managerName) === snapshotKey) {
      continue
    }

    sdkRequestStatsSnapshots.set(managerName, snapshotKey)
    performanceReporter.reportSdkRequestStats(managerName, stats, {
      source: 'matrix-sdk'
    })
  }
}

const startSdkRequestStatsObserver = (): void => {
  if (sdkRequestStatsTimer || typeof window === 'undefined') return

  sampleSdkRequestStats()
  sdkRequestStatsTimer = setInterval(() => {
    sampleSdkRequestStats()
  }, SDK_REQUEST_STATS_POLL_INTERVAL)
}

const stopSdkRequestStatsObserver = (): void => {
  if (sdkRequestStatsTimer) {
    clearInterval(sdkRequestStatsTimer)
    sdkRequestStatsTimer = null
  }
  sdkRequestStatsSnapshots = new Map<string, string>()
}

export const startWebVitalObserver = (
  options: { reporter?: Reporter; prometheusEndpoint?: string; debug?: boolean } = {}
): void => {
  if (hasStarted || typeof window === 'undefined') return
  hasStarted = true

  const { prometheusEndpoint, debug = false } = options

  if (prometheusEndpoint) {
    performanceReporter.initialize({
      endpoint: prometheusEndpoint,
      debug,
      batchSize: 10,
      flushInterval: 5000,
      enabled: true
    })
    currentReporter = (metric) => {
      if (metric.type === 'web-vital' && metric.delta !== undefined && metric.id !== undefined) {
        performanceReporter.reportWebVital({
          name: metric.name,
          value: metric.value,
          delta: metric.delta,
          id: metric.id,
          entries: metric.entries || []
        })
      } else if (metric.type === 'longtask' && metric.startTime !== undefined && metric.duration !== undefined) {
        performanceReporter.reportLongtask(metric.startTime, metric.duration, metric.attribution)
      }
    }
    startSdkRequestStatsObserver()
  } else {
    currentReporter = options.reporter || defaultReporter
  }

  const report = (metric: Metric) => {
    currentReporter({
      type: 'web-vital',
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: (metric as Metric & { rating?: string }).rating as 'good' | 'needs-improvement' | 'poor' | undefined,
      entries: metric.entries
    })
  }

  onCLS(report, { reportAllChanges: true })
  onFCP(report)
  onINP(report, { reportAllChanges: true })
  onLCP(report, { reportAllChanges: true })
  onTTFB(report)

  if (
    'PerformanceObserver' in window &&
    Array.isArray((PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes) &&
    (PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes?.includes('longtask')
  ) {
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const perfEntry = entry as PerformanceEntry & { attribution?: Record<string, unknown> }
        currentReporter({
          type: 'longtask',
          name: 'longtask',
          startTime: entry.startTime,
          value: entry.duration,
          duration: entry.duration,
          attribution: perfEntry.attribution
        })
      }
    })

    try {
      observer.observe({ type: 'longtask', buffered: true })
    } catch (error) {
      logger.warn('longtask observer failed:', error)
    }
  }

  logger.info('[WebVitals] 性能监控已启动')
}

const _stopWebVitalObserver = (): void => {
  hasStarted = false
  stopSdkRequestStatsObserver()
  performanceReporter.terminate()
}
