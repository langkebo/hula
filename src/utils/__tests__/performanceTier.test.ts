/**
 * performanceTier 单元测试 + 接线契约测试
 *
 * 覆盖：
 * - `resolvePerformanceTier` 三档判级规则及边界（核心数/内存缺失时**不降级**）
 * - `collectPerformanceSignals` 对 navigator / matchMedia 缺失与抛错的容错
 * - `applyPerformanceTier` 对 `<html>` 类的幂等写入与移除
 * - **接线契约**：`main.ts` 必须调用 `applyPerformanceTier`，且 `_liquid-glass.scss`
 *   与 `mobile.scss` 必须消费 `html.low-perf`（低档）/ `html.medium-perf`（中档）——
 *   防止「降级类无人写入 / 移动端不消费」回归
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
  MEDIUM_PERF_CLASS,
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

  it('粗指针（触屏）设备 → medium，不再单独判 low（G2）', () => {
    // 触屏 + 高配：移动端样式消费 html.low-perf（G1）后，判 low 会让真机永远看不到玻璃
    expect(resolvePerformanceTier(signals({ coarsePointer: true }))).toBe('medium')
    expect(resolvePerformanceTier(signals({ coarsePointer: true, hardwareConcurrency: 12 }))).toBe('medium')
  })

  it('prefers-reduced-transparency: reduce → low', () => {
    expect(resolvePerformanceTier(signals({ reducedTransparency: true }))).toBe('low')
  })

  it('核心数 <4 → low，4-7 → medium，≥8 → high（三档边界）', () => {
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: 3 }))).toBe('low')
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: 4 }))).toBe('medium')
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: 7 }))).toBe('medium')
    expect(resolvePerformanceTier(signals({ hardwareConcurrency: 8 }))).toBe('high')
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

  it('detectPerformanceTier 端到端：高配触屏 → medium（真机仍可见玻璃）', () => {
    const scope: PerformanceScope = {
      navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
      matchMedia: (query) => ({ matches: query === '(pointer: coarse)' })
    }

    expect(detectPerformanceTier(scope)).toBe('medium')
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

  it('high 时移除已存在的 low-perf / medium-perf', () => {
    const root = document.createElement('div')
    root.classList.add(LOW_PERF_CLASS, MEDIUM_PERF_CLASS)

    expect(applyPerformanceTier(root, 'high')).toBe('high')
    expect(root.classList.contains(LOW_PERF_CLASS)).toBe(false)
    expect(root.classList.contains(MEDIUM_PERF_CLASS)).toBe(false)
  })

  it('medium 写 medium-perf、不写 low-perf（触屏保留 medium 档模糊）', () => {
    const root = document.createElement('div')
    root.classList.add(LOW_PERF_CLASS)

    expect(applyPerformanceTier(root, 'medium')).toBe('medium')
    expect(root.classList.contains(MEDIUM_PERF_CLASS)).toBe(true)
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
    expect(scssSource).toMatch(/html\.low-perf\)?\s*&?\s*\{[\s\S]*?backdrop-filter:\s*none/)
  })

  it('mobile.scss 的低性能分支必须覆盖所有玻璃面并关闭模糊（G1）', () => {
    const mobileSource = readSource('src/styles/scss/global/mobile.scss')
    const block = mobileSource.match(/html\.low-perf\s*\{[\s\S]*?\n\}/)

    expect(block, 'mobile.scss 缺少 html.low-perf 降级块').not.toBeNull()
    for (const selector of [
      '.tjg-glass',
      '.tjg-glass--nav',
      '.tjg-glass--tabbar',
      '.tjg-glass--sheet',
      '.tjg-glass--input',
      '.bubble',
      '.bubble-oneself'
    ]) {
      expect(block![0]).toContain(selector)
    }
    expect(block![0]).toMatch(/backdrop-filter:\s*none/)
    expect(block![0]).toMatch(/-webkit-backdrop-filter:\s*none/)
  })

  it('mobile.scss 的中档分支必须把 strong 模糊降为 medium（G2）', () => {
    const mobileSource = readSource('src/styles/scss/global/mobile.scss')
    const block = mobileSource.match(/html\.medium-perf\s*\{[\s\S]*?\n\}/)

    expect(block, 'mobile.scss 缺少 html.medium-perf 降级块').not.toBeNull()
    expect(block![0]).toContain('.tjg-glass--tabbar')
    expect(block![0]).toContain('.tjg-glass--sheet')
    expect(block![0]).toContain('var(--tjg-glass-blur-medium)')
    expect(block![0]).not.toContain('var(--tjg-glass-blur-strong)')
  })
})
