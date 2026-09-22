import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyBubbleStyle, BUBBLE_STYLES, loadBubbleStyle, normalizeBubbleStyle, saveBubbleStyle } from '../bubbleStyle'

describe('normalizeBubbleStyle', () => {
  it('BUBBLE_STYLES 恰为 rounded / square', () => {
    expect([...BUBBLE_STYLES]).toEqual(['rounded', 'square'])
  })
  it('接受两个合法取值', () => {
    for (const style of BUBBLE_STYLES) expect(normalizeBubbleStyle(style)).toBe(style)
  })
  it('旧布尔表示迁移为 rounded / square', () => {
    expect(normalizeBubbleStyle('true')).toBe('rounded')
    expect(normalizeBubbleStyle('false')).toBe('square')
  })
  it('非法值回落到 rounded', () => {
    expect(normalizeBubbleStyle('bubble')).toBe('rounded')
    expect(normalizeBubbleStyle(null)).toBe('rounded')
    expect(normalizeBubbleStyle(undefined)).toBe('rounded')
    expect(normalizeBubbleStyle(9)).toBe('rounded')
  })
})

describe('applyBubbleStyle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-bubble-style')
  })

  it('把档位写到根元素 data-bubble-style 属性', () => {
    applyBubbleStyle('square')
    expect(document.documentElement.getAttribute('data-bubble-style')).toBe('square')

    applyBubbleStyle('rounded')
    expect(document.documentElement.getAttribute('data-bubble-style')).toBe('rounded')
  })

  it('非法值按 rounded 处理', () => {
    applyBubbleStyle('not-a-style')
    expect(document.documentElement.getAttribute('data-bubble-style')).toBe('rounded')
  })

  it('可写入指定的根元素', () => {
    const root = document.createElement('div')
    applyBubbleStyle('square', root)
    expect(root.getAttribute('data-bubble-style')).toBe('square')
  })
})

describe('load/save', () => {
  beforeEach(() => localStorage.clear())

  it('无存储时为 rounded', () => {
    expect(loadBubbleStyle()).toBe('rounded')
  })

  it('往返一致', () => {
    saveBubbleStyle('square')
    expect(loadBubbleStyle()).toBe('square')

    saveBubbleStyle('rounded')
    expect(loadBubbleStyle()).toBe('rounded')
  })

  it('读出旧值并迁移', () => {
    localStorage.setItem('tjg-bubble-style', 'false')
    expect(loadBubbleStyle()).toBe('square')
  })

  it('损坏数据回落 rounded', () => {
    localStorage.setItem('tjg-bubble-style', '{broken')
    expect(loadBubbleStyle()).toBe('rounded')
  })

  it('保存时规范化非法值', () => {
    saveBubbleStyle('whatever')
    expect(localStorage.getItem('tjg-bubble-style')).toBe('rounded')
  })

  it('存储抛错时读写都不崩', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const throwing = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('storage unavailable')
      }
    }

    expect(loadBubbleStyle(throwing)).toBe('rounded')
    expect(() => saveBubbleStyle('square', throwing)).not.toThrow()

    warnSpy.mockRestore()
  })
})

/**
 * 接线守卫：样式工具写的属性必须真的被样式表消费。
 *
 * 原缺陷正是「写得进、没人读」——`tjg-bubble-style` 只被设置 UI 自己读写，
 * 气泡圆角一直由 render-message.scss 固定。jsdom/happy-dom 不解析 UnoCSS，
 * 所以这里读**磁盘上的 scss 源文件**做断言，证明属性与气泡圆角真的连上了。
 *
 * 方形规则必须同时覆盖接收方 `.bubble`、发送方 `.bubble-oneself`，以及通过
 * `@extend .bubble-oneself` 复用发送方外观的 `.photo-wall`；后者自身有
 * `rounded-[12px_4px_12px_12px]` 覆盖，只写 `.bubble` 会漏掉一半气泡。
 */
describe('render-message.scss 气泡圆角接线', () => {
  const scss = readFileSync(resolve(__dirname, '../../..', 'src/styles/scss/render-message.scss'), 'utf8')

  const squareBlock = scss.match(/\[data-bubble-style='square'\][^{]*\{[^}]*\}/)?.[0]
  const squareSelector = squareBlock?.slice(0, squareBlock.indexOf('{')) ?? ''
  const squareBody = squareBlock?.slice(squareBlock.indexOf('{') + 1) ?? ''

  it("存在 [data-bubble-style='square'] 覆盖规则", () => {
    expect(squareBlock, "render-message.scss 必须有 [data-bubble-style='square'] 规则").toBeTruthy()
  })

  it('同时覆盖 .bubble、.bubble-oneself 与 .photo-wall', () => {
    expect(/(?:^|[\s,])\.bubble(?![\w-])/.test(squareSelector), '方形规则必须覆盖 .bubble').toBe(true)
    expect(/(?:^|[\s,])\.bubble-oneself(?![\w-])/.test(squareSelector), '方形规则必须覆盖 .bubble-oneself').toBe(true)
    expect(/(?:^|[\s,])\.photo-wall(?![\w-])/.test(squareSelector), '方形规则必须覆盖 .photo-wall').toBe(true)
  })

  it('用既有 token 覆盖 border-radius，不硬编码圆角', () => {
    expect(squareBody).toMatch(/border-radius\s*:\s*var\(--tjg-radius-xs\)\s*;/)
    expect(squareBody).not.toMatch(/\d+px/)
  })
})

/**
 * 启动接线守卫（源码级）：与 fontScale 同一标准——写入存在但没人应用就是原缺陷。
 */
describe('启动接线', () => {
  const appSource = readFileSync(resolve(__dirname, '../../..', 'src/App.vue'), 'utf8')

  it('App.vue 启动路径读存储并应用气泡样式', () => {
    expect(appSource).toMatch(/import\s*\{[^}]*applyBubbleStyle[^}]*\}\s*from\s*'@\/utils\/bubbleStyle'/)
    expect(appSource).toMatch(/applyBubbleStyle\(\s*loadBubbleStyle\(\)\s*\)/)
  })
})
