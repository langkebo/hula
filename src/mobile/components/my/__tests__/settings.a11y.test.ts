import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const settingsSource = read('../Settings.vue')
const tabBarSource = read('../../../layout/tabBar/index.vue')
const zhMy = JSON.parse(read('../../../../../locales/zh-CN/mobile_my.json'))
const enMy = JSON.parse(read('../../../../../locales/en/mobile_my.json'))
const zhTabbar = JSON.parse(read('../../../../../locales/zh-CN/mobile_tabbar.json'))
const enTabbar = JSON.parse(read('../../../../../locales/en/mobile_tabbar.json'))

describe('我的页入口可访问性', () => {
  it('四个图标都有 48px 热区', () => {
    expect(settingsSource.match(/after:-inset-8px/g) ?? []).toHaveLength(4)
  })

  it('四个图标都有 i18n aria-label', () => {
    expect(settingsSource.match(/:aria-label="t\('mobile_my\.actions\./g) ?? []).toHaveLength(4)
  })

  it('语言包包含入口文案', () => {
    for (const locale of [zhMy, enMy]) {
      expect(Object.keys(locale.actions).sort()).toEqual(['messages', 'scan', 'settings', 'share'])
    }
  })
})

describe('TabBar 无障碍文案', () => {
  it('不再硬编码中文', () => {
    expect(tabBarSource).not.toContain('aria-label="移动端主导航"')
    expect(tabBarSource).toContain(':aria-label="t(\'mobile_tabbar.aria_label\')"')
  })

  it('两种语言都提供 aria_label', () => {
    expect(typeof zhTabbar.aria_label).toBe('string')
    expect(typeof enTabbar.aria_label).toBe('string')
  })
})
