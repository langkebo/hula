import { createLogger } from '@/utils/Logger'

const logger = createLogger('startupPerf')

/**
 * 延后到首帧绘制之后执行（P-03）。
 *
 * `onMounted` 紧贴 `app.mount()`，重初始化（离线队列、冷启动会话恢复、WebSocket 事件注册、
 * 好友同步）都是网络/加密重活，直接排队会与首帧绘制抢主线程。双 `requestAnimationFrame`
 * 确保至少已绘制一帧，再用 `requestIdleCallback` 让浏览器挑空闲帧执行；
 * 不支持时退化为 `setTimeout(0)`。
 */
export function runAfterFirstPaint(task: () => Promise<void>): void {
  const schedule = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => void task(), { timeout: 1000 })
    } else {
      setTimeout(() => void task(), 0)
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(schedule))
}

/** 结束一次启动耗时打点（需先 `performance.mark('<name>-start')`），返回毫秒数，仅 DEV 打印。 */
export function endPerfSpan(name: string): number {
  performance.mark(`${name}-end`)
  performance.measure(name, `${name}-start`, `${name}-end`)
  const duration = performance.getEntriesByName(name).at(-1)?.duration ?? 0
  if (import.meta.env.DEV) {
    logger.debug(`Perf measure [${name}]: ${duration.toFixed(2)}ms`)
  }
  return duration
}
