import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { SETTINGS_TABS, normalizeSettingsTab, useSettingsDialogStore } from '../settingsDialog'

describe('settingsDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the desktop settings navigation aligned to the 15 documented tabs', () => {
    expect(SETTINGS_TABS).toHaveLength(15)
    expect(SETTINGS_TABS.map((tab) => tab.id)).not.toContain('push')
    expect(SETTINGS_TABS.map((tab) => tab.id)).not.toContain('integrations')
    expect(SETTINGS_TABS.map((tab) => tab.id)).toContain('securityPrivacy')
    expect(SETTINGS_TABS.map((tab) => tab.id)).toContain('helpAbout')
  })

  it('normalizes legacy tab ids to the canonical settings tabs', () => {
    expect(normalizeSettingsTab('push')).toBe('notifications')
    expect(normalizeSettingsTab('integrations')).toBe('labs')
    expect(normalizeSettingsTab('security')).toBe('securityPrivacy')
    expect(normalizeSettingsTab('help')).toBe('helpAbout')
  })

  it('maps legacy dialog targets without breaking activeTab', () => {
    const store = useSettingsDialogStore()

    store.openDialog('push')
    expect(store.activeTab).toBe('notifications')

    store.setActiveTab('integrations')
    expect(store.activeTab).toBe('labs')
  })
})
