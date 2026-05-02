/**
 * Room 列表性能监控工具
 *
 * 追踪 Room 列表相关的性能指标，包括：
 * - 列表渲染时间
 * - 滚动帧率
 * - API 响应时间
 * - 内存使用情况
 */

import { info, warn } from '@tauri-apps/plugin-log'
import { createLogger } from '@/utils/Logger'
import { performanceReporter } from '@/utils/PerformanceReporter'

const logger = createLogger('RoomPerformance')

export interface RoomPerformanceMetrics {
  // 列表渲染
  listRenderTime: number // 列表首次渲染时间 (ms)
  itemRenderTime: number // 单个项渲染时间 (ms)

  // 滚动性能
  scrollFPS: number // 滚动帧率
  scrollJankCount: number // 卡顿次数

  // API 性能
  loadRoomsTime: number // 加载房间列表时间 (ms)
  loadDetailTime: number // 加载房间详情时间 (ms)

  // 内存
  memoryUsage: number // 内存使用 (MB)
  cachedItems: number // 缓存项数量
}

class RoomPerformanceMonitor {
  private static instance: RoomPerformanceMonitor

  private marks = new Map<string, number>()
  private metrics: RoomPerformanceMetrics = {
    listRenderTime: 0,
    itemRenderTime: 0,
    scrollFPS: 0,
    scrollJankCount: 0,
    loadRoomsTime: 0,
    loadDetailTime: 0,
    memoryUsage: 0,
    cachedItems: 0
  }

  private fpsHistory: number[] = []
  private lastFrameTime = 0
  private fpsRafId: number | null = null

  static getInstance(): RoomPerformanceMonitor {
    if (!RoomPerformanceMonitor.instance) {
      RoomPerformanceMonitor.instance = new RoomPerformanceMonitor()
    }
    return RoomPerformanceMonitor.instance
  }

  /**
   * 开始计时
   */
  startMark(name: string): void {
    this.marks.set(name, performance.now())
  }

  /**
   * 结束计时并记录
   */
  endMark(name: string): number {
    const start = this.marks.get(name)
    if (!start) {
      warn(`[RoomPerf] No start mark found: ${name}`)
      return 0
    }

    const duration = performance.now() - start
    this.marks.delete(name)

    // 根据标记名称更新对应指标
    this.recordMetric(name, duration)

    return duration
  }

  /**
   * 记录指标值
   */
  private recordMetric(name: string, value: number): void {
    switch (name) {
      case 'room-list-render':
        this.metrics.listRenderTime = value
        info(`[RoomPerf] 列表渲染: ${value.toFixed(2)}ms`)
        performanceReporter.reportPageRender('room-list', value, 200, 'room-list')
        break
      case 'room-item-render':
        this.metrics.itemRenderTime = value
        break
      case 'load-rooms':
        this.metrics.loadRoomsTime = value
        info(`[RoomPerf] 加载房间: ${value.toFixed(2)}ms`)
        break
      case 'load-room-detail':
        this.metrics.loadDetailTime = value
        break
    }
  }

  /**
   * 开始 FPS 监控
   */
  startFPSMonitor(): void {
    if (this.fpsRafId) return

    const measureFrame = (timestamp: number) => {
      if (this.lastFrameTime) {
        const delta = timestamp - this.lastFrameTime
        const fps = 1000 / delta

        // 只记录合理的 FPS 值
        if (fps >= 0 && fps <= 144) {
          this.fpsHistory.push(fps)

          // 保持历史记录在 60 帧以内
          if (this.fpsHistory.length > 60) {
            this.fpsHistory.shift()
          }

          // 计算卡顿 (FPS < 30)
          if (fps < 30) {
            this.metrics.scrollJankCount++
          }
        }
      }

      this.lastFrameTime = timestamp

      this.fpsRafId = requestAnimationFrame(measureFrame)
    }

    this.fpsRafId = requestAnimationFrame(measureFrame)
  }

  /**
   * 停止 FPS 监控
   */
  stopFPSMonitor(): void {
    if (this.fpsRafId) {
      cancelAnimationFrame(this.fpsRafId)
      this.fpsRafId = null

      // 计算平均 FPS
      if (this.fpsHistory.length > 0) {
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
        this.metrics.scrollFPS = Math.round(avgFPS)
        info(`[RoomPerf] 平均 FPS: ${this.metrics.scrollFPS}`)
      }

      this.fpsHistory = []
    }
  }

  /**
   * 更新缓存项数量
   */
  updateCachedItems(count: number): void {
    this.metrics.cachedItems = count
  }

  /**
   * 尝试获取内存使用情况
   */
  updateMemoryUsage(): void {
    const memory = performance.memory
    if (memory) {
      this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024)
    }
  }

  /**
   * 获取当前指标
   */
  getMetrics(): RoomPerformanceMetrics {
    this.updateMemoryUsage()
    return { ...this.metrics }
  }

  /**
   * 打印性能报告
   */
  report(): void {
    this.updateMemoryUsage()

    const report = `
┌─────────────────────────────────────┐
│       Room 列表性能报告             │
├─────────────────────────────────────┤
│ 列表渲染:      ${this.metrics.listRenderTime.toFixed(2).padStart(8)} ms     │
│ 单项渲染:      ${this.metrics.itemRenderTime.toFixed(2).padStart(8)} ms     │
│ 滚动 FPS:      ${this.metrics.scrollFPS.toString().padStart(8)}           │
│ 卡顿次数:      ${this.metrics.scrollJankCount.toString().padStart(8)}           │
│ 加载房间:      ${this.metrics.loadRoomsTime.toFixed(2).padStart(8)} ms     │
│ 加载详情:      ${this.metrics.loadDetailTime.toFixed(2).padStart(8)} ms     │
│ 内存使用:      ${this.metrics.memoryUsage.toString().padStart(8)} MB     │
│ 缓存项数:      ${this.metrics.cachedItems.toString().padStart(8)}           │
└─────────────────────────────────────┘
`
    logger.info(report)
    info('[RoomPerf] ' + report.replace(/\n/g, ' | '))
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = {
      listRenderTime: 0,
      itemRenderTime: 0,
      scrollFPS: 0,
      scrollJankCount: 0,
      loadRoomsTime: 0,
      loadDetailTime: 0,
      memoryUsage: 0,
      cachedItems: 0
    }
    this.marks.clear()
    this.fpsHistory = []
  }
}

// 导出单例
export const roomPerformanceMonitor = RoomPerformanceMonitor.getInstance()

// 便捷函数
export const startRoomPerfMark = (name: string) => roomPerformanceMonitor.startMark(name)
export const endRoomPerfMark = (name: string) => roomPerformanceMonitor.endMark(name)
export const getRoomPerfMetrics = () => roomPerformanceMonitor.getMetrics()
export const reportRoomPerf = () => roomPerformanceMonitor.report()
