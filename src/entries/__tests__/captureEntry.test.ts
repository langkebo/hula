/**
 * F2 回归守护：capture 窗口必须走独立轻量入口。
 *
 * capture 只做截图/取词，若复用 index.html + src/main.ts，会静态装配整条 Matrix
 * 模块图（matrixClientService 导入即构造）。这些断言防止后续改动把入口改回去。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '..', '..', '..')
const read = (relative: string) => readFileSync(resolve(repoRoot, relative), 'utf8')

describe('F2 · capture 独立入口', () => {
  it('capture.html 指向轻量入口而不是 src/main.ts', () => {
    const html = read('capture.html')

    expect(html).toContain('/src/entries/capture.ts')
    expect(html).not.toContain('/src/main.ts')
  })

  it('capture 入口只装配 Capture.vue，不引入 Matrix 服务', () => {
    const entry = read('src/entries/capture.ts')

    expect(entry).toContain("from '@/views/Capture.vue'")
    expect(entry).not.toMatch(/from '@\/services\/matrix/)
    expect(entry).not.toContain('matrix-js-sdk')
    expect(entry).not.toContain("from '@/main'")
  })

  it('capture 入口不引入 setting store（其依赖 secretChatCrypto → matrix-js-sdk）', () => {
    const entry = read('src/entries/capture.ts')

    expect(entry).not.toContain("from '@/stores/domains/settings/setting'")
    expect(entry).toContain("from '@/stores/domains/settings/settingThemeActions'")
  })

  it('截图窗口 URL 指向 capture.html', () => {
    const windowRtc = read('src/composables/common/windowRtc.ts')

    expect(windowRtc).toContain("url: '/capture.html'")
  })

  it('桌面构建把 capture.html 注册为独立入口', () => {
    const config = read('build/config/vite.config.desktop.ts')

    expect(config).toContain("capture: entry('capture.html')")
  })
})
