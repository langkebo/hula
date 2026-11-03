/**
 * 布局尺寸令牌契约测试（需求 8.2 响应式适配）
 *
 * 守护三件事：
 * - 布局尺寸只允许来自 `design-tokens.css` 的 `--tjg-layout-*`，不得在组件里写死像素
 * - `CENTER_WIDTH_MAP`（TS 侧断点宽度）与 CSS 令牌数值必须一致，避免两套口径漂移
 * - 左侧栏在 macOS 26 与非 macOS 26 下都有对应令牌
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CENTER_WIDTH_MAP } from '../../composables/layout/useResponsiveBreakpoint'

const ROOT = resolve(__dirname, '..', '..', '..')
const tokensCss = readFileSync(resolve(ROOT, 'src/styles/css/design-tokens.css'), 'utf-8')
const centerVue = readFileSync(resolve(ROOT, 'src/layout/center/index.vue'), 'utf-8')
const leftVue = readFileSync(resolve(ROOT, 'src/layout/left/index.vue'), 'utf-8')

/** 读取 `:root` 下的令牌值（布局令牌只定义一次，不随主题变化） */
function readToken(name: string): string | undefined {
  const match = tokensCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return match?.[1]?.trim()
}

describe('布局尺寸令牌', () => {
  it('定义了左侧栏与中间栏的布局令牌', () => {
    expect(readToken('--tjg-layout-left-min')).toBe('64px')
    expect(readToken('--tjg-layout-left-min-mac')).toBe('68px')
    expect(readToken('--tjg-layout-center-wide')).toBe('280px')
    expect(readToken('--tjg-layout-center-normal')).toBe('240px')
    expect(readToken('--tjg-layout-center-shrink')).toBe('64px')
  })

  it('CENTER_WIDTH_MAP 与 CSS 令牌数值一致', () => {
    const expected: Record<keyof typeof CENTER_WIDTH_MAP, string | undefined> = {
      wide: readToken('--tjg-layout-center-wide'),
      normal: readToken('--tjg-layout-center-normal'),
      shrink: readToken('--tjg-layout-center-shrink'),
      single: readToken('--tjg-layout-center-shrink')
    }

    for (const [mode, token] of Object.entries(expected)) {
      expect(CENTER_WIDTH_MAP[mode as keyof typeof CENTER_WIDTH_MAP]).toBe(Number.parseInt(token ?? '', 10))
    }
  })

  it('中间栏与左侧栏改用布局令牌，不再写死像素', () => {
    expect(centerVue).toContain('var(--tjg-layout-center-shrink)')
    expect(centerVue).not.toContain("width: '64px'")
    expect(leftVue).toContain('--tjg-layout-left-min')
    expect(leftVue).toContain('--tjg-layout-left-min-mac')
  })
})
