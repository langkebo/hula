import { onUnmounted } from 'vue'
import { info } from '@tauri-apps/plugin-log'

/**
 * 定时器管理 Composable
 *
 * 自动管理 setTimeout 和 setInterval，在组件卸载时自动清理
 * 防止内存泄漏
 *
 * @example
 * ```typescript
 * const { setTimeout, setInterval, clearTimeout, clearInterval, clearAll } = useTimerManager()
 *
 * // 使用方式与原生 API 相同
 * const timerId = setTimeout(() => {
 *   console.log('延迟执行')
 * }, 1000)
 *
 * const intervalId = setInterval(() => {
 *   console.log('定期执行')
 * }, 1000)
 *
 * // 组件卸载时自动清理所有定时器
 * ```
 */
export function useTimerManager() {
  // 存储所有活跃的定时器 ID
  const timeouts = new Set<number>()
  const intervals = new Set<number>()

  /**
   * 创建延迟定时器
   * @param callback 回调函数
   * @param delay 延迟时间（毫秒）
   * @returns 定时器 ID
   */
  const setTimeout = (callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      callback()
      timeouts.delete(id)
    }, delay)

    timeouts.add(id)
    return id
  }

  /**
   * 创建间隔定时器
   * @param callback 回调函数
   * @param interval 间隔时间（毫秒）
   * @returns 定时器 ID
   */
  const setInterval = (callback: () => void, interval: number): number => {
    const id = window.setInterval(callback, interval)
    intervals.add(id)
    return id
  }

  /**
   * 清除延迟定时器
   * @param id 定时器 ID
   */
  const clearTimeout = (id: number): void => {
    window.clearTimeout(id)
    timeouts.delete(id)
  }

  /**
   * 清除间隔定时器
   * @param id 定时器 ID
   */
  const clearInterval = (id: number): void => {
    window.clearInterval(id)
    intervals.delete(id)
  }

  /**
   * 清除所有定时器
   */
  const clearAll = (): void => {
    timeouts.forEach((id) => {
      window.clearTimeout(id)
    })
    timeouts.clear()

    intervals.forEach((id) => {
      window.clearInterval(id)
    })
    intervals.clear()

    info('[TimerManager] 已清理所有定时器')
  }

  /**
   * 获取活跃定时器数量
   */
  const getActiveCount = (): { timeouts: number; intervals: number } => {
    return {
      timeouts: timeouts.size,
      intervals: intervals.size
    }
  }

  // 组件卸载时自动清理所有定时器
  onUnmounted(() => {
    const count = getActiveCount()
    if (count.timeouts > 0 || count.intervals > 0) {
      info(`[TimerManager] 组件卸载，清理 ${count.timeouts} 个 timeout 和 ${count.intervals} 个 interval`)
      clearAll()
    }
  })

  return {
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    clearAll,
    getActiveCount
  }
}
