import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const source = read('../MobileSettings.vue')
const layoutSource = read('../../../components/MobileLayout.vue')
const sessionListSource = read('../../../components/message/MobileSessionList.vue')
const friendsSource = read('../../../views/friends/index.vue')
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

  it('将字号缩放接入 Vant 字号变量', () => {
    expect(layoutSource).toContain(':theme-vars="fontScaleThemeVars"')
    for (const name of ['fontSizeXs', 'fontSizeSm', 'fontSizeMd', 'fontSizeLg']) {
      expect(layoutSource).toContain(name)
    }
    expect(layoutSource.match(/var\(--tjg-font-size-/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('切换字号后给出反馈文案', () => {
    for (const locale of [zh, en]) {
      expect(typeof locale.font_size_changed).toBe('string')
      expect(locale.font_size_changed.length).toBeGreaterThan(0)
    }
  })

  it('主路径字号使用设计 token', () => {
    const primarySources = {
      'MobileSettings.vue': source,
      'MobileSessionList.vue': sessionListSource,
      'friends/index.vue': friendsSource
    }

    for (const [name, content] of Object.entries(primarySources)) {
      expect(content, `${name} 仍含硬编码字号`).not.toMatch(/\btext-\d+px\b/)
      expect(content, `${name} 未接入字号 token`).toContain('text-[length:var(--tjg-font-size-')
    }
  })
})
