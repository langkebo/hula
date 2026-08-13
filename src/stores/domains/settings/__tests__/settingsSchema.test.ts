import { describe, expect, it, vi } from 'vitest'

import {
  getSettingsTabLabel,
  getSettingsTabs,
  normalizeSettingsTab,
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LABS_CHILD_ROUTE_SEGMENTS,
  SETTINGS_LEGACY_TAB_MAP,
  SETTINGS_TAB_IDS,
  SETTINGS_TABS
} from '../settingsSchema'

describe('settingsSchema · 常量定义', () => {
  it('SETTINGS_TAB_IDS 包含全部预期 tab id', () => {
    expect(SETTINGS_TAB_IDS).toEqual([
      'account',
      'sessions',
      'appearance',
      'notifications',
      'preferences',
      'keyboard',
      'sidebar',
      'voiceVideo',
      'securityPrivacy',
      'encryption',
      'labs',
      'mjolnir',
      'helpAbout',
      'friends',
      'burnAfterRead',
      'aiConnection',
      'storage'
    ])
  })

  it('SETTINGS_TABS 数量与 SETTINGS_TAB_IDS 一致且 id 对齐', () => {
    expect(SETTINGS_TABS).toHaveLength(SETTINGS_TAB_IDS.length)
    expect(SETTINGS_TABS.map((t) => t.id)).toEqual(SETTINGS_TAB_IDS)
  })

  it('SETTINGS_TABS 中 desktopOnly / mobileOnly 标记仅出现在预期 tab', () => {
    const keyboard = SETTINGS_TABS.find((t) => t.id === 'keyboard')
    const sidebar = SETTINGS_TABS.find((t) => t.id === 'sidebar')
    expect(keyboard?.desktopOnly).toBe(true)
    expect(sidebar?.desktopOnly).toBe(true)
    // 其它 tab 不应携带 desktopOnly
    expect(SETTINGS_TABS.filter((t) => t.desktopOnly).map((t) => t.id)).toEqual(['keyboard', 'sidebar'])
  })

  it('SETTINGS_LEGACY_TAB_MAP 将旧 tab 映射到新 tab', () => {
    expect(SETTINGS_LEGACY_TAB_MAP.security).toBe('securityPrivacy')
    expect(SETTINGS_LEGACY_TAB_MAP.help).toBe('helpAbout')
    expect(SETTINGS_LEGACY_TAB_MAP.general).toBe('preferences')
    expect(SETTINGS_LEGACY_TAB_MAP.privacy).toBe('securityPrivacy')
    expect(SETTINGS_LEGACY_TAB_MAP.shortcuts).toBe('keyboard')
    expect(SETTINGS_LEGACY_TAB_MAP.about).toBe('helpAbout')
  })

  it('SETTINGS_CANONICAL_ROUTE_SEGMENTS 包含预期的路由段', () => {
    expect(SETTINGS_CANONICAL_ROUTE_SEGMENTS.notifications).toBe('notifications')
    expect(SETTINGS_CANONICAL_ROUTE_SEGMENTS.labs).toBe('labs')
    expect(SETTINGS_CANONICAL_ROUTE_SEGMENTS.securityPrivacy).toBe('security-privacy')
    expect(SETTINGS_CANONICAL_ROUTE_SEGMENTS.helpAbout).toBe('help-about')
  })

  it('SETTINGS_LABS_CHILD_ROUTE_SEGMENTS 包含 integrations', () => {
    expect(SETTINGS_LABS_CHILD_ROUTE_SEGMENTS.integrations).toBe('integrations')
  })
})

describe('settingsSchema · getSettingsTabLabel', () => {
  it('未提供翻译器时返回 SETTINGS_TABS 中的 fallback label', () => {
    expect(getSettingsTabLabel('account')).toBe('Account')
    expect(getSettingsTabLabel('voiceVideo')).toBe('Voice & Video')
  })

  it('未提供翻译器时未知 tabId 返回 tabId 自身', () => {
    expect(getSettingsTabLabel('unknown' as never)).toBe('unknown')
  })

  it('翻译器返回相同 key 时回退到默认 label', () => {
    const t = vi.fn((key: string) => key)
    expect(getSettingsTabLabel('account', t)).toBe('Account')
    expect(t).toHaveBeenCalledWith('setting.dialog.tabs.account')
  })

  it('翻译器返回翻译文本时使用翻译结果', () => {
    const t = vi.fn((key: string) => (key === 'setting.dialog.tabs.account' ? '账户' : key))
    expect(getSettingsTabLabel('account', t)).toBe('账户')
  })

  it('翻译器对未知 tabId 仍会调用 t（key 为 undefined）并回退到 fallback label', () => {
    const t = vi.fn((key: string) => key)
    // 未知 tabId 时 SETTINGS_TAB_TRANSLATION_KEYS[tabId] 为 undefined，
    // t(undefined) 返回 undefined，与 translationKey(undefined) 不相等 → 回退 fallback
    expect(getSettingsTabLabel('notExist' as never, t)).toBe('notExist')
    expect(t).toHaveBeenCalled()
  })
})

describe('settingsSchema · getSettingsTabs', () => {
  it('未提供翻译器时返回带 fallback label 的列表', () => {
    const tabs = getSettingsTabs()
    expect(tabs).toHaveLength(SETTINGS_TABS.length)
    expect(tabs[0].label).toBe('Account')
    expect(tabs[tabs.length - 1].label).toBe('Storage')
  })

  it('提供翻译器时每个 tab 都使用翻译后的 label', () => {
    const t = vi.fn((key: string) => `T(${key})`)
    const tabs = getSettingsTabs(t)
    expect(tabs).toHaveLength(SETTINGS_TABS.length)
    expect(tabs[0].label).toBe('T(setting.dialog.tabs.account)')
    expect(tabs[2].label).toBe('T(setting.dialog.tabs.appearance)')
    expect(t).toHaveBeenCalledWith('setting.dialog.tabs.account')
    expect(t).toHaveBeenCalledWith('setting.dialog.tabs.appearance')
  })

  it('返回的 tab 保留原有 icon 与 desktopOnly 标记', () => {
    const tabs = getSettingsTabs()
    const keyboard = tabs.find((t) => t.id === 'keyboard')
    expect(keyboard?.icon).toBe('keyboard')
    expect(keyboard?.desktopOnly).toBe(true)
  })
})

describe('settingsSchema · normalizeSettingsTab', () => {
  it('未提供 tab 返回 undefined', () => {
    expect(normalizeSettingsTab(undefined)).toBeUndefined()
  })

  it('旧 security tab 规范化为 securityPrivacy', () => {
    expect(normalizeSettingsTab('security')).toBe('securityPrivacy')
  })

  it('旧 help tab 规范化为 helpAbout', () => {
    expect(normalizeSettingsTab('help')).toBe('helpAbout')
  })

  it('旧 general tab 规范化为 preferences', () => {
    expect(normalizeSettingsTab('general')).toBe('preferences')
  })

  it('旧 privacy tab 规范化为 securityPrivacy', () => {
    expect(normalizeSettingsTab('privacy')).toBe('securityPrivacy')
  })

  it('旧 shortcuts tab 规范化为 keyboard', () => {
    expect(normalizeSettingsTab('shortcuts')).toBe('keyboard')
  })

  it('旧 about tab 规范化为 helpAbout', () => {
    expect(normalizeSettingsTab('about')).toBe('helpAbout')
  })

  it('未知 tab id 返回 undefined（调用方回退到默认 tab）', () => {
    expect(normalizeSettingsTab('nonexistent' as never)).toBeUndefined()
  })

  it('已是新 tab 时原样返回', () => {
    expect(normalizeSettingsTab('account')).toBe('account')
    expect(normalizeSettingsTab('encryption')).toBe('encryption')
    expect(normalizeSettingsTab('aiConnection')).toBe('aiConnection')
  })
})
