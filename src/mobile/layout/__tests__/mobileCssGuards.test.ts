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
