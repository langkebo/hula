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
    localStorage.clear()
  })

  describe('initial state', () => {
    it('has default theme', () => {
      const store = useSettingStore()
      expect(store.themePattern).toBe(ThemeEnum.OS)
      expect(store.escClose).toBe(true)
    })

    it('has default chat settings', () => {
      const store = useSettingStore()
      expect(store.sendMessageShortcut).toBe('Enter')
      expect(store.messageDoubleClickEnabled).toBe(true)
    })

    it('has default shortcuts', () => {
      const store = useSettingStore()
      expect(store.globalShortcutEnabled).toBe(false)
    })

    it('has default notification settings', () => {
      const store = useSettingStore()
      expect(store.messageSoundEnabled).toBe(true)
      expect(store.notificationVolume).toBe(80)
    })

    it('has default preference settings', () => {
      const store = useSettingStore()
      expect(store.messageConfirmEnabled).toBe(false)
      expect(store.linkPreviewEnabled).toBe(true)
      expect(store.emojiConvertEnabled).toBe(true)
      expect(store.emojiSize).toBe('medium')
      expect(store.burnDefaultEnabled).toBe(false)
      expect(store.burnDefaultDuration).toBe(60)
      expect(store.burnShowCountdownEnabled).toBe(true)
      expect(store.threadAutoSubscribeEnabled).toBe(true)
      expect(store.threadShowInRoomEnabled).toBe(true)
      expect(store.spaceAutoJoinRoomsEnabled).toBe(false)
      expect(store.spaceShowSubspacesEnabled).toBe(true)
      expect(store.sendReadReceiptsEnabled).toBe(true)
      expect(store.sendTypingNotificationsEnabled).toBe(true)
    })

    it('has normalized page and login getters', () => {
      const store = useSettingStore()
      expect(store.languagePreference).toBe('AUTO')
      expect(store.pageFontFamily).toBe('PingFang')
      expect(store.pageShadowEnabled).toBe(true)
      expect(store.pageBlurEnabled).toBe(true)
      expect(store.autoLoginEnabled).toBe(false)
      expect(store.autoStartupEnabled).toBe(false)
    })

    it('has secretChat disabled by default', () => {
      const store = useSettingStore()
      expect(store.secretChatEnabled).toBe(false)
      expect(store.secretChatHideSessions).toBe(false)
      expect(store.secretChatAutoLock).toBe(false)
      expect(store.secretChatLockTimeout).toBe(5)
      expect(store.isSecretChatConfigured()).toBe(false)
    })
  })

  describe('theme actions', () => {
    it('toggleTheme to dark', () => {
      const store = useSettingStore()
      store.toggleTheme(ThemeEnum.DARK)
      expect(store.themePattern).toBe(ThemeEnum.DARK)
      expect(store.themeContent).toBe(ThemeEnum.DARK)
    })

    it('toggleTheme to light', () => {
      const store = useSettingStore()
      store.toggleTheme(ThemeEnum.DARK)
      store.toggleTheme(ThemeEnum.LIGHT)
      expect(store.themePattern).toBe(ThemeEnum.LIGHT)
      expect(store.themeContent).toBe(ThemeEnum.LIGHT)
    })

    it('toggleTheme to OS normalizes content', () => {
      const store = useSettingStore()
      store.toggleTheme(ThemeEnum.OS)
      expect(store.themePattern).toBe(ThemeEnum.OS)
      // content should be resolved from OS (light in test env)
      expect([ThemeEnum.LIGHT, ThemeEnum.DARK]).toContain(store.themeContent)
    })

    it('normalizeThemeState fixes invalid state', () => {
      const store = useSettingStore()
      store.themes.pattern = 'invalid' as never
      store.themes.content = 'invalid' as never
      store.normalizeThemeState()
      expect(store.themes.pattern).toBe(ThemeEnum.LIGHT)
      expect(store.themes.content).toBe(ThemeEnum.LIGHT)
    })

    it('normalizeThemeState strips legacy versatile theme state', () => {
      const store = useSettingStore()
      ;(store.themes as typeof store.themes & { versatile?: string }).versatile = 'default'
      store.normalizeThemeState()
      expect('versatile' in (store.themes as typeof store.themes & { versatile?: string })).toBe(false)
    })

    it('ensureThemeReady initializes theme when content is empty', () => {
      const store = useSettingStore()
      store.themes.content = ''
      store.themes.pattern = ThemeEnum.OS
      store.ensureThemeReady()
      expect(store.themes.pattern).toBe(ThemeEnum.OS)
      expect([ThemeEnum.LIGHT, ThemeEnum.DARK]).toContain(store.themes.content)
    })

    it('ensureThemeReady normalizes restored invalid theme state', () => {
      const store = useSettingStore()
      store.themes.pattern = 'invalid' as never
      store.themes.content = 'invalid' as never
      store.ensureThemeReady()
      expect(store.themes.pattern).toBe(ThemeEnum.LIGHT)
      expect(store.themes.content).toBe(ThemeEnum.LIGHT)
    })
  })

  describe('login actions', () => {
    it('toggleLogin sets both flags', () => {
      const store = useSettingStore()
      store.toggleLogin(true, true)
      expect(store.autoLoginEnabled).toBe(true)
      expect(store.autoStartupEnabled).toBe(true)
    })

    it('setAutoLogin sets autoLogin only', () => {
      const store = useSettingStore()
      store.setAutoLogin(true)
      expect(store.autoLoginEnabled).toBe(true)
    })

    it('closeAutoLogin disables autoLogin', () => {
      const store = useSettingStore()
      store.setAutoLogin(true)
      store.closeAutoLogin()
      expect(store.autoLoginEnabled).toBe(false)
    })

    it('setLanguage updates page language', () => {
      const store = useSettingStore()
      store.setLanguage('en')
      expect(store.languagePreference).toBe('en')
    })

    it('page setters update page fields through actions', () => {
      const store = useSettingStore()
      store.setPageFont('Source Han Sans')
      store.setPageShadowEnabled(false)
      store.setPageBlurEnabled(false)
      expect(store.pageFontFamily).toBe('Source Han Sans')
      expect(store.pageShadowEnabled).toBe(false)
      expect(store.pageBlurEnabled).toBe(false)
    })

    it('ensurePageSettings restores missing page defaults', () => {
      const store = useSettingStore()
      store.page = undefined as never
      store.ensurePageSettings()
      expect(store.languagePreference).toBe('AUTO')
      expect(store.pageFontFamily).toBe('PingFang')
      expect(store.pageShadowEnabled).toBe(true)
      expect(store.pageBlurEnabled).toBe(true)
    })
  })

  describe('preference actions', () => {
    it('setMessageConfirmEnabled updates confirm flag', () => {
      const store = useSettingStore()
      store.setMessageConfirmEnabled(true)
      expect(store.messageConfirmEnabled).toBe(true)
    })

    it('setLinkPreviewEnabled updates preview flag', () => {
      const store = useSettingStore()
      store.setLinkPreviewEnabled(false)
      expect(store.linkPreviewEnabled).toBe(false)
    })

    it('setEmojiConvertEnabled updates emoji flag', () => {
      const store = useSettingStore()
      store.setEmojiConvertEnabled(false)
      expect(store.emojiConvertEnabled).toBe(false)
    })

    it('setEmojiSize updates emoji size', () => {
      const store = useSettingStore()
      store.setEmojiSize('large')
      expect(store.emojiSize).toBe('large')
    })

    it('setBurnDefaultEnabled updates burn default flag', () => {
      const store = useSettingStore()
      store.setBurnDefaultEnabled(true)
      expect(store.burnDefaultEnabled).toBe(true)
    })

    it('setBurnDefaultDuration updates burn duration', () => {
      const store = useSettingStore()
      store.setBurnDefaultDuration(300)
      expect(store.burnDefaultDuration).toBe(300)
    })

    it('setBurnShowCountdownEnabled updates burn countdown flag', () => {
      const store = useSettingStore()
      store.setBurnShowCountdownEnabled(false)
      expect(store.burnShowCountdownEnabled).toBe(false)
    })

    it('setThreadAutoSubscribeEnabled updates thread auto subscribe flag', () => {
      const store = useSettingStore()
      store.setThreadAutoSubscribeEnabled(false)
      expect(store.threadAutoSubscribeEnabled).toBe(false)
    })

    it('setThreadShowInRoomEnabled updates thread show in room flag', () => {
      const store = useSettingStore()
      store.setThreadShowInRoomEnabled(false)
      expect(store.threadShowInRoomEnabled).toBe(false)
    })

    it('setThreadNotificationLevel updates thread notification level', () => {
      const store = useSettingStore()
      store.setThreadNotificationLevel('all')
      expect(store.threadNotificationLevel).toBe('all')
    })

    it('setSpaceAutoJoinRoomsEnabled updates space auto join flag', () => {
      const store = useSettingStore()
      store.setSpaceAutoJoinRoomsEnabled(true)
      expect(store.spaceAutoJoinRoomsEnabled).toBe(true)
    })

    it('setSpaceShowSubspacesEnabled updates space show subspaces flag', () => {
      const store = useSettingStore()
      store.setSpaceShowSubspacesEnabled(false)
      expect(store.spaceShowSubspacesEnabled).toBe(false)
    })

    it('setSpaceDefaultNotification updates space default notification level', () => {
      const store = useSettingStore()
      store.setSpaceDefaultNotification('mentions_only')
      expect(store.spaceDefaultNotification).toBe('mentions_only')
    })

    it('setSendReadReceiptsEnabled updates read receipts flag', () => {
      const store = useSettingStore()
      store.setSendReadReceiptsEnabled(false)
      expect(store.sendReadReceiptsEnabled).toBe(false)
    })

    it('setSendTypingNotificationsEnabled updates typing notifications flag', () => {
      const store = useSettingStore()
      store.setSendTypingNotificationsEnabled(false)
      expect(store.sendTypingNotificationsEnabled).toBe(false)
    })

    it('ensurePreferenceSettings repairs missing preference fields with defaults', () => {
      const store = useSettingStore()
      store.preferences = {
        messageConfirm: undefined as never,
        linkPreview: undefined as never,
        emojiConvert: undefined as never,
        emojiSize: undefined as never,
        burnDefaultEnabled: undefined as never,
        burnDefaultDuration: undefined as never,
        burnShowCountdown: undefined as never,
        threadAutoSubscribe: undefined as never,
        threadShowInRoom: undefined as never,
        threadNotificationLevel: undefined as never,
        spaceAutoJoinRooms: undefined as never,
        spaceShowSubspaces: undefined as never,
        spaceDefaultNotification: undefined as never,
        sendReadReceipts: undefined as never,
        sendTypingNotifications: undefined as never
      }
      store.ensurePreferenceSettings()
      expect(store.messageConfirmEnabled).toBe(false)
      expect(store.linkPreviewEnabled).toBe(true)
      expect(store.emojiConvertEnabled).toBe(true)
      expect(store.emojiSize).toBe('medium')
      expect(store.burnDefaultEnabled).toBe(false)
      expect(store.burnDefaultDuration).toBe(60)
      expect(store.burnShowCountdownEnabled).toBe(true)
      expect(store.threadAutoSubscribeEnabled).toBe(true)
      expect(store.threadShowInRoomEnabled).toBe(true)
      expect(store.threadNotificationLevel).toBe('participate')
      expect(store.spaceAutoJoinRoomsEnabled).toBe(false)
      expect(store.spaceShowSubspacesEnabled).toBe(true)
      expect(store.spaceDefaultNotification).toBe('all_messages')
      expect(store.sendReadReceiptsEnabled).toBe(true)
      expect(store.sendTypingNotificationsEnabled).toBe(true)
    })

    it('migrateLegacyPreferenceSettings migrates legacy localStorage keys once', () => {
      const store = useSettingStore()
      localStorage.setItem('hula-message-confirm', 'true')
      localStorage.setItem('hula-link-preview', 'false')
      localStorage.setItem('hula-emoji-convert', 'false')
      localStorage.setItem('hula-emoji-size', 'large')
      localStorage.setItem('hula-burn-default-enabled', 'true')
      localStorage.setItem('hula-burn-default-duration', '300')
      localStorage.setItem('hula-burn-show-countdown', 'false')
      localStorage.setItem('hula-thread-auto-subscribe', 'false')
      localStorage.setItem('hula-thread-show-in-room', 'false')
      localStorage.setItem('hula-thread-notification-level', 'all')
      localStorage.setItem('hula-space-auto-join', 'true')
      localStorage.setItem('hula-space-show-subspaces', 'false')
      localStorage.setItem('hula-space-default-notification', 'mentions_only')
      localStorage.setItem('hula-send-read-receipts', 'false')
      localStorage.setItem('hula-send-typing-notifications', 'false')

      store.migrateLegacyPreferenceSettings()

      expect(store.messageConfirmEnabled).toBe(true)
      expect(store.linkPreviewEnabled).toBe(false)
      expect(store.emojiConvertEnabled).toBe(false)
      expect(store.emojiSize).toBe('large')
      expect(store.burnDefaultEnabled).toBe(true)
      expect(store.burnDefaultDuration).toBe(300)
      expect(store.burnShowCountdownEnabled).toBe(false)
      expect(store.threadAutoSubscribeEnabled).toBe(false)
      expect(store.threadShowInRoomEnabled).toBe(false)
      expect(store.threadNotificationLevel).toBe('all')
      expect(store.spaceAutoJoinRoomsEnabled).toBe(true)
      expect(store.spaceShowSubspacesEnabled).toBe(false)
      expect(store.spaceDefaultNotification).toBe('mentions_only')
      expect(store.sendReadReceiptsEnabled).toBe(false)
      expect(store.sendTypingNotificationsEnabled).toBe(false)
      expect(localStorage.getItem('hula-message-confirm')).toBeNull()
      expect(localStorage.getItem('hula-link-preview')).toBeNull()
      expect(localStorage.getItem('hula-emoji-convert')).toBeNull()
      expect(localStorage.getItem('hula-emoji-size')).toBeNull()
      expect(localStorage.getItem('hula-burn-default-enabled')).toBeNull()
      expect(localStorage.getItem('hula-burn-default-duration')).toBeNull()
      expect(localStorage.getItem('hula-burn-show-countdown')).toBeNull()
      expect(localStorage.getItem('hula-thread-auto-subscribe')).toBeNull()
      expect(localStorage.getItem('hula-thread-show-in-room')).toBeNull()
      expect(localStorage.getItem('hula-thread-notification-level')).toBeNull()
      expect(localStorage.getItem('hula-space-auto-join')).toBeNull()
      expect(localStorage.getItem('hula-space-show-subspaces')).toBeNull()
      expect(localStorage.getItem('hula-space-default-notification')).toBeNull()
      expect(localStorage.getItem('hula-send-read-receipts')).toBeNull()
      expect(localStorage.getItem('hula-send-typing-notifications')).toBeNull()
    })
  })

  describe('shortcut actions', () => {
    it('setScreenshotShortcut updates shortcut', () => {
      const store = useSettingStore()
      store.setScreenshotShortcut('Ctrl+Shift+S')
      expect(store.screenshotShortcut).toBe('Ctrl+Shift+S')
    })

    it('setOpenMainPanelShortcut updates shortcut', () => {
      const store = useSettingStore()
      store.setOpenMainPanelShortcut('Ctrl+Shift+P')
      expect(store.openMainPanelShortcut).toBe('Ctrl+Shift+P')
    })

    it('setSendMessageShortcut updates chat sendKey', () => {
      const store = useSettingStore()
      store.setSendMessageShortcut('Ctrl+Enter')
      expect(store.sendMessageShortcut).toBe('Ctrl+Enter')
    })

    it('setMessageDoubleClickEnabled updates double click flag', () => {
      const store = useSettingStore()
      store.setMessageDoubleClickEnabled(false)
      expect(store.messageDoubleClickEnabled).toBe(false)
    })

    it('setChatTranslateProvider updates translate provider', () => {
      const store = useSettingStore()
      store.setChatTranslateProvider('tencent')
      expect(store.chatTranslateProvider).toBe('tencent')
    })

    it('ensureChatSettings repairs missing chat fields with defaults', () => {
      const store = useSettingStore()
      store.chat = { sendKey: '', isDouble: undefined as never, translate: undefined as never }
      store.ensureChatSettings()
      expect(store.sendMessageShortcut).toBe('Enter')
      expect(store.messageDoubleClickEnabled).toBe(true)
      expect(store.chatTranslateProvider).toBe('youdao')
    })

    it('setGlobalShortcutEnabled toggles global shortcuts', () => {
      const store = useSettingStore()
      store.setGlobalShortcutEnabled(true)
      expect(store.globalShortcutEnabled).toBe(true)
    })

    it('ensureShortcuts repairs missing shortcut fields with defaults', () => {
      const store = useSettingStore()
      store.shortcuts = { screenshot: '', openMainPanel: '', globalEnabled: undefined as never }
      store.ensureShortcuts()
      expect(store.screenshotShortcut).toBeTruthy()
      expect(store.openMainPanelShortcut).toBeTruthy()
      expect(store.globalShortcutEnabled).toBe(false)
    })

    it('resetGlobalShortcuts restores default custom shortcuts', () => {
      const store = useSettingStore()
      const defaultScreenshot = store.screenshotShortcut
      const defaultOpenMainPanel = store.openMainPanelShortcut
      store.setScreenshotShortcut('Ctrl+Shift+S')
      store.setOpenMainPanelShortcut('Ctrl+Shift+P')
      store.resetGlobalShortcuts()
      expect(store.screenshotShortcut).toBe(defaultScreenshot)
      expect(store.openMainPanelShortcut).toBe(defaultOpenMainPanel)
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
      expect(store.screenshotConcealEnabled).toBe(true)
    })

    it('ensureScreenshotSettings repairs missing screenshot state', () => {
      const store = useSettingStore()
      store.screenshot = { isConceal: undefined as never }
      store.ensureScreenshotSettings()
      expect(store.screenshotConcealEnabled).toBe(false)
    })
  })

  describe('notification actions', () => {
    it('setMessageSoundEnabled toggles sound', () => {
      const store = useSettingStore()
      store.setMessageSoundEnabled(false)
      expect(store.messageSoundEnabled).toBe(false)
    })

    it('setNotificationVolume clamps to 0-100', () => {
      const store = useSettingStore()
      store.setNotificationVolume(150)
      expect(store.notificationVolume).toBe(100)
      store.setNotificationVolume(-10)
      expect(store.notificationVolume).toBe(0)
      store.setNotificationVolume(50)
      expect(store.notificationVolume).toBe(50)
    })

    it('ensureNotificationSettings repairs missing or invalid notification state', () => {
      const store = useSettingStore()
      store.notification = { messageSound: undefined as never, volume: 999 as never }
      store.ensureNotificationSettings()
      expect(store.messageSoundEnabled).toBe(true)
      expect(store.notificationVolume).toBe(100)
    })

    it('updateNotificationSettings applies partial updates through normalized values', () => {
      const store = useSettingStore()
      store.updateNotificationSettings({ messageSound: false, volume: -20 })
      expect(store.messageSoundEnabled).toBe(false)
      expect(store.notificationVolume).toBe(0)
    })
  })

  describe('secret chat', () => {
    it('setSecretChatPassword enables and sets hash', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('mypassword')
      expect(store.secretChatEnabled).toBe(true)
      expect(store.isSecretChatConfigured()).toBe(true)
      expect(store.verifySecretChatPassword('mypassword')).toBe(true)
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
      expect(store.secretChatEnabled).toBe(false)
      expect(store.secretChatHideSessions).toBe(false)
      expect(store.secretChatAutoLock).toBe(false)
      expect(store.secretChatLockTimeout).toBe(5)
      expect(store.isSecretChatConfigured()).toBe(false)
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
      expect(store.secretChatEnabled).toBe(true)
      expect(store.secretChatHideSessions).toBe(true)
      expect(store.secretChatAutoLock).toBe(true)
      expect(store.secretChatLockTimeout).toBe(30)
    })

    it('disabling secret chat clears lock and hide flags', () => {
      const store = useSettingStore()
      store.setSecretChatPassword('pass')
      store.setSecretChatHideSessions(true)
      store.setSecretChatAutoLock(true)
      store.setSecretChatEnabled(false)
      expect(store.secretChatEnabled).toBe(false)
      expect(store.secretChatHideSessions).toBe(false)
      expect(store.secretChatAutoLock).toBe(false)
    })

    it('ensureSecretChatSettings repairs missing secret chat state', () => {
      const store = useSettingStore()
      store.secretChat = undefined as never
      store.ensureSecretChatSettings()
      expect(store.secretChatEnabled).toBe(false)
      expect(store.secretChatHideSessions).toBe(false)
      expect(store.secretChatAutoLock).toBe(false)
      expect(store.secretChatLockTimeout).toBe(5)
    })
  })
})
