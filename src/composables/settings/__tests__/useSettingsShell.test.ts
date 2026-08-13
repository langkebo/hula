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
  'setting.dialog.tabs.burn_after_read': 'Burn After Read',
  'setting.dialog.tabs.ai_connection': 'AI Connection',
  'setting.dialog.tabs.storage': 'Storage'
}

const translate = (key: string) => translationMap[key] ?? key
const keywordMap = {
  account: ['账号', '个人资料', 'profile', 'display-name'],
  sessions: ['设备', 'device', 'session', 'login'],
  appearance: ['主题', 'theme', 'wallpaper', 'timestamp'],
  notifications: ['通知', '提醒', 'push', 'push-rules', 'pusher'],
  preferences: ['偏好', 'media', 'language', 'privacy', 'startup', 'storage', 'scan', 'autostart'],
  keyboard: ['快捷键', 'hotkey', 'keymap'],
  sidebar: ['侧边栏', 'left-panel', 'navigation'],
  voiceVideo: ['语音', '视频', 'audio', 'video', 'webrtc'],
  securityPrivacy: ['安全', '隐私', 'security', 'privacy', 'visibility', 'secret-chat', 'lock', 'hidden'],
  encryption: ['加密', 'secret-storage', 'secure-backup', 'cross-signing'],
  labs: ['实验功能', 'beta', 'integrations', '扩展中心'],
  mjolnir: ['屏蔽', '封禁', 'moderation', 'block'],
  helpAbout: ['帮助', '关于', '更新', '诊断', 'help', 'about'],
  friends: ['好友', 'contacts', 'remark'],
  burnAfterRead: ['阅后即焚', 'ephemeral', 'burn', 'timer'],
  aiConnection: ['AI', '连接', 'MCP', '工具', 'openai', 'assistant'],
  storage: ['存储', '缓存', 'storage', 'cache']
} as const

const resolveSearchKeywords = (tabId: keyof typeof keywordMap) => [...keywordMap[tabId]]

describe('useSettingsShell', () => {
  it('keeps the documented 17 tabs visible on desktop', () => {
    const shell = useSettingsShell({ isDesktop: true })

    expect(shell.visibleTabs.value).toHaveLength(17)
    expect(shell.visibleTabs.value.map((tab) => tab.id)).toContain('keyboard')
    expect(shell.visibleTabs.value.map((tab) => tab.id)).toContain('sidebar')
    expect(shell.visibleTabs.value.find((tab) => tab.id === 'account')?.label).toBe('Account')
  })

  it('hides desktop-only tabs on mobile', () => {
    const shell = useSettingsShell({ isDesktop: false })

    expect(shell.visibleTabs.value.map((tab) => tab.id)).not.toContain('keyboard')
    expect(shell.visibleTabs.value.map((tab) => tab.id)).not.toContain('sidebar')
  })

  it('matches legacy and canonical aliases from the shared search index', () => {
    const shell = useSettingsShell({ isDesktop: true, resolveSearchKeywords })

    shell.setSearchQuery('push')
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['notifications'])

    shell.setSearchQuery('security-privacy')
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['securityPrivacy'])

    shell.setSearchQuery('integrations')
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['labs'])
  })

  it('supports Chinese keywords and reset flow', () => {
    const shell = useSettingsShell({ isDesktop: true, initialQuery: '隐私', resolveSearchKeywords })

    expect(shell.hasSearchQuery.value).toBe(true)
    expect(shell.filteredTabs.value.map((tab) => tab.id)).toEqual(['securityPrivacy'])

    shell.clearSearch()
    expect(shell.hasSearchQuery.value).toBe(false)
    expect(shell.filteredTabs.value).toHaveLength(shell.visibleTabs.value.length)
  })

  it('finds the first matching tab for deep-link style search', () => {
    expect(findFirstMatchingSettingsTab('help-about')).toBe('helpAbout')
    expect(findFirstMatchingSettingsTab('快捷键', false, undefined, resolveSearchKeywords)).toBeUndefined()
  })

  it('uses translated tab labels for visible tabs and search matching', () => {
    const shell = useSettingsShell({ isDesktop: true, translate, resolveSearchKeywords })

    expect(shell.visibleTabs.value.find((tab) => tab.id === 'account')?.label).toBe('Account')
    expect(findFirstMatchingSettingsTab('voicevideo', true, translate, resolveSearchKeywords)).toBe('voiceVideo')
  })
})
