import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

describe('mobile font payload', () => {
  it('uses the system font stack instead of a bundled PingFang', () => {
    const tokens = read('src/styles/css/design-tokens.css')
    expect(tokens).toContain("'PingFang SC'")
    expect(tokens).not.toContain("'PingFang',")
  })

  it('does not reference the bundled PingFang webfont', () => {
    expect(existsSync(resolve(process.cwd(), 'src/styles/scss/global/fonts.scss'))).toBe(false)
    const network = read('src/views/loginWindow/Network.vue')
    expect(network).not.toContain('PingFang-Medium.woff2')
  })

  it('loads the display font only on the login network page', () => {
    const network = read('src/views/loginWindow/Network.vue')
    expect(network).toContain("@font-face {\n  font-family: 'AliFangYuan'")
    expect(network).toContain('AlimamaFangYuanTiVF-Thin.woff2')
  })
})
