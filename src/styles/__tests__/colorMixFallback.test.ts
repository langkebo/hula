import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const tokensCss = read('../css/design-tokens.css')
const marker = '@supports not (color: color-mix(in srgb, red, blue))'
const fallbackCss = tokensCss.slice(tokensCss.indexOf(marker))

describe('color-mix token 兜底', () => {
  it('每个使用 color-mix 的 token 都有纯色兜底', () => {
    // 多行声明必须跨越换行取值，否则 --tjg-menu-bg 这类 linear-gradient 会被漏掉
    const declarations = Array.from(
      tokensCss.slice(0, tokensCss.indexOf(marker)).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]*)/gi)
    )
    const mixedTokens = [
      ...new Set(declarations.filter((item) => item[2].includes('color-mix(')).map((item) => item[1]))
    ]
    expect(mixedTokens.length).toBeGreaterThan(0)
    expect(mixedTokens).toContain('--tjg-menu-bg')
    expect(tokensCss).toContain(marker)
    expect(fallbackCss).toContain("html[data-theme='dark']")
    for (const token of mixedTokens) {
      expect(fallbackCss).toContain(`${token}:`)
    }
  })

  it('兜底块不引入硬编码颜色', () => {
    expect(fallbackCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(fallbackCss).not.toMatch(/rgba?\(/i)
  })
})

describe('liquid-glass 暗色选择器', () => {
  it('不使用 scoped SFC 中会失效的 :global', () => {
    const mixinSource = read('../scss/mixins/_liquid-glass.scss')
    expect(mixinSource).not.toContain(':global(')
    expect(mixinSource).toContain("html[data-theme='dark'] &")
  })
})
