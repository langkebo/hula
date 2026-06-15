import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePerformanceMonitor } from '../usePerformanceMonitor'

describe('usePerformanceMonitor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('API', () => {
    it('should expose monitoring controls', () => {
      const monitor = usePerformanceMonitor({ sampleInterval: 100 })

      expect(monitor.currentFps).toBeDefined()
      expect(monitor.memory).toBeDefined()
      expect(monitor.snapshot).toBeDefined()
      expect(monitor.isMonitoring).toBeDefined()
      expect(typeof monitor.start).toBe('function')
      expect(typeof monitor.stop).toBe('function')
      expect(typeof monitor.mark).toBe('function')
    })

    it('should start and stop monitoring', () => {
      const monitor = usePerformanceMonitor({ sampleInterval: 100 })

      expect(monitor.isMonitoring.value).toBe(false)

      monitor.start()
      expect(monitor.isMonitoring.value).toBe(true)

      monitor.stop()
      expect(monitor.isMonitoring.value).toBe(false)
    })

    it('should report FPS as 0 when idle', () => {
      const monitor = usePerformanceMonitor({ sampleInterval: 100 })

      // Without animation frames, FPS should be 0
      expect(monitor.currentFps.value).toBe(0)
    })
  })

  describe('mark', () => {
    it('should measure render duration', () => {
      const monitor = usePerformanceMonitor({ sampleInterval: 100 })

      const done = monitor.mark('test-component')
      const elapsed = done()

      expect(typeof elapsed).toBe('number')
      expect(elapsed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('memory', () => {
    it('should provide memory info structure', () => {
      const monitor = usePerformanceMonitor({ sampleInterval: 100 })

      const mem = monitor.memory.value
      expect(mem).toHaveProperty('jsHeapSizeLimitMB')
      expect(mem).toHaveProperty('usedJsHeapSizeMB')
      expect(mem).toHaveProperty('totalJsHeapSizeMB')
    })
  })

  describe('snapshot', () => {
    it('should contain fps and memory fields', () => {
      const monitor = usePerformanceMonitor({ sampleInterval: 100 })

      const snap = monitor.snapshot.value
      expect(snap).toHaveProperty('fps')
      expect(snap).toHaveProperty('memoryMB')
      expect(snap).toHaveProperty('jsHeapSizeLimitMB')
      expect(snap).toHaveProperty('usedJsHeapSizeMB')
      expect(snap).toHaveProperty('totalJsHeapSizeMB')
    })
  })
})
