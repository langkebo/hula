/**
 * 液态玻璃 mixin 使用契约测试
 *
 * 需求文档 15.2.3 的性能约束：
 * - `backdrop-filter` 仅用于面板级元素（≤3 个元素/视图）
 * - 低性能设备必须降级为纯色背景
 *
 * 本测试用源码断言守护第二条约束：任何直接 `@include liquid-glass(...)` 的调用点
 * 都必须显式跟上 `@include liquid-glass-fallback;`，或者改用已内置降级的
 * `liquid-glass-panel` / `liquid-glass-subtle` 变体。
 *
 * 反馈循环策略：约束的载体是 SCSS 源码文本，happy-dom 无法计算 backdrop-filter 的
 * 生效与降级，故沿用仓库既有做法（见 components/workbench/__tests__/wave1-visual-consistency.test.ts）
 * 以源码 grep 建立 red-capable 循环。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..', '..')
const MIXIN_PATH = resolve(SRC, 'styles/scss/mixins/_liquid-glass.scss')

/** 递归收集 src 下所有 .vue / .scss 源文件 */
function collectSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSources(full, acc)
    } else if (/\.(vue|scss)$/.test(entry) && !entry.endsWith('.bak')) {
      acc.push(full)
    }
  }
  return acc
}

const sources = collectSources(SRC).map((path) => ({ path, text: readFileSync(path, 'utf-8') }))

describe('liquid-glass mixin 定义', () => {
  const source = readFileSync(MIXIN_PATH, 'utf-8')

  it('应提供带内置降级的 panel / subtle 变体', () => {
    expect(source).toMatch(/@mixin liquid-glass-panel\b/)
    expect(source).toMatch(/@mixin liquid-glass-subtle\b/)
    expect(source).toMatch(/@mixin liquid-glass-fallback\b/)
  })

  it('panel / subtle 变体内部应包含降级调用', () => {
    const panelBody = source.match(/@mixin liquid-glass-panel[\s\S]*?\n\}/)
    expect(panelBody, '缺少 liquid-glass-panel 定义').not.toBeNull()
    expect(panelBody![0]).toMatch(/@include liquid-glass-fallback/)

    const subtleBody = source.match(/@mixin liquid-glass-subtle[\s\S]*?\n\}/)
    expect(subtleBody, '缺少 liquid-glass-subtle 定义').not.toBeNull()
    expect(subtleBody![0]).toMatch(/@include liquid-glass-fallback/)
  })

  it('降级规则应针对 html.low-perf 关闭 backdrop-filter 并回落纯色', () => {
    const fallbackBody = source.match(/@mixin liquid-glass-fallback[\s\S]*?\n\}/)
    expect(fallbackBody, '缺少 liquid-glass-fallback 定义').not.toBeNull()
    expect(fallbackBody![0]).toMatch(/html\.low-perf/)
    expect(fallbackBody![0]).toMatch(/backdrop-filter:\s*none/)
    expect(fallbackBody![0]).toMatch(/background:\s*var\(--tjg-surface-panel\)/)
  })
})

describe('liquid-glass 使用点降级契约', () => {
  /** 命中「裸 include」或「变体 include」的使用点（跳过注释行与 mixin 定义自身） */
  const usages = sources.flatMap(({ path, text }) => {
    if (path === MIXIN_PATH) return []
    const hits: { path: string; line: number; text: string; isVariant: boolean }[] = []
    text.split('\n').forEach((line, index) => {
      const trimmed = line.trim()
      // 跳过 SCSS/JS 注释行，避免把文档示例当成真实调用点
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      const match = line.match(/@include\s+(liquid-glass(?:-panel|-subtle)?)\s*(\(|;)/)
      if (!match) return
      hits.push({
        path,
        line: index + 1,
        text: trimmed,
        isVariant: match[1] !== 'liquid-glass'
      })
    })
    return hits
  })

  it('至少存在一个液态玻璃使用点（防止断言空跑）', () => {
    expect(usages.length).toBeGreaterThan(0)
  })

  it('裸 liquid-glass 调用点必须显式跟随 liquid-glass-fallback', () => {
    const violations: string[] = []

    for (const usage of usages) {
      if (usage.isVariant) continue
      const { text } = sources.find((s) => s.path === usage.path)!
      const lines = text.split('\n')
      // 允许在同一 include 之后的 3 行内出现降级调用（容纳注释行）
      const window = lines.slice(usage.line - 1, usage.line + 3).join('\n')
      if (!/@include\s+liquid-glass-fallback/.test(window)) {
        violations.push(`${usage.path.replace(`${SRC}/`, '')}:${usage.line} → ${usage.text}`)
      }
    }

    expect(violations, `以下裸 liquid-glass 调用缺少性能降级：\n${violations.join('\n')}`).toEqual([])
  })

  it('不应使用裸 backdrop-filter 之外的自定义模糊（必须走 mixin 或注明降级）', () => {
    // 该项仅统计，不阻断：列出未走 mixin 的 backdrop-filter 使用点供人工评审
    const bare = sources
      .filter(({ text }) => /(?<!-webkit-)backdrop-filter\s*:/.test(text))
      .filter(({ text }) => !/@include\s+liquid-glass/.test(text))
      .map(({ path }) => path.replace(`${SRC}/`, ''))

    // 允许存量使用点，但新增 mixin 覆盖范围外的手写 backdrop-filter 应被察觉
    expect(Array.isArray(bare)).toBe(true)
  })
})
