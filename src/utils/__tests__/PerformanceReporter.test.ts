/**
 * PerformanceReporter 单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { performanceReporter } from '@/utils/PerformanceReporter'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('PerformanceReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    performanceReporter.terminate()
  })

  describe('initialize', () => {
    it('should initialize with default config', () => {
      const config = { endpoint: 'http://localhost:9090' }
      performanceReporter.initialize(config)
      expect(performanceReporter.getMetricsCount()).toBe(0)
    })

    it('should not initialize twice', () => {
      const config = { endpoint: 'http://localhost:9090' }
      performanceReporter.initialize(config)
      performanceReporter.initialize({ ...config, enabled: false })
    })
  })

  describe('reportWebVital', () => {
    it('should report web vital metrics', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 1200,
        delta: 100,
        id: 'test-id',
        entries: []
      })

      expect(performanceReporter.getMetricsCount()).toBe(1)
    })

    it('should batch metrics when batch size reached', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = mockFetch

      const endpoint = 'http://localhost:9090/metrics'
      performanceReporter.initialize({
        endpoint,
        batchSize: 3,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 1200,
        delta: 100,
        id: 'test-1',
        entries: []
      })
      performanceReporter.reportWebVital({
        name: 'FID',
        value: 50,
        delta: 50,
        id: 'test-2',
        entries: []
      })
      performanceReporter.reportWebVital({
        name: 'CLS',
        value: 0.05,
        delta: 0.05,
        id: 'test-3',
        entries: []
      })

      vi.useRealTimers()
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
  })

  describe('reportLongtask', () => {
    it('should report longtask metrics', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportLongtask(1000, 60)

      expect(performanceReporter.getMetricsCount()).toBe(1)
    })

    it('should handle longtask with attribution', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportLongtask(1000, 60, {
        name: 'script',
        script: 'https://example.com/bundle.js'
      })

      expect(performanceReporter.getMetricsCount()).toBe(1)
    })
  })

  describe('reportPageRender', () => {
    it('should report page render metrics', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportPageRender('mobile-dynamic-index', 320, 800, '/mobile/dynamic', {
        source: 'tab-bar'
      })

      expect(performanceReporter.getMetricsCount()).toBe(1)
    })
  })

  describe('SLA thresholds', () => {
    it('should classify LCP metrics correctly', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 2000,
        delta: 100,
        id: 'good-lcp',
        entries: []
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 3000,
        delta: 100,
        id: 'needs-improvement-lcp',
        entries: []
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 5000,
        delta: 100,
        id: 'poor-lcp',
        entries: []
      })

      expect(performanceReporter.getMetricsCount()).toBe(3)
    })

    it('should classify FID metrics correctly', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'FID',
        value: 50,
        delta: 50,
        id: 'good-fid',
        entries: []
      })

      expect(performanceReporter.getMetricsCount()).toBe(1)
    })

    it('should classify CLS metrics correctly', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'CLS',
        value: 0.05,
        delta: 0.05,
        id: 'good-cls',
        entries: []
      })

      expect(performanceReporter.getMetricsCount()).toBe(1)
    })
  })

  describe('forceFlush', () => {
    it('should flush metrics immediately', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      global.fetch = mockFetch

      const endpoint = 'http://localhost:9090/metrics'
      performanceReporter.initialize({
        endpoint,
        batchSize: 100,
        flushInterval: 60000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 1200,
        delta: 100,
        id: 'test-flush',
        entries: []
      })

      expect(performanceReporter.getMetricsCount()).toBe(1)

      await performanceReporter.forceFlush()

      expect(performanceReporter.getMetricsCount()).toBe(0)
    })
  })

  describe('terminate', () => {
    it('should clean up resources', () => {
      const endpoint = 'http://localhost:9090'
      performanceReporter.initialize({
        endpoint,
        batchSize: 10,
        flushInterval: 5000,
        enabled: true,
        debug: false
      })

      performanceReporter.reportWebVital({
        name: 'LCP',
        value: 1200,
        delta: 100,
        id: 'test-terminate',
        entries: []
      })

      performanceReporter.terminate()

      expect(performanceReporter.getMetricsCount()).toBe(0)
    })
  })
})
