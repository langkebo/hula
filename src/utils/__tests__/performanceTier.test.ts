/**
 * performanceTier 单元测试 + 接线契约测试
 *
 * 覆盖：
 * - `resolvePerformanceTier` 四条判级规则及边界（核心数/内存缺失时**不降级**）
 * - `collectPerformanceSignals` 对 navigator / matchMedia 缺失与抛错的容错
 * - `applyPerformanceTier` 对 `<html>` 类的幂等写入与移除
 * - **接线契约**：`main.ts` 必须调用 `applyPerformanceTier`，且 `_liquid-glass.scss`
 *   必须消费 `html.low-perf` —— 防止「降级类无人写入 → 降级分支成为死代码」回归
 *
 * 不覆盖：
 * - 运行期偏好变化（当前实现只做启动期一次性判级）
 * - 真实浏览器的 media query 求值（用注入的 scope 替代）
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyPerformanceTier,
  collectPerformanceSignals,
  detectPerformanceTier,
  LOW_PERF_CLASS,
  type PerformanceScope,
  resolvePerformanceTier
} from '@/utils/performanceTier'

const ROOT = resolve(__dirname, '..', '..', '..')

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

/** 构造干净基线信号：非触屏 / 不减少透明 / 高配 */
function signals(overrides: Partial<Parameters<typeof resolvePerformanceTier>[0]> = {}) {
  return {
    hardwareConcurrency: 8,
    deviceMemory: 8,
    coarsePointer: false,
    reducedTransparency: false,
    ...overrides
  }
}

describe('resolvePerformanceTier', () => {
  it('高配 + 非触屏 + 未减少透明 → high', () => {
    expect(resolvePerformanceTier(signals())).toBe('high')
  })

  it('粗指针（触屏）设备 → low（移动端 GPU 模糊代价高）', () => {
    expect(resolvePerformanceTier(signals({ coarsePointer: true }))).toBe('low')
  })

  it('prefers-reduced-transparency: reduce → low', () => {
    expect(resolvePerformanceTier(signals({ reducedTransparency: true }))).toBe('low')
  })

  it('核心数低于阈值 → low，恰好等于阈值 → high（边界）', () => {
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: 3 }))).toBe('low')
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: 4 }))).toBe('high')
  })

  it('设备内存低于阈值 → low，恰好等于阈值 → high（边界）', () => {
    expect(resolvePerformanceTier(signals({ deviceMemory: 3 }))).toBe('low')
    expect(resolvePerformanceTier(signals({ deviceMemory: 4 }))).toBe('high')
  })

  it('核心数与内存不可用时**不降级**（Safari/Firefox 无 deviceMemory，缺失≠低性能）', () => {
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: undefined, deviceMemory: undefined }))).toBe('high')
  })
})

describe('collectPerformanceSignals', () => {
  it('读取注入 scope 的 navigator 与 media query', () => {
    const scope: PerformanceScope = {
      navigator: { hardwareConcurrency: 2, deviceMemory: 16 },
      matchMedia: (query) => ({ matches: query === '(pointer: coarse)' })
    }

    expect(collectPerformanceSignals(scope)).toEqual({
      hardwareConcurrency: 2,
      deviceMemory: 16,
      coarsePointer: true,
      reducedTransparency: false
    })
  })

  it('matchMedia 不存在时不抛错，两个布尔信号均为 false', () => {
    const result = collectPerformanceSignals({ navigator: { hardwareConcurrency: 8 } })

    expect(result.coarsePointer).toBe(false)
    expect(result.reducedTransparency).toBe(false)
  })

  it('matchMedia 抛错时按 false 处理，不向上冒泡', () => {
    const scope: PerformanceScope = {
      navigator: { hardwareConcurrency: 8 },
      matchMedia: () => {
        throw new Error('matchMedia unsupported')
      }
    }

    expect(() => collectPerformanceSignals(scope)).not.toThrow()
    expect(detectPerformanceTier(scope)).toBe('high')
  })

  it('detectPerformanceTier 端到端：低配触屏 → low', () => {
    const scope: PerformanceScope = {
      navigator: { hardwareConcurrency: 2, deviceMemory: 2 },
      matchMedia: (query) => ({ matches: query === '(pointer: coarse)' })
    }

    expect(detectPerformanceTier(scope)).toBe('low')
  })
})

describe('applyPerformanceTier', () => {
  it('low 时给根元素添加 low-perf，且重复调用幂等（不产生重复类）', () => {
    const root = document.createElement('div')

    expect(applyPerformanceTier(root, 'low')).toBe('low')
    expect(root.classList.contains(LOW_PERF_CLASS)).toBe(true)

    applyPerformanceTier(root, 'low')
    expect(root.className.split(/\s+/).filter((token) => token === LOW_PERF_CLASS)).toHaveLength(1)
  })

  it('high 时移除已存在的 low-perf', () => {
    const root = document.createElement('div')
    root.classList.add(LOW_PERF_CLASS)

    expect(applyPerformanceTier(root, 'high')).toBe('high')
    expect(root.classList.contains(LOW_PERF_CLASS)).toBe(false)
  })

  it('根元素不可用时不抛错，仍返回分级结果', () => {
    expect(applyPerformanceTier(null, 'low')).toBe('low')
    expect(() => applyPerformanceTier(undefined, 'high')).not.toThrow()
  })
})

describe('接线契约（防止「降级类无人写入」回归）', () => {
  it('main.ts 必须在模块体早期调用 applyPerformanceTier', () => {
    const mainSource = readSource('src/main.ts')

    expect(mainSource).toContain("import { applyPerformanceTier } from '@/utils/performanceTier'")
    expect(mainSource).toMatch(/^\s*applyPerformanceTier\(\)/m)
  })

  it('applyPerformanceTier 调用必须早于 createApp（首次绘制前生效）', () => {
    const mainSource = readSource('src/main.ts')
    // 用行首匹配而非 indexOf：注释掉的调用（`// applyPerformanceTier()`）不算接线
    const applyMatch = mainSource.match(/^[ \t]*applyPerformanceTier\(\)/m)
    const applyIndex = applyMatch?.index ?? -1
    const createAppIndex = mainSource.indexOf('createApp(App)')

    expect(applyMatch, 'main.ts 中未找到真实的 applyPerformanceTier() 调用行').not.toBeNull()
    expect(createAppIndex).toBeGreaterThan(-1)
    expect(applyIndex).toBeLessThan(createAppIndex)
  })

  it('_liquid-glass.scss 必须消费 html.low-perf，且类名与常量一致', () => {
    const scssSource = readSource('src/styles/scss/mixins/_liquid-glass.scss')

    expect(scssSource).toContain(`html.${LOW_PERF_CLASS}`)
    // 降级分支必须真的关掉模糊，而不是只留占位注释
    expect(scssSource).toMatch(/html\.low-perf\)\s*&?\s*\{[\s\S]*?backdrop-filter:\s*none/)
  })
})
