import { setTheme } from '@tauri-apps/api/app'
import type { Theme } from '@tauri-apps/api/window'
import { defineStore } from 'pinia'
import { CloseBxEnum, ShowModeEnum, StoresEnum, ThemeEnum } from '@/enums'
import {
  applySecretChatAutoLock,
  applySecretChatEnabled,
  applySecretChatHideSessions,
  applySecretChatLockTimeout,
  applySecretChatPassword,
  resetSecretChatPassword,
  unlockSecretChatWithPassword,
  verifySecretChatPasswordOnly
} from './secretChatActions'
import {
  getDefaultNotificationSettings,
  getDefaultPreferenceSettings,
  getDefaultShortcuts,
  LEGACY_PREFERENCE_STORAGE_KEYS,
  normalizeBurnDefaultDuration,
  normalizeEmojiSize,
  normalizeNotificationVolume,
  normalizeSpaceDefaultNotification,
  normalizeStrictUnverifiedRooms,
  normalizeTheme,
  normalizeThreadNotificationLevel,
  readLegacyBooleanPreference,
  resolveOsTheme,
  setDocumentTheme,
  stripLegacyThemeVariant
} from './settings-helpers'

// 缓存方案：使用 Pinia + localStorage 分账号存储
// 后续可迁移到 IndexedDB 以支持更大的数据量
// 每个账号的配置通过 userId 进行隔离存储
export const useSettingStore = defineStore(StoresEnum.SETTING, {
  state: (): STO.Setting => ({
    themes: {
      content: ThemeEnum.LIGHT,
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
      translate: 'youdao',
      // F-1：严格模式下「未验证/风险」消息默认模糊，点击才展开（默认关，避免打扰）
      trustGateStrict: false
    },
    shortcuts: getDefaultShortcuts(),
    page: {
      shadow: true,
      fonts: 'PingFang',
      blur: true,
      lang: 'zh-CN'
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
    },
    panelWidth: {
      left: 280,
      right: 320
    }
  }),
  persist: {
    // 注意：`secretChat.passwordHash` 必须持久化，否则重启后 `isSecretChatConfigured()` 恒 false，
    // 用户会看到「已设置过密码却提示请先设置」。哈希本身是 PBKDF2 verifier，不含可用于解密的密钥。
    omit: ['lockScreen.password']
  },
  getters: {
    screenshotShortcut: (state: STO.Setting) => state.shortcuts?.screenshot ?? getDefaultShortcuts().screenshot,
    openMainPanelShortcut: (state: STO.Setting) =>
      state.shortcuts?.openMainPanel ?? getDefaultShortcuts().openMainPanel,
    themeContent: (state: STO.Setting) => state.themes?.content ?? ThemeEnum.LIGHT,
    themePattern: (state: STO.Setting) => state.themes?.pattern ?? ThemeEnum.LIGHT,
    languagePreference: (state: STO.Setting) => state.page?.lang ?? 'zh-CN',
    pageFontFamily: (state: STO.Setting) => state.page?.fonts ?? 'PingFang',
    pageShadowEnabled: (state: STO.Setting) => state.page?.shadow ?? true,
    pageBlurEnabled: (state: STO.Setting) => state.page?.blur ?? true,
    autoLoginEnabled: (state: STO.Setting) => state.login?.autoLogin ?? false,
    autoStartupEnabled: (state: STO.Setting) => state.login?.autoStartup ?? false,
    secretChatEnabled: (state: STO.Setting) => state.secretChat?.enabled ?? false,
    secretChatHideSessions: (state: STO.Setting) => state.secretChat?.hideSessions ?? false,
    secretChatAutoLock: (state: STO.Setting) => state.secretChat?.autoLock ?? false,
    secretChatLockTimeout: (state: STO.Setting) => state.secretChat?.lockTimeout ?? 5,
    sendMessageShortcut: (state: STO.Setting) => state.chat?.sendKey ?? 'Enter',
    messageDoubleClickEnabled: (state: STO.Setting) => state.chat?.isDouble ?? true,
    chatTranslateProvider: (state: STO.Setting) => state.chat?.translate ?? 'youdao',
    /** F-1 严格信任门禁：未验证/风险消息默认模糊 */
    trustGateStrictEnabled: (state: STO.Setting) => state.chat?.trustGateStrict ?? false,
    globalShortcutEnabled: (state: STO.Setting) => state.shortcuts?.globalEnabled ?? false,
    screenshotConcealEnabled: (state: STO.Setting) => state.screenshot?.isConceal ?? false,
    messageSoundEnabled: (state: STO.Setting) => state.notification?.messageSound ?? true,
    notificationVolume: (state: STO.Setting) => normalizeNotificationVolume(state.notification?.volume),
    messageConfirmEnabled: (state: STO.Setting) => state.preferences?.messageConfirm ?? false,
    linkPreviewEnabled: (state: STO.Setting) => state.preferences?.linkPreview ?? true,
    emojiConvertEnabled: (state: STO.Setting) => state.preferences?.emojiConvert ?? true,
    emojiSize: (state: STO.Setting) => normalizeEmojiSize(state.preferences?.emojiSize),
    burnDefaultEnabled: (state: STO.Setting) => state.preferences?.burnDefaultEnabled ?? false,
    burnDefaultDuration: (state: STO.Setting) => normalizeBurnDefaultDuration(state.preferences?.burnDefaultDuration),
    burnShowCountdownEnabled: (state: STO.Setting) => state.preferences?.burnShowCountdown ?? true,
    threadAutoSubscribeEnabled: (state: STO.Setting) => state.preferences?.threadAutoSubscribe ?? true,
    threadShowInRoomEnabled: (state: STO.Setting) => state.preferences?.threadShowInRoom ?? true,
    threadNotificationLevel: (state: STO.Setting) =>
      normalizeThreadNotificationLevel(state.preferences?.threadNotificationLevel),
    spaceAutoJoinRoomsEnabled: (state: STO.Setting) => state.preferences?.spaceAutoJoinRooms ?? false,
    spaceShowSubspacesEnabled: (state: STO.Setting) => state.preferences?.spaceShowSubspaces ?? true,
    spaceDefaultNotification: (state: STO.Setting) =>
      normalizeSpaceDefaultNotification(state.preferences?.spaceDefaultNotification),
    sendReadReceiptsEnabled: (state: STO.Setting) => state.preferences?.sendReadReceipts ?? true,
    sendTypingNotificationsEnabled: (state: STO.Setting) => state.preferences?.sendTypingNotifications ?? true,
    showOnlineStatusEnabled: (state: STO.Setting) => state.preferences?.showOnlineStatus ?? true,
    /** R-1：全局严格模式（不向未验证设备发送加密房间密钥） */
    blockUnverifiedDevicesEnabled: (state: STO.Setting) => state.preferences?.blockUnverifiedDevices ?? false,
    /** R-1：逐房间严格模式列表 */
    strictUnverifiedRooms: (state: STO.Setting) => state.preferences?.strictUnverifiedRooms ?? []
  },
  actions: {
    /** 初始化主题 */
    initTheme(theme: string) {
      const nextPattern = theme === ThemeEnum.OS ? ThemeEnum.OS : normalizeTheme(theme)
      const nextContent = theme === ThemeEnum.OS ? resolveOsTheme() : normalizeTheme(theme)
      this.$patch((state: STO.Setting) => {
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
        this.$patch((state: STO.Setting) => {
          state.themes.pattern = ThemeEnum.OS
          state.themes.content = os
        })
        stripLegacyThemeVariant(this.themes)
        setDocumentTheme(os)
        return
      }
      const nextTheme = normalizeTheme(theme)
      this.$patch((state: STO.Setting) => {
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
        this.$patch((state: STO.Setting) => {
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
        this.$patch((state: STO.Setting) => {
          state.themes.pattern = nextTheme
          state.themes.content = nextTheme
        })
      }
      stripLegacyThemeVariant(this.themes)
      setDocumentTheme(nextTheme)
    },
    /** 确保主题状态已初始化且可安全使用 */
    ensureThemeReady(preferredTheme?: string) {
      if (!this.themes.content) {
        this.initTheme(preferredTheme || this.themes.pattern || ThemeEnum.OS)
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
      this.preferences.showOnlineStatus = this.preferences.showOnlineStatus ?? defaults.showOnlineStatus
      this.preferences.blockUnverifiedDevices =
        this.preferences.blockUnverifiedDevices ?? defaults.blockUnverifiedDevices
      this.preferences.strictUnverifiedRooms = normalizeStrictUnverifiedRooms(this.preferences.strictUnverifiedRooms)
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

      const showOnlineStatus = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.showOnlineStatus)
      if (typeof showOnlineStatus === 'boolean') {
        this.preferences.showOnlineStatus = showOnlineStatus
        localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.showOnlineStatus)
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
    /**
     * F-1：信任门禁严格模式（未验证 / 风险消息默认模糊，点击展开）。
     *
     * 这是**视觉降级**：内容早已解密进入 DOM，模糊只降低肩窥成本，不是访问控制。
     * 默认关闭，避免策略上线就改变所有既有会话的观感。
     */
    setTrustGateStrict(enabled: boolean) {
      this.chat = this.chat || { sendKey: 'Enter', isDouble: true, translate: 'youdao' }
      this.chat.trustGateStrict = enabled
    },
    setShowOnlineStatusEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.showOnlineStatus = enabled
    },
    /**
     * R-1：设置全局严格模式（不向未验证设备发送加密房间的密钥）。
     *
     * 这里**只写偏好**；把偏好施加到 SDK（`crypto.globalBlacklistUnverifiedDevices`）
     * 由 `useRoomStrictness` / crypto 初始化后重放负责 —— 保持 store 无 SDK 依赖。
     */
    setBlockUnverifiedDevicesEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.blockUnverifiedDevices = enabled
    },
    /** R-1：登记/取消某房间的严格模式覆盖（持久化用；施加到 SDK 由调用方负责） */
    setRoomStrictUnverified(roomId: string, strict: boolean) {
      this.ensurePreferenceSettings()
      const current = this.preferences.strictUnverifiedRooms
      const next = current.filter((id) => id !== roomId)
      if (strict) next.push(roomId)
      this.preferences.strictUnverifiedRooms = next
    },
    ensurePageSettings() {
      if (!this.page) {
        this.page = {
          shadow: true,
          fonts: 'PingFang',
          blur: true,
          lang: 'zh-CN'
        }
        return
      }
      this.page.shadow = this.page.shadow ?? true
      this.page.fonts = this.page.fonts || 'PingFang'
      this.page.blur = this.page.blur ?? true
      this.page.lang = this.page.lang || 'zh-CN'
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
    /** 设置密码：PBKDF2 派生 verifier 落盘，dbKey 当场清零（解锁时再派生）。 */
    async setSecretChatPassword(password: string) {
      return applySecretChatPassword(this, password)
    },
    /** 开启/关闭私密聊天；未设密码时抛 `SECRET_CHAT_PASSWORD_REQUIRED`。 */
    setSecretChatEnabled(enabled: boolean) {
      return applySecretChatEnabled(this, enabled)
    },
    setSecretChatHideSessions(enabled: boolean) {
      return applySecretChatHideSessions(this, enabled)
    },
    setSecretChatAutoLock(enabled: boolean) {
      return applySecretChatAutoLock(this, enabled)
    },
    setSecretChatLockTimeout(minutes: number) {
      return applySecretChatLockTimeout(this, minutes)
    },
    /** 仅校验密码（不改解锁态），用于「修改密码前验证旧密码」。 */
    async verifySecretChatPassword(password: string): Promise<boolean> {
      return verifySecretChatPasswordOnly(this, password)
    },
    /** 校验密码并解锁：成功时把 dbKey 写入内存态解锁会话。 */
    async unlockSecretChat(password: string): Promise<boolean> {
      return unlockSecretChatWithPassword(this, password)
    },
    /** 清除私密聊天密码（同时上锁）。 */
    clearSecretChatPassword() {
      return resetSecretChatPassword(this)
    },
    /** 检查私密聊天是否已设置 */
    isSecretChatConfigured(): boolean {
      this.ensureSecretChatSettings()
      return this.secretChat.enabled && !!this.secretChat.passwordHash
    },
    /** 设置面板宽度（钳制到 200-600） */
    setPanelWidth(side: 'left' | 'right', width: number) {
      const min = 200
      const max = 600
      const clamped = Math.min(max, Math.max(min, Math.round(width)))
      this.panelWidth[side] = clamped
    }
  }
})
