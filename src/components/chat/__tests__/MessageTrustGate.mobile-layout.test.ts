import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * F-1 信任门禁 · 移动端气泡布局契约
 *
 * 反馈循环策略：happy-dom 无法计算 `filter` / `position: absolute` / `max-width`
 * 的真实排布，所以沿用本仓既有做法（源码文本契约）锁住**决定控件是否可用**的几条属性。
 *
 * 本文件只覆盖「移动端窄气泡下按钮是否会溢出/被裁」这一类问题；
 * 真实像素排布仍需实机确认。
 */

const ROOT = resolve(__dirname, '..', '..', '..', '..')
const gateSource = readFileSync(resolve(ROOT, 'src/components/chat/MessageTrustGate.vue'), 'utf8')
const bubbleSource = readFileSync(resolve(ROOT, 'src/styles/scss/render-message.scss'), 'utf8')

describe('MessageTrustGate · 移动端气泡契约', () => {
  it('模糊层必须禁止命中：否则用户会点到被遮住的链接/菜单', () => {
    expect(gateSource).toMatch(/\.trust-gate__content--blurred\s*\{[\s\S]*?pointer-events:\s*none/)
  })

  it('模糊必须同时禁止选中：模糊态下复制到的是"看不见的内容"，容易误传', () => {
    expect(gateSource).toMatch(/\.trust-gate__content--blurred\s*\{[\s\S]*?user-select:\s*none/)
  })

  // 移动端气泡默认 max-width 32vw，按钮若用固定 padding + nowrap 会横向溢出气泡；
  // 必须能被父宽约束 + 省略号裁切。
  it('「点击显示」按钮必须在窄气泡里能收缩（max-width + ellipsis）', () => {
    const revealBlock = gateSource.match(/\.trust-gate__reveal\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(revealBlock).toContain('max-width: calc(100% - 16px)')
    expect(revealBlock).toContain('text-overflow: ellipsis')
    expect(revealBlock).toContain('overflow: hidden')
  })

  it('按钮必须压在模糊层之上', () => {
    const revealBlock = gateSource.match(/\.trust-gate__reveal\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(revealBlock).toMatch(/z-index:\s*\d+/)
  })

  // 反向守卫：气泡一旦加上 overflow: hidden，绝对定位的按钮会被裁在气泡边缘内，
  // 表现为"按钮只剩半个字"却查不出原因。
  it('气泡 mixin 不得引入 overflow: hidden（会裁掉绝对定位的按钮）', () => {
    const bubbleMixin = bubbleSource.match(/@mixin bubble\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(bubbleMixin).not.toBe('')
    expect(bubbleMixin).not.toMatch(/overflow:\s*hidden/)
  })
})
