import { defineStore } from 'pinia'
import { CloseBxEnum, ShowModeEnum, StoresEnum, ThemeEnum } from '@/enums'
import { isMac } from '@/utils/PlatformConstants'
import { setTheme } from '@tauri-apps/api/app'
import type { Theme } from '@tauri-apps/api/window'

// 获取平台对应的默认快捷键
const getDefaultShortcuts = () => {
  return {
    screenshot: isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H',
    openMainPanel: isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P',
    globalEnabled: false // 默认关闭全局快捷键
  }
}

const getDefaultNotificationSettings = () => ({
  messageSound: true,
  volume: 80
})

const getDefaultPreferenceSettings = (): STO.Setting['preferences'] => ({
  messageConfirm: false,
  linkPreview: true,
  emojiConvert: true,
  emojiSize: 'medium' as 'small' | 'medium' | 'large',
  burnDefaultEnabled: false,
  burnDefaultDuration: 60,
  burnShowCountdown: true,
  threadAutoSubscribe: true,
  threadShowInRoom: true,
  threadNotificationLevel: 'participate' as 'all' | 'participate' | 'none',
  spaceAutoJoinRooms: false,
  spaceShowSubspaces: true,
  spaceDefaultNotification: 'all_messages' as 'all_messages' | 'mentions_only' | 'none',
  sendReadReceipts: true,
  sendTypingNotifications: true
})

const normalizeNotificationVolume = (volume?: number) => {
  if (typeof volume !== 'number') return 80
  return Math.min(100, Math.max(0, Math.round(volume)))
}

const LEGACY_PREFERENCE_STORAGE_KEYS = {
  messageConfirm: 'hula-message-confirm',
  linkPreview: 'hula-link-preview',
  emojiConvert: 'hula-emoji-convert',
  emojiSize: 'hula-emoji-size',
  burnDefaultEnabled: 'hula-burn-default-enabled',
  burnDefaultDuration: 'hula-burn-default-duration',
  burnShowCountdown: 'hula-burn-show-countdown',
  threadAutoSubscribe: 'hula-thread-auto-subscribe',
  threadShowInRoom: 'hula-thread-show-in-room',
  threadNotificationLevel: 'hula-thread-notification-level',
  spaceAutoJoinRooms: 'hula-space-auto-join',
  spaceShowSubspaces: 'hula-space-show-subspaces',
  spaceDefaultNotification: 'hula-space-default-notification',
  sendReadReceipts: 'hula-send-read-receipts',
  sendTypingNotifications: 'hula-send-typing-notifications'
} as const

const readLegacyBooleanPreference = (key: string) => {
  if (typeof localStorage === 'undefined') return undefined
  const raw = localStorage.getItem(key)
  if (raw === null) return undefined
  return raw === 'true'
}

const normalizeThreadNotificationLevel = (value?: string): 'all' | 'participate' | 'none' => {
  if (value === 'all' || value === 'none') return value
  return 'participate'
}

const normalizeEmojiSize = (value?: string): 'small' | 'medium' | 'large' => {
  if (value === 'small' || value === 'large') return value
  return 'medium'
}

const normalizeBurnDefaultDuration = (value?: number): 30 | 60 | 300 | 3600 | 86400 => {
  if (value === 30 || value === 300 || value === 3600 || value === 86400) return value
  return 60
}

const normalizeSpaceDefaultNotification = (value?: string): 'all_messages' | 'mentions_only' | 'none' => {
  if (value === 'mentions_only' || value === 'none') return value
  return 'all_messages'
}

const normalizeTheme = (theme: string) => {
  if (theme === ThemeEnum.DARK) return ThemeEnum.DARK
  if (theme === ThemeEnum.LIGHT) return ThemeEnum.LIGHT
  return ThemeEnum.LIGHT
}

const resolveOsTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return ThemeEnum.LIGHT
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
}

const setDocumentTheme = (theme: string) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

type LegacyThemeState = STO.Setting['themes'] & {
  versatile?: string
}

const stripLegacyThemeVariant = (themes: STO.Setting['themes']) => {
  const legacyThemes = themes as LegacyThemeState
  if ('versatile' in legacyThemes) {
    delete legacyThemes.versatile
  }
}

const hashPassword = (password: string): string => {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

// 缓存方案：使用 Pinia + localStorage 分账号存储
// 后续可迁移到 IndexedDB 以支持更大的数据量
// 每个账号的配置通过 userId 进行隔离存储
export const useSettingStore = defineStore(StoresEnum.SETTING, {
  state: (): STO.Setting => ({
    themes: {
      content: '',
      pattern: ThemeEnum.OS
    },
    escClose: true,
    showMode: ShowModeEnum.ICON,
    lockScreen: {
      enable: false,
      password: ''
    },
    tips: {
      type: CloseBxEnum.HIDE,
      notTips: false
    },
    login: {
      autoLogin: false,
      autoStartup: false
    },
    preferences: getDefaultPreferenceSettings(),
    chat: {
      sendKey: 'Enter',
      isDouble: true,
      translate: 'youdao'
    },
    shortcuts: getDefaultShortcuts(),
    page: {
      shadow: true,
      fonts: 'PingFang',
      blur: true,
      lang: 'AUTO'
    },
    update: {
      dismiss: ''
    },
    screenshot: {
      isConceal: false
    },
    notification: {
      messageSound: true,
      volume: 80
    },
    secretChat: {
      enabled: false,
      passwordHash: '',
      hideSessions: false,
      autoLock: false,
      lockTimeout: 5
    }
  }),
  getters: {
    screenshotShortcut: (state) => state.shortcuts?.screenshot ?? getDefaultShortcuts().screenshot,
    openMainPanelShortcut: (state) => state.shortcuts?.openMainPanel ?? getDefaultShortcuts().openMainPanel,
    themeContent: (state) => state.themes?.content ?? ThemeEnum.LIGHT,
    themePattern: (state) => state.themes?.pattern ?? ThemeEnum.LIGHT,
    languagePreference: (state) => state.page?.lang ?? 'AUTO',
    pageFontFamily: (state) => state.page?.fonts ?? 'PingFang',
    pageShadowEnabled: (state) => state.page?.shadow ?? true,
    pageBlurEnabled: (state) => state.page?.blur ?? true,
    autoLoginEnabled: (state) => state.login?.autoLogin ?? false,
    autoStartupEnabled: (state) => state.login?.autoStartup ?? false,
    secretChatEnabled: (state) => state.secretChat?.enabled ?? false,
    secretChatHideSessions: (state) => state.secretChat?.hideSessions ?? false,
    secretChatAutoLock: (state) => state.secretChat?.autoLock ?? false,
    secretChatLockTimeout: (state) => state.secretChat?.lockTimeout ?? 5,
    sendMessageShortcut: (state) => state.chat?.sendKey ?? 'Enter',
    messageDoubleClickEnabled: (state) => state.chat?.isDouble ?? true,
    chatTranslateProvider: (state) => state.chat?.translate ?? 'youdao',
    globalShortcutEnabled: (state) => state.shortcuts?.globalEnabled ?? false,
    screenshotConcealEnabled: (state) => state.screenshot?.isConceal ?? false,
    messageSoundEnabled: (state) => state.notification?.messageSound ?? true,
    notificationVolume: (state) => normalizeNotificationVolume(state.notification?.volume),
    messageConfirmEnabled: (state) => state.preferences?.messageConfirm ?? false,
    linkPreviewEnabled: (state) => state.preferences?.linkPreview ?? true,
    emojiConvertEnabled: (state) => state.preferences?.emojiConvert ?? true,
    emojiSize: (state) => normalizeEmojiSize(state.preferences?.emojiSize),
    burnDefaultEnabled: (state) => state.preferences?.burnDefaultEnabled ?? false,
    burnDefaultDuration: (state) => normalizeBurnDefaultDuration(state.preferences?.burnDefaultDuration),
    burnShowCountdownEnabled: (state) => state.preferences?.burnShowCountdown ?? true,
    threadAutoSubscribeEnabled: (state) => state.preferences?.threadAutoSubscribe ?? true,
    threadShowInRoomEnabled: (state) => state.preferences?.threadShowInRoom ?? true,
    threadNotificationLevel: (state) => normalizeThreadNotificationLevel(state.preferences?.threadNotificationLevel),
    spaceAutoJoinRoomsEnabled: (state) => state.preferences?.spaceAutoJoinRooms ?? false,
    spaceShowSubspacesEnabled: (state) => state.preferences?.spaceShowSubspaces ?? true,
    spaceDefaultNotification: (state) => normalizeSpaceDefaultNotification(state.preferences?.spaceDefaultNotification),
    sendReadReceiptsEnabled: (state) => state.preferences?.sendReadReceipts ?? true,
    sendTypingNotificationsEnabled: (state) => state.preferences?.sendTypingNotifications ?? true
  },
  actions: {
    /** 初始化主题 */
    initTheme(theme: string) {
      const nextPattern = theme === ThemeEnum.OS ? ThemeEnum.OS : normalizeTheme(theme)
      const nextContent = theme === ThemeEnum.OS ? resolveOsTheme() : normalizeTheme(theme)
      this.$patch((state) => {
        state.themes.pattern = nextPattern
        state.themes.content = nextContent
      })
      stripLegacyThemeVariant(this.themes)
      setDocumentTheme(nextContent)
      setTheme(Object.is(theme, 'os') ? null : (theme as Theme))
    },
    /** 切换主题 */
    toggleTheme(theme: string) {
      setTheme(Object.is(theme, 'os') ? null : (theme as Theme))
      if (theme === ThemeEnum.OS) {
        const os = resolveOsTheme()
        this.$patch((state) => {
          state.themes.pattern = ThemeEnum.OS
          state.themes.content = os
        })
        stripLegacyThemeVariant(this.themes)
        setDocumentTheme(os)
        return
      }
      const nextTheme = normalizeTheme(theme)
      this.$patch((state) => {
        state.themes.pattern = nextTheme
        state.themes.content = nextTheme
      })
      stripLegacyThemeVariant(this.themes)
      setDocumentTheme(nextTheme)
    },
    /** 同步系统主题到内容（仅在跟随系统时生效） */
    syncOsTheme() {
      if (this.themes.pattern !== ThemeEnum.OS) return
      const os = resolveOsTheme()
      if (this.themes.content !== os) {
        this.$patch((state) => {
          state.themes.content = os
        })
      }
      setDocumentTheme(os)
    },
    /** 兜底修正主题状态 */
    normalizeThemeState() {
      stripLegacyThemeVariant(this.themes)

      if (this.themes.pattern === ThemeEnum.OS) {
        this.syncOsTheme()
        return
      }
      const nextTheme = normalizeTheme(this.themes.pattern || this.themes.content)
      if (this.themes.pattern !== nextTheme || this.themes.content !== nextTheme) {
        this.$patch((state) => {
          state.themes.pattern = nextTheme
          state.themes.content = nextTheme
        })
      }
      stripLegacyThemeVariant(this.themes)
      setDocumentTheme(nextTheme)
    },
    /** 确保主题状态已初始化且可安全使用 */
    ensureThemeReady(preferredTheme: string = ThemeEnum.OS) {
      if (!this.themes.content) {
        this.initTheme(preferredTheme)
        return
      }
      this.normalizeThemeState()
    },
    /** 切换登录设置 */
    toggleLogin(autoLogin: boolean, autoStartup: boolean) {
      this.login.autoLogin = autoLogin
      this.login.autoStartup = autoStartup
    },

    setAutoLogin(autoLogin: boolean) {
      this.login.autoLogin = autoLogin
    },
    setAutoStartup(autoStartup: boolean) {
      this.login.autoStartup = autoStartup
    },
    ensurePreferenceSettings() {
      const defaults = getDefaultPreferenceSettings()
      if (!this.preferences) {
        this.preferences = defaults
        return
      }
      this.preferences.messageConfirm = this.preferences.messageConfirm ?? defaults.messageConfirm
      this.preferences.linkPreview = this.preferences.linkPreview ?? defaults.linkPreview
      this.preferences.emojiConvert = this.preferences.emojiConvert ?? defaults.emojiConvert
      this.preferences.emojiSize = normalizeEmojiSize(this.preferences.emojiSize)
      this.preferences.burnDefaultEnabled = this.preferences.burnDefaultEnabled ?? defaults.burnDefaultEnabled
      this.preferences.burnDefaultDuration = normalizeBurnDefaultDuration(this.preferences.burnDefaultDuration)
      this.preferences.burnShowCountdown = this.preferences.burnShowCountdown ?? defaults.burnShowCountdown
      this.preferences.threadAutoSubscribe = this.preferences.threadAutoSubscribe ?? defaults.threadAutoSubscribe
      this.preferences.threadShowInRoom = this.preferences.threadShowInRoom ?? defaults.threadShowInRoom
      this.preferences.threadNotificationLevel =
        normalizeThreadNotificationLevel(this.preferences.threadNotificationLevel) ?? defaults.threadNotificationLevel
      this.preferences.spaceAutoJoinRooms = this.preferences.spaceAutoJoinRooms ?? defaults.spaceAutoJoinRooms
      this.preferences.spaceShowSubspaces = this.preferences.spaceShowSubspaces ?? defaults.spaceShowSubspaces
      this.preferences.spaceDefaultNotification =
        normalizeSpaceDefaultNotification(this.preferences.spaceDefaultNotification) ??
        defaults.spaceDefaultNotification
      this.preferences.sendReadReceipts = this.preferences.sendReadReceipts ?? defaults.sendReadReceipts
      this.preferences.sendTypingNotifications =
        this.preferences.sendTypingNotifications ?? defaults.sendTypingNotifications
    },
    migrateLegacyPreferenceSettings() {
      this.ensurePreferenceSettings()
      if (typeof localStorage === 'undefined') return

      const messageConfirm = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.messageConfirm)
      if (typeof messageConfirm === 'boolean') {
        this.preferences.messageConfirm = messageConfirm
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.messageConfirm)
      }

      const linkPreview = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.linkPreview)
      if (typeof linkPreview === 'boolean') {
        this.preferences.linkPreview = linkPreview
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.linkPreview)
      }

      const emojiConvert = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.emojiConvert)
      if (typeof emojiConvert === 'boolean') {
        this.preferences.emojiConvert = emojiConvert
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.emojiConvert)
      }

      const emojiSize = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.emojiSize)
      if (emojiSize !== null) {
        this.preferences.emojiSize = normalizeEmojiSize(emojiSize)
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.emojiSize)
      }

      const burnDefaultEnabled = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultEnabled)
      if (typeof burnDefaultEnabled === 'boolean') {
        this.preferences.burnDefaultEnabled = burnDefaultEnabled
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultEnabled)
      }

      const burnDefaultDuration = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultDuration)
      if (burnDefaultDuration !== null) {
        this.preferences.burnDefaultDuration = normalizeBurnDefaultDuration(parseInt(burnDefaultDuration, 10))
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultDuration)
      }

      const burnShowCountdown = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.burnShowCountdown)
      if (typeof burnShowCountdown === 'boolean') {
        this.preferences.burnShowCountdown = burnShowCountdown
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnShowCountdown)
      }

      const threadAutoSubscribe = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.threadAutoSubscribe)
      if (typeof threadAutoSubscribe === 'boolean') {
        this.preferences.threadAutoSubscribe = threadAutoSubscribe
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadAutoSubscribe)
      }

      const threadShowInRoom = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.threadShowInRoom)
      if (typeof threadShowInRoom === 'boolean') {
        this.preferences.threadShowInRoom = threadShowInRoom
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadShowInRoom)
      }

      const threadNotificationLevel = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadNotificationLevel)
      if (threadNotificationLevel !== null) {
        this.preferences.threadNotificationLevel = normalizeThreadNotificationLevel(threadNotificationLevel)
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadNotificationLevel)
      }

      const spaceAutoJoinRooms = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.spaceAutoJoinRooms)
      if (typeof spaceAutoJoinRooms === 'boolean') {
        this.preferences.spaceAutoJoinRooms = spaceAutoJoinRooms
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceAutoJoinRooms)
      }

      const spaceShowSubspaces = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.spaceShowSubspaces)
      if (typeof spaceShowSubspaces === 'boolean') {
        this.preferences.spaceShowSubspaces = spaceShowSubspaces
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceShowSubspaces)
      }

      const spaceDefaultNotification = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceDefaultNotification)
      if (spaceDefaultNotification !== null) {
        this.preferences.spaceDefaultNotification = normalizeSpaceDefaultNotification(spaceDefaultNotification)
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceDefaultNotification)
      }

      const sendReadReceipts = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.sendReadReceipts)
      if (typeof sendReadReceipts === 'boolean') {
        this.preferences.sendReadReceipts = sendReadReceipts
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.sendReadReceipts)
      }

      const sendTypingNotifications = readLegacyBooleanPreference(
        LEGACY_PREFERENCE_STORAGE_KEYS.sendTypingNotifications
      )
      if (typeof sendTypingNotifications === 'boolean') {
        this.preferences.sendTypingNotifications = sendTypingNotifications
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.sendTypingNotifications)
      }
    },
    setMessageConfirmEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.messageConfirm = enabled
    },
    setLinkPreviewEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.linkPreview = enabled
    },
    setEmojiConvertEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.emojiConvert = enabled
    },
    setEmojiSize(size: string) {
      this.ensurePreferenceSettings()
      this.preferences.emojiSize = normalizeEmojiSize(size)
    },
    setBurnDefaultEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.burnDefaultEnabled = enabled
    },
    setBurnDefaultDuration(duration: number) {
      this.ensurePreferenceSettings()
      this.preferences.burnDefaultDuration = normalizeBurnDefaultDuration(duration)
    },
    setBurnShowCountdownEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.burnShowCountdown = enabled
    },
    setThreadAutoSubscribeEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.threadAutoSubscribe = enabled
    },
    setThreadShowInRoomEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.threadShowInRoom = enabled
    },
    setThreadNotificationLevel(level: string) {
      this.ensurePreferenceSettings()
      this.preferences.threadNotificationLevel = normalizeThreadNotificationLevel(level)
    },
    setSpaceAutoJoinRoomsEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.spaceAutoJoinRooms = enabled
    },
    setSpaceShowSubspacesEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.spaceShowSubspaces = enabled
    },
    setSpaceDefaultNotification(level: string) {
      this.ensurePreferenceSettings()
      this.preferences.spaceDefaultNotification = normalizeSpaceDefaultNotification(level)
    },
    setSendReadReceiptsEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.sendReadReceipts = enabled
    },
    setSendTypingNotificationsEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.sendTypingNotifications = enabled
    },
    ensurePageSettings() {
      if (!this.page) {
        this.page = {
          shadow: true,
          fonts: 'PingFang',
          blur: true,
          lang: 'AUTO'
        }
        return
      }
      this.page.shadow = this.page.shadow ?? true
      this.page.fonts = this.page.fonts || 'PingFang'
      this.page.blur = this.page.blur ?? true
      this.page.lang = this.page.lang || 'AUTO'
    },
    setPageFont(font: string) {
      this.ensurePageSettings()
      this.page.fonts = font
    },
    setPageShadowEnabled(enabled: boolean) {
      this.ensurePageSettings()
      this.page.shadow = enabled
    },
    setPageBlurEnabled(enabled: boolean) {
      this.ensurePageSettings()
      this.page.blur = enabled
    },
    setLanguage(language: string) {
      this.ensurePageSettings()
      this.page.lang = language
    },
    /** 设置菜单显示模式 */
    setShowMode(showMode: ShowModeEnum) {
      this.showMode = showMode
    },
    /** 设置截图快捷键 */
    ensureShortcuts() {
      const defaults = getDefaultShortcuts()
      if (!this.shortcuts) {
        this.shortcuts = defaults
        return
      }
      this.shortcuts.screenshot = this.shortcuts.screenshot || defaults.screenshot
      this.shortcuts.openMainPanel = this.shortcuts.openMainPanel || defaults.openMainPanel
      this.shortcuts.globalEnabled = this.shortcuts.globalEnabled ?? defaults.globalEnabled
    },
    resetGlobalShortcuts() {
      this.ensureShortcuts()
      const defaults = getDefaultShortcuts()
      this.shortcuts.screenshot = defaults.screenshot
      this.shortcuts.openMainPanel = defaults.openMainPanel
    },
    setScreenshotShortcut(shortcut: string) {
      this.ensureShortcuts()
      this.shortcuts.screenshot = shortcut
    },
    /** 设置打开主面板快捷键 */
    setOpenMainPanelShortcut(shortcut: string) {
      this.ensureShortcuts()
      this.shortcuts.openMainPanel = shortcut
    },
    ensureChatSettings() {
      if (!this.chat) {
        this.chat = { sendKey: 'Enter', isDouble: true, translate: 'youdao' }
        return
      }
      this.chat.sendKey = this.chat.sendKey || 'Enter'
      this.chat.isDouble = this.chat.isDouble ?? true
      this.chat.translate = this.chat.translate || 'youdao'
    },
    /** 设置发送消息快捷键 */
    setSendMessageShortcut(shortcut: string) {
      this.ensureChatSettings()
      this.chat.sendKey = shortcut
    },
    setMessageDoubleClickEnabled(enabled: boolean) {
      this.ensureChatSettings()
      this.chat.isDouble = enabled
    },
    setChatTranslateProvider(provider: 'youdao' | 'tencent') {
      this.ensureChatSettings()
      this.chat.translate = provider
    },
    /** 设置全局快捷键开关状态 */
    setGlobalShortcutEnabled(enabled: boolean) {
      this.ensureShortcuts()
      this.shortcuts.globalEnabled = enabled
    },
    closeAutoLogin() {
      this.login.autoLogin = false
    },
    ensureScreenshotSettings() {
      if (!this.screenshot) {
        this.screenshot = { isConceal: false }
        return
      }
      this.screenshot.isConceal = this.screenshot.isConceal ?? false
    },
    /** 设置截图时是否隐藏窗口 */
    setScreenshotConceal(isConceal: boolean) {
      this.ensureScreenshotSettings()
      this.screenshot.isConceal = isConceal
    },
    ensureNotificationSettings() {
      const defaults = getDefaultNotificationSettings()
      if (!this.notification) {
        this.notification = defaults
        return
      }
      this.notification.messageSound = this.notification.messageSound ?? defaults.messageSound
      this.notification.volume = normalizeNotificationVolume(this.notification.volume)
    },
    updateNotificationSettings(partial: Partial<{ messageSound: boolean; volume: number }>) {
      this.ensureNotificationSettings()
      if (typeof partial.messageSound === 'boolean') {
        this.notification.messageSound = partial.messageSound
      }
      if (typeof partial.volume === 'number') {
        this.notification.volume = normalizeNotificationVolume(partial.volume)
      }
    },
    /** 设置消息提示音开关 */
    setMessageSoundEnabled(enabled: boolean) {
      this.updateNotificationSettings({ messageSound: enabled })
    },
    /** 设置消息提示音音量（0-100） */
    setNotificationVolume(volume: number) {
      this.updateNotificationSettings({ volume })
    },
    ensureSecretChatSettings() {
      if (!this.secretChat) {
        this.secretChat = {
          enabled: false,
          passwordHash: '',
          hideSessions: false,
          autoLock: false,
          lockTimeout: 5
        }
        return
      }
      this.secretChat.enabled = this.secretChat.enabled ?? false
      this.secretChat.passwordHash = this.secretChat.passwordHash || ''
      this.secretChat.hideSessions = this.secretChat.hideSessions ?? false
      this.secretChat.autoLock = this.secretChat.autoLock ?? false
      this.secretChat.lockTimeout = Math.max(1, Math.round(this.secretChat.lockTimeout ?? 5))
    },
    /** 设置私密聊天密码 */
    setSecretChatPassword(password: string) {
      this.ensureSecretChatSettings()
      this.secretChat.enabled = true
      this.secretChat.passwordHash = hashPassword(password)
    },
    setSecretChatEnabled(enabled: boolean) {
      this.ensureSecretChatSettings()
      this.secretChat.enabled = enabled
      if (!enabled) {
        this.secretChat.hideSessions = false
        this.secretChat.autoLock = false
      }
    },
    setSecretChatHideSessions(enabled: boolean) {
      this.ensureSecretChatSettings()
      this.secretChat.hideSessions = enabled
    },
    setSecretChatAutoLock(enabled: boolean) {
      this.ensureSecretChatSettings()
      this.secretChat.autoLock = enabled
      if (!enabled) {
        this.secretChat.lockTimeout = 5
      }
    },
    setSecretChatLockTimeout(minutes: number) {
      this.ensureSecretChatSettings()
      this.secretChat.lockTimeout = Math.max(1, Math.round(minutes))
    },
    /** 验证私密聊天密码 */
    verifySecretChatPassword(password: string): boolean {
      this.ensureSecretChatSettings()
      if (!this.secretChat.enabled) {
        return false
      }
      return this.secretChat.passwordHash === hashPassword(password)
    },
    /** 清除私密聊天密码 */
    clearSecretChatPassword() {
      this.ensureSecretChatSettings()
      this.secretChat.enabled = false
      this.secretChat.passwordHash = ''
      this.secretChat.hideSessions = false
      this.secretChat.autoLock = false
      this.secretChat.lockTimeout = 5
    },
    /** 检查私密聊天是否已设置 */
    isSecretChatConfigured(): boolean {
      this.ensureSecretChatSettings()
      return this.secretChat.enabled && !!this.secretChat.passwordHash
    }
  },
  share: {
    enable: true,
    initialize: true
  }
})
