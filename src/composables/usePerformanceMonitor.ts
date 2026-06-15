/**
 * 运行时性能监控 Composable
 * 提供 FPS 监控、内存使用追踪、渲染计时等运行时指标
 * 与 WebVitalsObserver、PerformanceReporter 配合使用
 */

import { onMounted, onUnmounted, readonly, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePerformanceMonitor')

export interface PerformanceSnapshot {
  fps: number
  memoryMB: number | null
  jsHeapSizeLimitMB: number | null
  usedJsHeapSizeMB: number | null
  totalJsHeapSizeMB: number | null
}

interface PerformanceMemory {
  jsHeapSizeLimit: number
  usedJSHeapSize: number
  totalJSHeapSize: number
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory
}

const getMemoryInfo = (): {
  jsHeapSizeLimitMB: number | null
  usedJsHeapSizeMB: number | null
  totalJsHeapSizeMB: number | null
} => {
  const perf = performance as ExtendedPerformance
  if (!perf.memory) return { jsHeapSizeLimitMB: null, usedJsHeapSizeMB: null, totalJsHeapSizeMB: null }

  return {
    jsHeapSizeLimitMB: +(perf.memory.jsHeapSizeLimit / 1048576).toFixed(2),
    usedJsHeapSizeMB: +(perf.memory.usedJSHeapSize / 1048576).toFixed(2),
    totalJsHeapSizeMB: +(perf.memory.totalJSHeapSize / 1048576).toFixed(2)
  }
}

export function usePerformanceMonitor(options: { sampleInterval?: number; memoryWarnThresholdMB?: number } = {}) {
  const { sampleInterval = 1000, memoryWarnThresholdMB = 400 } = options

  const currentFps = ref(0)
  const memory = ref<{
    jsHeapSizeLimitMB: number | null
    usedJsHeapSizeMB: number | null
    totalJsHeapSizeMB: number | null
  }>(getMemoryInfo())

  const isMonitoring = ref(false)
  const snapshot = ref<PerformanceSnapshot>({
    fps: 0,
    memoryMB: null,
    jsHeapSizeLimitMB: null,
    usedJsHeapSizeMB: null,
    totalJsHeapSizeMB: null
  })

  let rafId: number | null = null
  let fpsTimer: ReturnType<typeof setInterval> | null = null
  let frameCount = 0
  let lastFrameTime = performance.now()

  const tick = () => {
    frameCount++
    rafId = requestAnimationFrame(tick)
  }

  const calculateFps = () => {
    const now = performance.now()
    const elapsed = now - lastFrameTime
    currentFps.value = Math.round((frameCount / elapsed) * 1000)
    frameCount = 0
    lastFrameTime = now

    // 同步采集内存信息
    const mem = getMemoryInfo()
    memory.value = mem

    snapshot.value = {
      fps: currentFps.value,
      memoryMB: mem.usedJsHeapSizeMB,
      jsHeapSizeLimitMB: mem.jsHeapSizeLimitMB,
      usedJsHeapSizeMB: mem.usedJsHeapSizeMB,
      totalJsHeapSizeMB: mem.totalJsHeapSizeMB
    }

    // 内存告警
    if (mem.usedJsHeapSizeMB !== null && mem.usedJsHeapSizeMB > memoryWarnThresholdMB) {
      logger.warn(`[PerformanceMonitor] 内存使用超过 ${memoryWarnThresholdMB}MB: ${mem.usedJsHeapSizeMB}MB`)
    }

    // FPS 告警
    if (currentFps.value < 30 && currentFps.value > 0) {
      logger.warn(`[PerformanceMonitor] FPS 低于 30: ${currentFps.value}`)
    }
  }

  const start = () => {
    if (isMonitoring.value) return

    isMonitoring.value = true
    frameCount = 0
    lastFrameTime = performance.now()
    rafId = requestAnimationFrame(tick)
    fpsTimer = setInterval(calculateFps, sampleInterval)

    logger.info('[PerformanceMonitor] FPS + 内存监控已启动')
  }

  const stop = () => {
    if (!isMonitoring.value) return

    isMonitoring.value = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (fpsTimer !== null) {
      clearInterval(fpsTimer)
      fpsTimer = null
    }

    logger.info('[PerformanceMonitor] FPS + 内存监控已停止')
  }

  /**
   * 测量组件渲染耗时
   * 使用方式：const done = monitor.mark('MyComponent'); ... ; done();
   */
  const mark = (label: string) => {
    const start = performance.now()
    return () => {
      const elapsed = performance.now() - start
      if (elapsed > 16) {
        logger.warn(`[PerformanceMonitor] "${label}" 渲染耗时 ${elapsed.toFixed(2)}ms (超过 16ms 帧预算)`)
      }
      return elapsed
    }
  }

  onMounted(() => {
    start()
  })

  onUnmounted(() => {
    stop()
  })

  return {
    currentFps: readonly(currentFps),
    memory: readonly(memory),
    snapshot: readonly(snapshot),
    isMonitoring: readonly(isMonitoring),
    start,
    stop,
    mark
  }
}
