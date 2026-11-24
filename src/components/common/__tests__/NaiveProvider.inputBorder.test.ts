import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * n-input 控件边界守卫。
 *
 * 为什么盯这一段：`--tjg-border-default`（#e3e3e3）白底只有 1.28:1，只能做装饰线。
 * 承担 input 边界的是 `--tjg-border-control`（浅 3.11 / 深 3.68），满足 WCAG 1.4.11。
 * 这条链路只有一个消费点（NaiveProvider 的 Input 覆盖），一旦被改回 naive 默认灰或 `'0'`，
 * 界面上不会报错、单测也不会红 —— 只有对比度悄悄掉回去。所以在这里钉住。
 */
const PROVIDER = resolve(__dirname, '..', 'NaiveProvider.vue')

function inputBlock(): string {
  const source = readFileSync(PROVIDER, 'utf8')
  const raw = source.match(/Input:\s*\{([\s\S]*?)\n {4}\},/)?.[1] ?? ''
  // 必须先剥掉行注释：注释里会写到"原先 borderHover 是 '0'"这类说明，
  // 不剥的话守卫会被自己的注释判红（本仓已有同类前科：style="..." / _matrix）。
  return raw.replace(/^\s*\/\/.*$/gm, '')
}

describe('n-input 控件边界', () => {
  it('能定位到 Input 覆盖块（分母断言，防止正则失配后变成空断言）', () => {
    expect(inputBlock()).toContain('borderRadius')
  })

  it('border 与 borderHover 都用 --tjg-border-control', () => {
    const block = inputBlock()
    expect(block).toMatch(/border:\s*'1px solid var\(--tjg-border-control\)'/)
    expect(block).toMatch(/borderHover:\s*'1px solid var\(--tjg-border-control\)'/)
  })

  it('borderHover 不能退回 0（否则鼠标悬停时边框消失）', () => {
    expect(inputBlock()).not.toMatch(/borderHover:\s*'0'/)
  })

  it('聚焦态用品牌深档 primary-600 而不是把边框压成 0', () => {
    const block = inputBlock()
    expect(block).toMatch(/borderFocus:\s*'1px solid var\(--tjg-color-primary-600\)'/)
    expect(block).not.toMatch(/borderFocus:\s*'0'/)
  })
})
