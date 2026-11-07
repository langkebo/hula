/**
 * 性能分级检测（UI-OPTIMIZATION-PLAN 阶段 2.2）
 *
 * 目的：为液态玻璃（`backdrop-filter`）等重 GPU 特效提供**降级开关**。
 * 检测结果写入 `<html>` 的 `low-perf` / `medium-perf` 类，由
 * `_liquid-glass.scss` 与 `mobile.scss` 的 `html.low-perf`、`html.medium-perf`
 * 分支消费（前者 `backdrop-filter: none`，后者 strong 模糊降为 medium）。
 *
 * 三档语义（见 docs/UI优化方案-v2.4.md §9.1）：
 * - `low`：纯色回落，写 `low-perf` 类；
 * - `medium`：触屏 / 中配设备，保留 soft、medium 模糊、禁用 strong，写 `medium-perf` 类；
 * - `high`：全量效果，两个降级类都不写。
 *
 * 背景：此前该降级类**没有任何代码写入**，CSS 侧的降级分支是死代码。
 *
 * 覆盖与不覆盖（诚实声明）：
 * - 覆盖：启动时一次性判级并幂等写入 `low-perf` / `medium-perf` 类
 * - 不覆盖：运行期偏好变化（用户中途切换「减少透明」/ 插拔指针设备）。
 *   如后续需要，应监听对应 media query 变化后重新调用 `applyPerformanceTier`。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('PerformanceTier')

/** 性能分级 */
export type PerformanceTier = 'low' | 'medium' | 'high'

/** 降级类名 —— 必须与 `_liquid-glass.scss` / `mobile.scss` 中的 `html.low-perf` 保持一致 */
export const LOW_PERF_CLASS = 'low-perf'

/** 中档类名 —— 移动端据 `html.medium-perf` 把 strong 模糊降为 medium */
export const MEDIUM_PERF_CLASS = 'medium-perf'

/** 逻辑核心数低于该值判为低性能 */
const MIN_CORES_FOR_LOW = 4

/** 逻辑核心数低于该值判为中等性能（达到该值且内存充足才是 high） */
const MIN_CORES_FOR_HIGH = 8

/** 设备内存（GB）低于该值判为低性能 */
const MIN_DEVICE_MEMORY_GB = 4

/** 判级所依据的原始信号 */
interface PerformanceSignals {
  /** `navigator.hardwareConcurrency`；环境不支持时为 undefined */
  hardwareConcurrency?: number | undefined
  /** `navigator.deviceMemory`（GB，非标准，仅 Chromium 系可用）；不支持时为 undefined */
  deviceMemory?: number | undefined
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
 * 规则（按优先级）：
 * 1. `prefers-reduced-transparency: reduce` → low（系统要求降低透明，等同关闭玻璃）
 * 2. `hardwareConcurrency < 4` → low
 * 3. `deviceMemory < 4` GB → low
 * 4. 粗指针（触屏）设备 → medium —— 移动端 GPU 模糊代价高，但不能判 low：
 *    `mobile.scss` 消费 `html.low-perf`（G1）后，判 low 会让真机永远看不到玻璃
 * 5. `hardwareConcurrency` 4-7 → medium（可用 soft/medium 模糊，禁用 strong）
 * 6. 其余 → high
 *
 * 注意：核心数与内存**不可用时不降级**（Safari/Firefox 无 `deviceMemory`，
 * 缺失不等于低性能），避免把高端设备误判为低性能。
 */
export function resolvePerformanceTier(signals: PerformanceSignals): PerformanceTier {
  if (signals.reducedTransparency) return 'low'

  const cores = signals.hardwareConcurrency
  if (typeof cores === 'number' && cores < MIN_CORES_FOR_LOW) {
    return 'low'
  }
  if (typeof signals.deviceMemory === 'number' && signals.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return 'low'
  }

  if (signals.coarsePointer) return 'medium'
  if (typeof cores === 'number' && cores < MIN_CORES_FOR_HIGH) {
    return 'medium'
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
  root.classList.toggle(MEDIUM_PERF_CLASS, tier === 'medium')

  if (import.meta.env?.DEV) {
    logger.debug(`性能分级: ${tier}（low-perf / medium-perf 类已同步）`)
  }

  return tier
}
