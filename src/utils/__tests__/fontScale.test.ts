import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyFontScale, FONT_SCALE_STEPS, loadFontScale, normalizeFontScale, saveFontScale } from '../fontScale'

describe('normalizeFontScale', () => {
  it('接受合法步进值', () => {
    for (const s of FONT_SCALE_STEPS) expect(normalizeFontScale(s)).toBe(s)
  })
  it('非法值回落到 1', () => {
    expect(normalizeFontScale('big')).toBe(1)
    expect(normalizeFontScale(null)).toBe(1)
    expect(normalizeFontScale(9)).toBe(1)
  })
})

describe('applyFontScale', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--tjg-font-scale')
  })
  it('写入 CSS 变量', () => {
    applyFontScale(1.25)
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1.25')
  })
  it('非法值按 1 处理', () => {
    applyFontScale(Number.NaN)
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1')
  })
})

describe('load/save', () => {
  beforeEach(() => localStorage.clear())
  it('无存储时为 1', () => expect(loadFontScale()).toBe(1))
  it('往返一致', () => {
    saveFontScale(1.125)
    expect(loadFontScale()).toBe(1.125)
  })
  it('损坏数据回落 1', () => {
    localStorage.setItem('tjg-font-scale', '{broken')
    expect(loadFontScale()).toBe(1)
  })
})

/**
 * 接线守卫：字号 token 必须真的乘上 `--tjg-font-scale`。
 *
 * 原缺陷正是「写得进、没人读」——`tjg-font-size` 写进 localStorage 却没有任何
 * 消费方。jsdom/happy-dom 不解析 `calc()`，所以这里读**磁盘上的样式源文件**做断言，
 * 这是唯一能证明「token 与缩放变量真的连上了」的诚实方式。
 * 同时锁住原始 px，证明 scale=1 时视觉不变（只包一层 calc，不改数值）。
 */
describe('design-tokens 字体缩放接线', () => {
  const tokensCss = readFileSync(resolve(__dirname, '../../..', 'src/styles/css/design-tokens.css'), 'utf8')

  /** 原始 px 值：包 calc 时不得顺手改数值 */
  const FONT_SIZE_TOKENS: Record<string, string> = {
    '--tjg-font-size-xs': '10px',
    '--tjg-font-size-2xs': '11px',
    '--tjg-font-size-sm': '12px',
    '--tjg-font-size-md': '13px',
    '--tjg-font-size-base': '14px',
    '--tjg-font-size-2lg': '15px',
    '--tjg-font-size-lg': '16px',
    '--tjg-font-size-xl': '18px',
    '--tjg-font-size-2xl': '20px',
    '--tjg-font-size-3xl': '24px'
  }

  it('每个 --tjg-font-size-* 都乘上 var(--tjg-font-scale)', () => {
    const declarations = new Map(
      [...tokensCss.matchAll(/(--tjg-font-size-[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()])
    )

    // 解析器自检：解析不到 token 时下面的循环会静默空转，先锁住 token 集合
    expect([...declarations.keys()].sort()).toEqual(Object.keys(FONT_SIZE_TOKENS).sort())

    for (const [name, px] of Object.entries(FONT_SIZE_TOKENS)) {
      expect(declarations.get(name), `${name} 必须引用 --tjg-font-scale`).toBe(`calc(${px} * var(--tjg-font-scale))`)
    }
  })

  it('--tjg-font-scale 在样式表里声明且默认值为 1', () => {
    const declared = tokensCss.match(/--tjg-font-scale\s*:\s*([^;]+);/)
    expect(declared?.[1].trim()).toBe('1')
  })
})

/**
 * 启动接线守卫（源码级）。
 *
 * `App.vue` 的 onMounted 需要挂载整套 Tauri/bootstrap 才能跑起来，为它写组件测试
 * 代价过高；这里退而求其次锁住「启动时读存储并写变量」这一步不被静默删掉——
 * 原缺陷就是这个形状：写入存在、没人应用。
 */
describe('启动接线', () => {
  const appSource = readFileSync(resolve(__dirname, '../../..', 'src/App.vue'), 'utf8')

  it('App.vue 启动路径读存储并应用档位', () => {
    expect(appSource).toMatch(/import\s*\{[^}]*applyFontScale[^}]*\}\s*from\s*'@\/utils\/fontScale'/)
    expect(appSource).toMatch(/applyFontScale\(\s*loadFontScale\(\)\s*\)/)
  })
})
