import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeSettingsTab, SETTINGS_TABS, useSettingsTabStore } from '../settingsTab'

describe('settingsTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the desktop settings navigation aligned to the 16 documented tabs', () => {
    expect(SETTINGS_TABS).toHaveLength(16)
    expect(SETTINGS_TABS.map((tab) => tab.id)).not.toContain('push')
    expect(SETTINGS_TABS.map((tab) => tab.id)).not.toContain('integrations')
    expect(SETTINGS_TABS.map((tab) => tab.id)).toContain('securityPrivacy')
    expect(SETTINGS_TABS.map((tab) => tab.id)).toContain('helpAbout')
  })

  it('normalizes the remaining legacy tab ids to the canonical settings tabs', () => {
    expect(normalizeSettingsTab('security')).toBe('securityPrivacy')
    expect(normalizeSettingsTab('help')).toBe('helpAbout')
  })

  it('maps remaining legacy dialog targets without breaking activeTab', () => {
    const store = useSettingsTabStore()

    store.setActiveTab('security')
    expect(store.activeTab).toBe('securityPrivacy')

    store.setActiveTab('help')
    expect(store.activeTab).toBe('helpAbout')
  })
})
