/**
 * 性能指标上报服务
 * 支持 Prometheus + Grafana 看板
 * 严格对齐文档 SLA 告警阈值
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('PerformanceReporter')

export type MetricName = 'CLS' | 'FID' | 'INP' | 'LCP' | 'TTFB' | 'FCP' | 'longtask'

export interface LongtaskMetric {
  type: 'longtask'
  name: 'longtask'
  startTime: number
  duration: number
  attribution?: Record<string, unknown>
}

export interface WebVitalMetric {
  type: 'web-vital'
  name: MetricName
  value: number
  delta: number
  id: string
  rating: 'good' | 'needs-improvement' | 'poor'
  entries: PerformanceEntry[]
}

export interface PageRenderMetric {
  type: 'page-render'
  name: 'page-render'
  page: string
  route: string
  value: number
  threshold: number
  rating: MetricRating
  meta?: Record<string, string>
}

export type PerformanceMetric = LongtaskMetric | WebVitalMetric | PageRenderMetric

export interface ReporterConfig {
  endpoint: string
  batchSize?: number
  flushInterval?: number
  enabled?: boolean
  debug?: boolean
}

const DEFAULT_CONFIG: Required<Omit<ReporterConfig, 'endpoint'>> = {
  batchSize: 10,
  flushInterval: 5000,
  enabled: true,
  debug: false
}

const SLA_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  FCP: { good: 1800, poor: 3000 }
}

type MetricRating = 'good' | 'needs-improvement' | 'poor'

class PerformanceReporter {
  private config: Required<ReporterConfig> = { ...DEFAULT_CONFIG, endpoint: '' }
  private metrics: PerformanceMetric[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isProcessing = false
  private failedAttempts = 0
  private readonly MAX_RETRIES = 3
  private visibilityHandler: (() => void) | null = null

  initialize(config: ReporterConfig): void {
    this.config = { ...DEFAULT_CONFIG, ...config }

    if (!this.config.endpoint) {
      this.config.enabled = false
      logger.warn('[PerformanceReporter] 缺少 endpoint，性能上报已自动禁用')
    }

    if (!this.config.enabled) {
      logger.info('[PerformanceReporter] 性能上报已禁用')
      return
    }

    this.setupVisibilityFlush()
    this.startFlushTimer()
    logger.info('[PerformanceReporter] 性能监控已初始化', {
      endpoint: this.config.endpoint,
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval
    })
  }

  async report(metric: PerformanceMetric): Promise<void> {
    if (!this.config.enabled) return

    this.metrics.push(metric)

    if (this.config.debug) {
      this.logMetric(metric)
    }

    this.checkThreshold(metric)

    if (this.metrics.length >= this.config.batchSize) {
      await this.flush()
    }
  }

  reportWebVital(metric: {
    name: string
    value: number
    delta: number
    id: string
    entries: PerformanceEntry[]
  }): void {
    const rating = this.getRating(metric.name, metric.value)
    this.report({
      type: 'web-vital',
      name: metric.name as MetricName,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating,
      entries: metric.entries
    })
  }

  reportLongtask(startTime: number, duration: number, attribution?: Record<string, unknown>): void {
    this.report({
      type: 'longtask',
      name: 'longtask',
      startTime,
      duration,
      attribution
    })
  }

  reportPageRender(
    page: string,
    value: number,
    threshold = 800,
    route = 'unknown',
    meta?: Record<string, string>
  ): void {
    const rating = this.getPageRenderRating(value, threshold)
    this.report({
      type: 'page-render',
      name: 'page-render',
      page,
      route,
      value,
      threshold,
      rating,
      meta
    })
  }

  private getRating(name: string, value: number): MetricRating {
    const threshold = SLA_THRESHOLDS[name]
    if (!threshold) return 'needs-improvement'

    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  private getPageRenderRating(value: number, threshold: number): MetricRating {
    if (value <= threshold) return 'good'
    if (value <= threshold * 1.5) return 'needs-improvement'
    return 'poor'
  }

  private checkThreshold(metric: PerformanceMetric): void {
    if (metric.type === 'longtask') {
      if (metric.duration > 50) {
        logger.warn('[PerformanceReporter] longtask 超过 50ms 阈值', {
          duration: metric.duration
        })
      }
      return
    }

    if (metric.type === 'page-render') {
      if (metric.rating === 'poor') {
        logger.error(`[PerformanceReporter] ${metric.page} 页面渲染超出阈值: ${metric.value}`, {
          rating: metric.rating,
          route: metric.route,
          threshold: metric.threshold
        })
      } else if (metric.rating === 'needs-improvement') {
        logger.warn(`[PerformanceReporter] ${metric.page} 页面渲染接近阈值: ${metric.value}`, {
          rating: metric.rating,
          route: metric.route,
          threshold: metric.threshold
        })
      }
      return
    }

    const rating = this.getRating(metric.name, metric.value)

    if (rating === 'poor') {
      logger.error(`[PerformanceReporter] ${metric.name} 指标评级为 poor: ${metric.value}`, {
        rating,
        value: metric.value,
        delta: metric.delta,
        id: metric.id
      })
    } else if (rating === 'needs-improvement') {
      logger.warn(`[PerformanceReporter] ${metric.name} 指标需要改进: ${metric.value}`, {
        rating,
        value: metric.value
      })
    }
  }

  private logMetric(metric: PerformanceMetric): void {
    if (metric.type === 'longtask') {
      logger.info(`[PerformanceReporter] longtask: ${metric.duration.toFixed(2)}ms`)
    } else if (metric.type === 'page-render') {
      logger.info(`[PerformanceReporter] ${metric.page} render: ${metric.value.toFixed(2)}ms (${metric.rating})`)
    } else {
      logger.info(`[PerformanceReporter] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`)
    }
  }

  private async flush(): Promise<void> {
    if (this.isProcessing || this.metrics.length === 0) return

    this.isProcessing = true

    try {
      const metricsToSend = [...this.metrics]
      this.metrics = []

      const payload = this.buildPrometheusPayload(metricsToSend)
      await this.sendPayload(payload)

      this.failedAttempts = 0
      logger.debug(`[PerformanceReporter] 已上报 ${metricsToSend.length} 条指标`)
    } catch {
      this.failedAttempts++

      if (this.failedAttempts < this.MAX_RETRIES) {
        logger.warn(`[PerformanceReporter] 上报失败，指标已缓存（${this.failedAttempts}/${this.MAX_RETRIES}）`)
      } else {
        logger.error('[PerformanceReporter] 上报失败，已达到最大重试次数，丢弃指标')
        this.metrics = []
        this.failedAttempts = 0
      }
    } finally {
      this.isProcessing = false
    }
  }

  private buildPrometheusPayload(metrics: PerformanceMetric[]): string {
    const lines: string[] = []
    const timestamp = Date.now() * 1000000

    for (const metric of metrics) {
      const labels = this.buildLabels(metric)
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')

      if (metric.type === 'longtask') {
        lines.push(
          `hula_longtask_duration_seconds${labelStr ? `{${labelStr}}` : ''} ${metric.duration / 1000} ${timestamp}`
        )
      } else if (metric.type === 'page-render') {
        lines.push(
          `hula_page_render_duration_seconds${labelStr ? `{${labelStr}}` : ''} ${metric.value / 1000} ${timestamp}`
        )
      } else {
        lines.push(
          `hula_webvital_${metric.name.toLowerCase()}_seconds${labelStr ? `{${labelStr}}` : ''} ${metric.value / 1000} ${timestamp}`
        )
      }
    }

    return lines.join('\n')
  }

  private buildLabels(metric: PerformanceMetric): Record<string, string> {
    const labels: Record<string, string> = {
      app: 'hula',
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
    }

    if (metric.type === 'web-vital') {
      labels.rating = metric.rating
    } else if (metric.type === 'page-render') {
      labels.page = metric.page
      labels.route = metric.route
      labels.rating = metric.rating
      labels.threshold_ms = String(metric.threshold)

      if (metric.meta) {
        Object.assign(labels, metric.meta)
      }
    }

    return labels
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      void this.flush()
    }, this.config.flushInterval)
  }

  private setupVisibilityFlush(): void {
    if (typeof document === 'undefined' || this.visibilityHandler) return

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        void this.forceFlush()
      }
    }

    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  private async sendPayload(payload: string): Promise<void> {
    const canUseBeacon =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      typeof Blob !== 'undefined' &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'

    if (canUseBeacon) {
      const blob = new Blob([payload], { type: 'text/plain' })
      const sent = navigator.sendBeacon(this.config.endpoint, blob)
      if (sent) {
        return
      }
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: payload,
      keepalive: true
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }

  async forceFlush(): Promise<void> {
    await this.flush()
  }

  terminate(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
    void this.forceFlush()
  }

  getMetricsCount(): number {
    return this.metrics.length
  }
}

export const performanceReporter = new PerformanceReporter()
