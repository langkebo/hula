import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf-8')
const pathExists = (path: string) => existsSync(resolve(root, path))

describe('mobile font payload', () => {
  it('uses the system font stack instead of a bundled PingFang', () => {
    const tokens = read('src/styles/css/design-tokens.css')
    expect(tokens).toContain("'PingFang SC'")
    expect(tokens).not.toMatch(/'PingFang'\s*,/)
  })

  it('removes the unreferenced PingFang webfont', () => {
    expect(pathExists('src/assets/fonts/PingFang-Medium.woff2')).toBe(false)
    expect(pathExists('src/styles/scss/global/fonts.scss')).toBe(false)
    expect(read('src/views/loginWindow/Network.vue')).not.toContain('PingFang-Medium.woff2')
  })

  it('loads the display font only on the login network page', () => {
    const network = read('src/views/loginWindow/Network.vue')
    expect(pathExists('src/assets/fonts/AlimamaFangYuanTiVF-Thin.woff2')).toBe(true)
    expect(network).toMatch(/@font-face\s*\{[^}]*font-family:\s*'AliFangYuan'/)
    expect(network).toContain("url('@/assets/fonts/AlimamaFangYuanTiVF-Thin.woff2')")
  })

  it('keeps the default page font on a valid family', () => {
    const setting = read('src/stores/domains/settings/setting.ts')
    expect(setting).toContain('PingFang: DEFAULT_PAGE_FONT_FAMILY')
    expect(setting).not.toMatch(/fonts:\s*'PingFang'/)
  })
})

describe('mobile backdrop blur performance fallback', () => {
  /** 移动端所有使用模糊的表面 */
  const blurSurfaces = [
    'src/mobile/layout/tabBar/index.vue',
    'src/mobile/layout/navBar/index.vue',
    'src/mobile/views/message/index.vue',
    'src/mobile/views/friends/index.vue'
  ]

  it('exposes a blur-only fallback mixin driven by html.low-perf', () => {
    const source = read('src/styles/scss/mixins/_liquid-glass.scss')
    const start = source.indexOf('@mixin backdrop-blur-fallback')
    expect(start).toBeGreaterThan(-1)

    // 只取该 mixin 的规则体（到下一个顶格右括号为止）
    const block = source.slice(start, source.indexOf('\n}', start) + 2)
    expect(block).toContain('html.low-perf')
    expect(block).toContain('backdrop-filter: none')
    // 必须是普通嵌套：`:global(html.low-perf) &` 在 Vue scoped 编译后只剩
    // `html.low-perf { ... }`（丢弃 `&`），降级会完全失效
    expect(block).toMatch(/^\s*html\.low-perf\s*&/m)
    expect(block).not.toContain(':global')
    // 只关模糊，不得改写背景色（与 liquid-glass-fallback 的区别）
    expect(block).not.toMatch(/background\s*:/)
  })

  it('applies the fallback in every mobile surface that blurs', () => {
    // 只认真实模糊声明，避免命中 `@include backdrop-blur-fallback` 自身导致空转
    const blurUsage = /backdrop-blur-(?:sm|md)|backdrop-filter\s*:/
    const blurred = blurSurfaces.filter((path) => blurUsage.test(read(path)))
    // 守卫防空转：四个目标文件都应仍然使用模糊
    expect(blurred).toHaveLength(4)

    const missing = blurred.filter((path) => !read(path).includes('@include backdrop-blur-fallback'))
    expect(missing).toEqual([])
  })
})
