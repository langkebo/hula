import { describe, expect, it } from 'vitest'
import { findFirstMatchingSettingsTab, useSettingsShell } from '../useSettingsShell'

describe('useSettingsShell', () => {
  it('keeps the documented 15 tabs visible on desktop', () => {
    const shell = useSettingsShell({ isDesktop: true })

    expect(shell.visibleTabs.value).toHaveLength(15)
    expect(shell.visibleTabs.value.map((tab) => tab.id)).toContain('keyboard')
    expect(shell.visibleTabs.value.map((tab) => tab.id)).toContain('sidebar')
  })

  it('hides desktop-only tabs on mobile', () => {
    const shell = useSettingsShell({ isDesktop: false })

    expect(shell.visibleTabs.value.map((tab) => tab.id)).not.toContain('keyboard')
    expect(shell.visibleTabs.value.map((tab) => tab.id)).not.toContain('sidebar')
  })

  it('matches legacy and canonical aliases from the shared search index', () => {
    const shell = useSettingsShell({ isDesktop: true })

    shell.setSearchQuery('push')
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['notifications'])

    shell.setSearchQuery('security-privacy')
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['securityPrivacy'])

    shell.setSearchQuery('integrations')
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['labs'])
  })

  it('supports Chinese keywords and reset flow', () => {
    const shell = useSettingsShell({ isDesktop: true, initialQuery: '隐私' })

    expect(shell.hasSearchQuery.value).toBe(true)
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['securityPrivacy'])

    shell.clearSearch()
    expect(shell.hasSearchQuery.value).toBe(false)
    expect(shell.filteredTabs.value).toHaveLength(shell.visibleTabs.value.length)
  })

  it('finds the first matching tab for deep-link style search', () => {
    expect(findFirstMatchingSettingsTab('help-about')).toBe('helpAbout')
    expect(findFirstMatchingSettingsTab('快捷键', false)).toBeUndefined()
  })
})
