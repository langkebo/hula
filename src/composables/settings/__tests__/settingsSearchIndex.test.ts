import { describe, expect, it } from 'vitest'
import { findSettingsSearchResults, matchesSettingsSearch } from '../settingsSearchIndex'

const translationMap: Record<string, string> = {
  'setting.dialog.search_root': '设置',
  'setting.dialog.tabs.appearance': '外观设置',
  'setting.dialog.tabs.help_about': '帮助与关于',
  'setting.appearance.theme_section': '主题',
  'setting.appearance.font_section': '字体设置'
}

const translate = (key: string) => translationMap[key] ?? key

describe('settingsSearchIndex 两级索引', () => {
  it('命中二级锚点时返回完整路径', () => {
    const results = findSettingsSearchResults('主题', translate)

    expect(results).toEqual([
      {
        tabId: 'appearance',
        anchorId: 'appearance-theme',
        path: ['设置', '外观设置', '主题'],
        available: true
      }
    ])
  })

  it('仅命中页签标题时降级为页签级结果', () => {
    const results = findSettingsSearchResults('appearance', translate)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ tabId: 'appearance', path: ['设置', '外观设置'], available: true })
    expect(results[0]?.anchorId).toBeUndefined()
  })

  it('无翻译时使用注册表回退文案，仍可按中文关键词命中锚点', () => {
    const results = findSettingsSearchResults('主题')

    expect(results).toEqual([
      {
        tabId: 'appearance',
        anchorId: 'appearance-theme',
        path: ['Settings', 'Appearance', 'Theme'],
        available: true
      }
    ])
  })

  it('能力不可用时结果标记为不可用', () => {
    const [result] = findSettingsSearchResults('主题', translate, undefined, () => false)

    expect(result?.available).toBe(false)
  })

  it('空查询返回空结果', () => {
    expect(findSettingsSearchResults('   ', translate)).toEqual([])
  })

  it('页签匹配同时覆盖一级标题与二级锚点', () => {
    expect(matchesSettingsSearch('appearance', '字体')).toBe(true)
    expect(matchesSettingsSearch('appearance', '主题')).toBe(true)
    expect(matchesSettingsSearch('account', '不存在的关键词')).toBe(false)
  })
})
