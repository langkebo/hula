/**
 * 性能分级检测（UI-OPTIMIZATION-PLAN 阶段 2.2）
 *
 * 目的：为液态玻璃（`backdrop-filter`）等重 GPU 特效提供**降级开关**。
 * 检测结果写入 `<html>` 的 `low-perf` 类，由 `_liquid-glass.scss` 的
 * `:global(html.low-perf) &` 分支消费（`backdrop-filter: none` + 纯色回落）。
 *
 * 背景：此前该降级类**没有任何代码写入**，CSS 侧的降级分支是死代码。
 *
 * 覆盖与不覆盖（诚实声明）：
 * - 覆盖：启动时一次性判级并幂等写入 `low-perf` 类
 * - 不覆盖：运行期偏好变化（用户中途切换「减少透明」/ 插拔指针设备）。
 *   如后续需要，应监听对应 media query 变化后重新调用 `applyPerformanceTier`。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('PerformanceTier')

/** 性能分级 */
export type PerformanceTier = 'low' | 'high'

/** 降级类名 —— 必须与 `_liquid-glass.scss` 中的 `html.low-perf` 保持一致 */
export const LOW_PERF_CLASS = 'low-perf'

/** 逻辑核心数低于该值判为低性能 */
export const MIN_CORES_FOR_HIGH = 4

/** 设备内存（GB）低于该值判为低性能 */
export const MIN_DEVICE_MEMORY_GB = 4

/** 判级所依据的原始信号 */
export interface PerformanceSignals {
  /** `navigator.hardwareConcurrency`；环境不支持时为 undefined */
  hardwareConcurrency?: number
  /** `navigator.deviceMemory`（GB，非标准，仅 Chromium 系可用）；不支持时为 undefined */
  deviceMemory?: number
  /** 粗指针（触屏）设备 */
  coarsePointer: boolean
  /** 用户要求减少透明（`prefers-reduced-transparency: reduce`） */
  reducedTransparency: boolean
}

/** 可注入的检测来源，便于测试与在非浏览器环境降级 */
export interface PerformanceScope {
  navigator?: {
    hardwareConcurrency?: number
    deviceMemory?: number
  }
  matchMedia?: (query: string) => { matches: boolean }
}

/**
 * 判定性能分级。
 *
 * 规则（任一命中即 `low`）：
 * 1. 粗指针设备（触屏）—— 移动端 GPU 模糊代价高
 * 2. `prefers-reduced-transparency: reduce` —— 尊重系统无障碍偏好
 * 3. `hardwareConcurrency < 4`
 * 4. `deviceMemory < 4` GB
 *
 * 注意：核心数与内存**不可用时不降级**（Safari/Firefox 无 `deviceMemory`，
 * 缺失不等于低性能），避免把高端设备误判为低性能。
 */
export function resolvePerformanceTier(signals: PerformanceSignals): PerformanceTier {
  if (signals.coarsePointer) return 'low'
  if (signals.reducedTransparency) return 'low'

  if (typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency < MIN_CORES_FOR_HIGH) {
    return 'low'
  }
  if (typeof signals.deviceMemory === 'number' && signals.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return 'low'
  }

  return 'high'
}

/** 安全地查询 media query（环境不支持 matchMedia 时返回 false，不抛错） */
function safeMatchMedia(scope: PerformanceScope, query: string): boolean {
  if (typeof scope.matchMedia !== 'function') return false
  try {
    return scope.matchMedia(query).matches === true
  } catch (error) {
    logger.debug(`matchMedia 查询失败，按 false 处理: ${query}`, error)
    return false
  }
}

/** 采集当前环境的性能信号 */
export function collectPerformanceSignals(
  scope: PerformanceScope = globalThis as PerformanceScope
): PerformanceSignals {
  const nav = scope.navigator
  return {
    hardwareConcurrency: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    deviceMemory: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    coarsePointer: safeMatchMedia(scope, '(pointer: coarse)'),
    reducedTransparency: safeMatchMedia(scope, '(prefers-reduced-transparency: reduce)')
  }
}

/** 采集信号并判级 */
export function detectPerformanceTier(scope?: PerformanceScope): PerformanceTier {
  return resolvePerformanceTier(collectPerformanceSignals(scope))
}

/**
 * 把分级结果写入根元素（幂等）。
 *
 * @param root 目标根元素，默认 `document.documentElement`
 * @param tier 分级结果，默认现场检测
 * @returns 实际生效的分级
 */
export function applyPerformanceTier(
  root: Pick<HTMLElement, 'classList'> | null | undefined = typeof document === 'undefined'
    ? null
    : document.documentElement,
  tier: PerformanceTier = detectPerformanceTier()
): PerformanceTier {
  if (!root?.classList) return tier

  root.classList.toggle(LOW_PERF_CLASS, tier === 'low')

  if (import.meta.env?.DEV) {
    logger.debug(`性能分级: ${tier}（low-perf 类已${tier === 'low' ? '添加' : '移除'}）`)
  }

  return tier
}
