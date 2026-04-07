import { onUnmounted } from 'vue'

/**
 * 定时器管理器
 * 自动追踪和清理所有定时器，防止内存泄漏
 */
export class TimerManager {
  private timers: Set<number> = new Set()
  private intervals: Set<number> = new Set()

  /**
   * 创建一个被追踪的 setTimeout
   */
  setTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id)
      callback()
    }, delay)
    this.timers.add(id)
    return id
  }

  /**
   * 创建一个被追踪的 setInterval
   */
  setInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay)
    this.intervals.add(id)
    return id
  }

  /**
   * 清除指定的 timeout
   */
  clearTimeout(id: number): void {
    if (this.timers.has(id)) {
      window.clearTimeout(id)
      this.timers.delete(id)
    }
  }

  /**
   * 清除指定的 interval
   */
  clearInterval(id: number): void {
    if (this.intervals.has(id)) {
      window.clearInterval(id)
      this.intervals.delete(id)
    }
  }

  /**
   * 清除所有定时器
   */
  clearAll(): void {
    this.timers.forEach((id) => window.clearTimeout(id))
    this.intervals.forEach((id) => window.clearInterval(id))
    this.timers.clear()
    this.intervals.clear()
  }

  /**
   * 获取当前活跃的定时器数量
   */
  getActiveCount(): { timeouts: number; intervals: number; total: number } {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      total: this.timers.size + this.intervals.size
    }
  }
}

/**
 * Vue Composable: 在组件中使用 TimerManager
 * 组件卸载时自动清理所有定时器
 */
export function useTimerManager(): TimerManager {
  const manager = new TimerManager()

  onUnmounted(() => {
    manager.clearAll()
  })

  return manager
}
