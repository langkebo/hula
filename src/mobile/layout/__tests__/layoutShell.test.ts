import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8')

describe('mobile tab shell', () => {
  it('底部安全区只由 TabBar 承担', () => {
    expect(read('src/mobile/layout/index.vue')).toContain(':safe-area-bottom="false"')
    const tabBar = read('src/mobile/layout/tabBar/index.vue')
    expect(tabBar).toContain('min-height: 62px')
    expect(tabBar).toMatch(/\.tab-bar\s*\{[^}]*padding-bottom:\s*var\(--safe-area-inset-bottom/)
    expect(tabBar).not.toContain('padding-bottom: var(--safe-area-inset-bottom, 10px)')
  })
})
