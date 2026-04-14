import type { Metric } from 'web-vitals'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WebVitalsObserver')

type WebVitalMetric =
  | (Metric & { type: 'web-vital' })
  | {
      type: 'longtask'
      name: string
      startTime: number
      duration: number
      attribution?: Record<string, unknown>
    }

type Reporter = (metric: WebVitalMetric) => void

// 扩展 PerformanceObserver 类型以包含 supportedEntryTypes
interface ExtendedPerformanceObserver extends PerformanceObserver {
  supportedEntryTypes?: string[]
}

// 扩展 PerformanceEntry 类型以包含 attribution
interface ExtendedPerformanceEntry extends PerformanceEntry {
  attribution?: Record<string, unknown>
}

const defaultReporter: Reporter = (metric) => {
  const label = metric.type === 'web-vital' ? metric.name : 'longtask'
  logger.info(label, metric)
}

let hasStarted = false

export const startWebVitalObserver = (reporter: Reporter = defaultReporter) => {
  if (hasStarted || typeof window === 'undefined') return
  hasStarted = true

  const report = (metric: Metric) => {
    reporter({
      ...metric,
      type: 'web-vital'
    })
  }

  onCLS(report, { reportAllChanges: true })
  onFCP(report)
  onINP(report, { reportAllChanges: true })
  onLCP(report, { reportAllChanges: true })
  onTTFB(report)

  if (
    'PerformanceObserver' in window &&
    Array.isArray((PerformanceObserver as unknown as ExtendedPerformanceObserver).supportedEntryTypes) &&
    (PerformanceObserver as unknown as ExtendedPerformanceObserver).supportedEntryTypes?.includes('longtask')
  ) {
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const extendedEntry = entry as ExtendedPerformanceEntry
        reporter({
          type: 'longtask',
          name: entry.name || 'longtask',
          startTime: entry.startTime,
          duration: entry.duration,
          attribution: extendedEntry.attribution
        })
      }
    })

    try {
      observer.observe({ type: 'longtask', buffered: true })
    } catch (error) {
      logger.warn('longtask observer failed:', error)
    }
  }
}
