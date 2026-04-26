import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@tauri-apps/api/app', () => ({
  setTheme: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true,
  isMac: () => false
}))

import { useSettingStore } from '../setting'
import { ShowModeEnum, ThemeEnum } from '@/enums'

describe('SettingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('has default theme', () => {
      const store = useSettingStore()
      expect(store.themes.pattern).toBe(ThemeEnum.OS)
      expect(store.escClose).toBe(true)
    })

    it('has default chat settings', () => {
      const store = useSettingStore()
      expect(store.chat.sendKey).toBe('Enter')
      expect(store.chat.isDouble).toBe(true)
    })

    it('has default shortcuts', () => {
      const store = useSettingStore()
      expect(store.shortcuts.globalEnabled).toBe(false)
    })

    it('has default notification settings', () => {
      const store = useSettingStore()
      expect(store.notification.messageSound).toBe(true)
      expect(store.notification.volume).toBe(80)
    })

    it('has secretChat disabled by default', () => {
      const store = useSettingStore()
      expect(store.secretChat.enabled).toBe(false)
      expect(store.secretChat.passwordHash).toBe('')
      expect(store.secretChat.hideSessions).toBe(false)
      expect(store.secretChat.autoLock).toBe(false)
      expect(store.secretChat.lockTimeout).toBe(5)
    })
  })

  describe('theme actions', () => {
    it('toggleTheme to dark', () => {
      const store = useSettingStore()
      store.toggleTheme(ThemeEnum.DARK)
      expect(store.themes.pattern).toBe(ThemeEnum.DARK)
      expect(store.themes.content).toBe(ThemeEnum.DARK)
    })

    it('toggleTheme to light', () => {
      const store = useSettingStore()
      store.toggleTheme(ThemeEnum.DARK)
      store.toggleTheme(ThemeEnum.LIGHT)
      expect(store.themes.pattern).toBe(ThemeEnum.LIGHT)
      expect(store.themes.content).toBe(ThemeEnum.LIGHT)
    })

    it('toggleTheme to OS normalizes content', () => {
      const store = useSettingStore()
      store.toggleTheme(ThemeEnum.OS)
      expect(store.themes.pattern).toBe(ThemeEnum.OS)
      // content should be resolved from OS (light in test env)
      expect([ThemeEnum.LIGHT, ThemeEnum.DARK]).toContain(store.themes.content)
    })

    it('normalizeThemeState fixes invalid state', () => {
      const store = useSettingStore()
      store.themes.pattern = 'invalid' as never
      store.themes.content = 'invalid' as never
      store.normalizeThemeState()
      expect(store.themes.pattern).toBe(ThemeEnum.LIGHT)
      expect(store.themes.content).toBe(ThemeEnum.LIGHT)
    })
  })

  describe('login actions', () => {
    it('toggleLogin sets both flags', () => {
      const store = useSettingStore()
      store.toggleLogin(true, true)
      expect(store.login.autoLogin).toBe(true)
      expect(store.login.autoStartup).toBe(true)
    })

    it('setAutoLogin sets autoLogin only', () => {
      const store = useSettingStore()
      store.setAutoLogin(true)
      expect(store.login.autoLogin).toBe(true)
    })

    it('closeAutoLogin disables autoLogin', () => {
      const store = useSettingStore()
      store.setAutoLogin(true)
      store.closeAutoLogin()
      expect(store.login.autoLogin).toBe(false)
    })
  })

  describe('shortcut actions', () => {
    it('setScreenshotShortcut updates shortcut', () => {
      const store = useSettingStore()
      store.setScreenshotShortcut('Ctrl+Shift+S')
      expect(store.shortcuts.screenshot).toBe('Ctrl+Shift+S')
    })

    it('setOpenMainPanelShortcut updates shortcut', () => {
      const store = useSettingStore()
      store.setOpenMainPanelShortcut('Ctrl+Shift+P')
      expect(store.shortcuts.openMainPanel).toBe('Ctrl+Shift+P')
    })

    it('setSendMessageShortcut updates chat sendKey', () => {
      const store = useSettingStore()
      store.setSendMessageShortcut('Ctrl+Enter')
      expect(store.chat.sendKey).toBe('Ctrl+Enter')
    })

    it('setGlobalShortcutEnabled toggles global shortcuts', () => {
      const store = useSettingStore()
      store.setGlobalShortcutEnabled(true)
      expect(store.shortcuts.globalEnabled).toBe(true)
    })
  })

  describe('setShowMode', () => {
    it('updates show mode', () => {
      const store = useSettingStore()
      store.setShowMode(ShowModeEnum.TEXT)
      expect(store.showMode).toBe(ShowModeEnum.TEXT)
    })
  })

  describe('screenshot actions', () => {
    it('setScreenshotConceal updates conceal flag', () => {
      const store = useSettingStore()
      store.setScreenshotConceal(true)
      expect(store.screenshot.isConceal).toBe(true)
    })
  })

  describe('notification actions', () => {
    it('setMessageSoundEnabled toggles sound', () => {
      const store = useSettingStore()
      store.setMessageSoundEnabled(false)
      expect(store.notification.messageSound).toBe(false)
    })

    it('setNotificationVolume clamps to 0-100', () => {
      const store = useSettingStore()
      store.setNotificationVolume(150)
      expect(store.notification.volume).toBe(100)
      store.setNotificationVolume(-10)
      expect(store.notification.volume).toBe(0)
      store.setNotificationVolume(50)
      expect(store.notification.volume).toBe(50)
    })
  })

  describe('secret chat', () => {
    it('setSecretChatPassword enables and sets hash', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('mypassword')
      expect(store.secretChat.enabled).toBe(true)
      expect(store.secretChat.passwordHash).toBeTruthy()
    })

    it('verifySecretChatPassword returns true for correct password', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('secret123')
      expect(store.verifySecretChatPassword('secret123')).toBe(true)
    })

    it('verifySecretChatPassword returns false for wrong password', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('secret123')
      expect(store.verifySecretChatPassword('wrong')).toBe(false)
    })

    it('verifySecretChatPassword returns false when not enabled', () => {
      const store = useSettingStore()
      expect(store.verifySecretChatPassword('anything')).toBe(false)
    })

    it('clearSecretChatPassword resets state', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('secret')
      store.setSecretChatHideSessions(true)
      store.setSecretChatAutoLock(true)
      store.setSecretChatLockTimeout(15)
      store.clearSecretChatPassword()
      expect(store.secretChat.enabled).toBe(false)
      expect(store.secretChat.passwordHash).toBe('')
      expect(store.secretChat.hideSessions).toBe(false)
      expect(store.secretChat.autoLock).toBe(false)
      expect(store.secretChat.lockTimeout).toBe(5)
    })

    it('isSecretChatConfigured reflects state', () => {
      const store = useSettingStore()
      expect(store.isSecretChatConfigured()).toBe(false)
      store.setSecretChatPassword('pass')
      expect(store.isSecretChatConfigured()).toBe(true)
    })

    it('updates secret chat privacy settings', () => {
      const store = useSettingStore()
      store.setSecretChatEnabled(true)
      store.setSecretChatHideSessions(true)
      store.setSecretChatAutoLock(true)
      store.setSecretChatLockTimeout(30)
      expect(store.secretChat.enabled).toBe(true)
      expect(store.secretChat.hideSessions).toBe(true)
      expect(store.secretChat.autoLock).toBe(true)
      expect(store.secretChat.lockTimeout).toBe(30)
    })

    it('disabling secret chat clears lock and hide flags', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('pass')
      store.setSecretChatHideSessions(true)
      store.setSecretChatAutoLock(true)
      store.setSecretChatEnabled(false)
      expect(store.secretChat.enabled).toBe(false)
      expect(store.secretChat.hideSessions).toBe(false)
      expect(store.secretChat.autoLock).toBe(false)
    })
  })
})
