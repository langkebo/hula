/**
 * Wave 1 视觉一致性收尾方案 - 回归测试
 *
 * 对应 docs/ui/optimization-plan.md Wave 1 的 4 个修复：
 * - 问题 1：会话列表选中项样式冲突
 * - 问题 2：中间栏宽度范围过窄
 * - 问题 3：置顶会话的左边框与圆角冲突
 * - 问题 5：失效的「需求文档 3.1.1」引用
 *
 * 反馈循环策略：bugs 是源码文本问题（CSS 规则冲突、常量值、注释引用），
 * 通过源码文本断言建立 red-capable 循环。jsdom 无法可靠计算 CSS 优先级，
 * 因此不使用 Vue Test Utils 渲染断言，而用源码 grep 断言。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..')
const ROOM_LIST_ITEM_PATH = resolve(ROOT, 'src/components/workbench/TjgRoomListItem.vue')
const CENTER_INDEX_PATH = resolve(ROOT, 'src/layout/center/index.vue')
const DESIGN_TOKENS_PATH = resolve(ROOT, 'src/styles/css/design-tokens.css')

function readSource(p: string): string {
  return readFileSync(p, 'utf-8')
}

describe('Wave 1 - 问题 1：会话列表选中项样式冲突', () => {
  const source = readSource(ROOM_LIST_ITEM_PATH)

  it('不应在 --selected 规则中使用 var(--tjg-color-primary-500) 作为 background（应为渐变层）', () => {
    // 提取所有 .tjg-room-list-item--selected { ... } 块（含嵌套）
    const selectedRulePattern = /\.tjg-room-list-item--selected\s*\{([\s\S]*?)\n\}/g
    const matches: string[] = []
    let m: RegExpExecArray | null
    while ((m = selectedRulePattern.exec(source)) !== null) {
      matches.push(m[1])
    }
    // 每个 --selected 规则块内不应将 --tjg-color-primary-500 用作 background
    const violating = matches.filter((body) => /background\s*:\s*var\(--tjg-color-primary-500\)/.test(body))
    expect(violating).toEqual([])
  })

  it('应只有一个 .tjg-room-list-item--selected 规则块（无重复定义）', () => {
    // 统计顶层 .tjg-room-list-item--selected { 出现次数（不应有第二个覆盖规则）
    const pattern = /\.tjg-room-list-item--selected\s*\{/g
    const count = (source.match(pattern) || []).length
    expect(count).toBe(0) // 0 表示仅通过 &--selected 嵌套定义，无顶层重复
  })

  it('--selected 规则应包含白色文字颜色覆盖（name / preview / time）', () => {
    // 提取首个 --selected 块（嵌套形式 &--selected）
    const nestedSelected = /&--selected\s*\{([^}]*?(?:\{[^}]*\}[^}]*?)*)\}/s
    const match = source.match(nestedSelected)
    expect(match, '应存在 &--selected 嵌套规则').not.toBeNull()
    const block = match![1]
    // name 使用 var(--tjg-text-inverse)（白色），preview/time 使用基于 text-inverse 的 color-mix 降透明度
    expect(block).toMatch(/\.tjg-room-list-item__name\s*\{[^}]*color:\s*var\(--tjg-text-inverse\)/)
    expect(block).toMatch(
      /\.tjg-room-list-item__preview[^{]*\{[^}]*color:\s*color-mix\(in srgb,\s*var\(--tjg-text-inverse\)\s*85%,\s*transparent\)/
    )
    expect(block).toMatch(
      /\.tjg-room-list-item__time\s*\{[^}]*color:\s*color-mix\(in srgb,\s*var\(--tjg-text-inverse\)\s*75%,\s*transparent\)/
    )
  })
})

describe('Wave 1 - 问题 2：中间栏宽度范围过窄', () => {
  const source = readSource(CENTER_INDEX_PATH)

  it('MIN_CENTER_WIDTH 应为 280（非 240）', () => {
    expect(source).toMatch(/const\s+MIN_CENTER_WIDTH\s*=\s*280\b/)
    expect(source).not.toMatch(/const\s+MIN_CENTER_WIDTH\s*=\s*240\b/)
  })

  it('MAX_CENTER_WIDTH 应为 400（非 360）', () => {
    expect(source).toMatch(/const\s+MAX_CENTER_WIDTH\s*=\s*400\b/)
    expect(source).not.toMatch(/const\s+MAX_CENTER_WIDTH\s*=\s*360\b/)
  })

  it('loadStoredWidth 应包含旧值迁移逻辑（< MIN 时重置）', () => {
    // 修复后的 loadStoredWidth 应检测旧值低于新 MIN_CENTER_WIDTH 并清除
    const loadFnMatch = source.match(/function\s+loadStoredWidth\(\)[^{]*\{([\s\S]*?)\n\}/)
    expect(loadFnMatch, '应存在 loadStoredWidth 函数').not.toBeNull()
    const fnBody = loadFnMatch![1]
    // 必须显式检测 num < MIN_CENTER_WIDTH 并调用 removeItem（迁移旧值）
    expect(fnBody).toMatch(/<\s*MIN_CENTER_WIDTH/)
    expect(fnBody).toMatch(/removeItem/)
  })
})

describe('Wave 1 - 问题 3：置顶会话的左边框与圆角冲突', () => {
  const source = readSource(ROOM_LIST_ITEM_PATH)

  it('--top 规则不应使用 border-left: 3px', () => {
    // 提取 &--top { ... } 块（可能含嵌套 ::before）
    const topRuleMatch = source.match(/&--top\s*\{([\s\S]*?)\n\s*\}/)
    expect(topRuleMatch, '应存在 &--top 规则').not.toBeNull()
    const block = topRuleMatch![1]
    expect(block).not.toMatch(/border-left:\s*3px/)
  })

  it('--top 规则应使用 ::before 伪元素作为指示条', () => {
    const topRuleMatch = source.match(/&--top\s*\{([\s\S]*?)\n\s*\}/)
    expect(topRuleMatch, '应存在 &--top 规则').not.toBeNull()
    const block = topRuleMatch![1]
    expect(block).toMatch(/&::before\s*\{/)
    expect(block).toMatch(/width:\s*3px/)
    expect(block).toMatch(/background:\s*var\(--tjg-color-primary-500\)/)
  })
})

describe('Wave 1 - 问题 5：失效的「需求文档 3.1.1」引用', () => {
  const source = readSource(DESIGN_TOKENS_PATH)

  it('design-tokens.css 不应引用失效的「需求文档 3.1.1」', () => {
    expect(source).not.toMatch(/需求文档\s*3\.1\.1/)
  })

  it('三栏亮度渐进注释应指向 CONTEXT.md', () => {
    // 修复后注释应引用 CONTEXT.md 作为权威来源
    expect(source).toMatch(/CONTEXT\.md/)
  })
})
