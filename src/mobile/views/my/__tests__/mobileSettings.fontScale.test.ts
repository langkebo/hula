import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const source = read('../MobileSettings.vue')
const zh = JSON.parse(read('../../../../../locales/zh-CN/mobile_setting.json'))
const en = JSON.parse(read('../../../../../locales/en/mobile_setting.json'))

describe('移动端字号设置', () => {
  it('复用既有 fontScale 工具', () => {
    expect(source).toContain("from '@/utils/fontScale'")
    expect(source).toContain('FONT_SCALE_STEPS')
    expect(source).toContain('applyFontScale')
    expect(source).toContain('saveFontScale')
    expect(source).toContain('loadFontScale')
  })

  it('提供四档文案', () => {
    for (const locale of [zh, en]) {
      expect(Object.keys(locale.font_sizes).sort()).toEqual(['large', 'normal', 'small', 'xlarge'])
      expect(typeof locale.font_size).toBe('string')
    }
  })
})
