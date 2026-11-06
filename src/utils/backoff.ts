/**
 * 退避与延时工具（M-4）。
 *
 * 同步/重连/重试路径此前各自手写 `Math.min(base * 2 ** attempt, max)` 与
 * `new Promise((resolve) => setTimeout(resolve, ms))`，基数与上限常量散落各处，
 * 容易出现行为漂移。统一收敛到此处。
 */

/** 指数退避参数。 */
interface BackoffOptions {
  /** 首次退避时长（ms）。 */
  baseDelayMs: number
  /** 第几次重试，从 0 开始；负数按 0 处理。 */
  attempt: number
  /** 退避上限（ms），缺省不设上限。 */
  maxDelayMs?: number
}

/**
 * 计算指数退避时长：`baseDelayMs * 2 ** attempt`，并收敛到 `maxDelayMs`。
 *
 * @param options 退避参数
 * @returns 退避时长（ms），恒为非负有限值
 */
export function computeBackoffDelay({ baseDelayMs, attempt, maxDelayMs }: BackoffOptions): number {
  const normalizedAttempt = Math.max(0, Math.floor(attempt))
  const delay = baseDelayMs * 2 ** normalizedAttempt
  return maxDelayMs === undefined ? delay : Math.min(delay, maxDelayMs)
}

/**
 * 等待指定毫秒（负值按 0 处理）。
 *
 * @param ms 等待时长（ms）
 * @returns 到时 resolve 的 Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms))
  })
}
