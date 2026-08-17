import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type NaiveThemeColors,
  naiveDarkColors,
  naiveLightColors,
  parseDesignTokens,
  resolveParsedToken,
  withAlpha
} from '../naiveTokenSource'

/** vitest 会 stub `.css?raw` 导入，同步守护测试改用 node:fs 读取 CSS 原文 */
const designTokensCss = readFileSync(resolve(__dirname, '../css/design-tokens.css'), 'utf-8')
const parsed = parseDesignTokens(designTokensCss)

/** 镜像字段 → design-tokens.css token 名（漂移即失败，改色请改 CSS 后同步镜像） */
const tokenNameOf: Record<keyof NaiveThemeColors, string> = {
  primary500: '--tjg-color-primary-500',
  primary400: '--tjg-color-primary-400',
  primary600: '--tjg-color-primary-600',
  primary200: '--tjg-color-primary-200',
  primary100: '--tjg-color-primary-100',
  danger500: '--tjg-color-danger-500'
}

describe('naiveTokenSource：镜像与 design-tokens.css 同步守护', () => {
  it('亮色镜像逐项与 :root 解析值一致', () => {
    for (const [key, token] of Object.entries(tokenNameOf) as [keyof NaiveThemeColors, string][]) {
      expect(naiveLightColors[key], `${key} ↔ ${token}`).toBe(resolveParsedToken(parsed, token, 'light'))
    }
  })

  it('暗色镜像逐项与暗色块解析值一致（未覆盖项回落 :root）', () => {
    for (const [key, token] of Object.entries(tokenNameOf) as [keyof NaiveThemeColors, string][]) {
      expect(naiveDarkColors[key], `${key} ↔ ${token}`).toBe(resolveParsedToken(parsed, token, 'dark'))
    }
  })

  it('解析器：沿 var() 引用链解引用（primary-500 → --tjg-brand）', () => {
    expect(parsed.light['--tjg-color-primary-500']).toBe('var(--tjg-brand)')
    expect(resolveParsedToken(parsed, '--tjg-color-primary-500', 'light')).toBe('#13987f')
  })

  it('解析器：暗色覆盖优先于 :root', () => {
    expect(resolveParsedToken(parsed, '--tjg-color-primary-100', 'dark')).toBe('rgba(19, 152, 127, 0.15)')
    expect(resolveParsedToken(parsed, '--tjg-color-danger-500', 'dark')).toBe('#ff7875')
  })

  it('解析器：未定义 token 抛错', () => {
    expect(() => resolveParsedToken(parsed, '--tjg-color-not-exist', 'light')).toThrow(/未定义/)
  })

  it('withAlpha 从 #rrggbb 派生 rgba（供 Naive UI secondary 态）', () => {
    expect(withAlpha('#13987f', 0.18)).toBe('rgba(19, 152, 127, 0.18)')
    expect(withAlpha('#13987f', 0.24)).toBe('rgba(19, 152, 127, 0.24)')
  })

  it('withAlpha 拒绝非 #rrggbb 输入', () => {
    expect(() => withAlpha('rgba(0,0,0,1)', 0.5)).toThrow(/#rrggbb/)
  })
})
