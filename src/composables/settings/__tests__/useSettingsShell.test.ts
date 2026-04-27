import { describe, expect, it } from 'vitest'
import { findFirstMatchingSettingsTab, useSettingsShell } from '../useSettingsShell'

const translationMap: Record<string, string> = {
  'setting.dialog.tabs.account': 'Account',
  'setting.dialog.tabs.sessions': 'Session Management',
  'setting.dialog.tabs.appearance': 'Appearance',
  'setting.dialog.tabs.notifications': 'Notifications',
  'setting.dialog.tabs.preferences': 'Preferences',
  'setting.dialog.tabs.keyboard': 'Keyboard',
  'setting.dialog.tabs.sidebar': 'Sidebar',
  'setting.dialog.tabs.voice_video': 'Voice & Video',
  'setting.dialog.tabs.security_privacy': 'Security & Privacy',
  'setting.dialog.tabs.encryption': 'Encryption',
  'setting.dialog.tabs.labs': 'Labs',
  'setting.dialog.tabs.mjolnir': 'Moderation',
  'setting.dialog.tabs.help_about': 'Help & About',
  'setting.dialog.tabs.friends': 'Friends',
  'setting.dialog.tabs.burn_after_read': 'Burn After Read'
}

const translate = (key: string) => translationMap[key] ?? key

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

  it('uses translated tab labels for visible tabs and search matching', () => {
    const shell = useSettingsShell({ isDesktop: true, translate })

    expect(shell.visibleTabs.value.find((tab) => tab.id === 'account')?.label).toBe('Account')
    expect(findFirstMatchingSettingsTab('voicevideo', true, translate)).toBe('voiceVideo')
  })
})
