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
import { createSettingGetters } from './settingGetters'
import {
  ensureChatSettings as ensureChatDefaults,
  ensureNotificationSettings as ensureNotificationDefaults,
  ensurePageSettings as ensurePageDefaults,
  ensurePreferenceSettings as ensurePreferenceDefaults,
  ensureScreenshotSettings as ensureScreenshotDefaults,
  ensureSecretChatSettings as ensureSecretChatDefaults,
  ensureShortcuts as ensureShortcutDefaults,
  migrateLegacyPreferences
} from './settingSections'
import {
  createDefaultPageSettings,
  getDefaultPreferenceSettings,
  getDefaultShortcuts,
  normalizeBurnDefaultDuration,
  normalizeEmojiSize,
  normalizeNotificationVolume,
  normalizePageFontFamily,
  normalizeRecallTime,
  normalizeSpaceDefaultNotification,
  normalizeThreadNotificationLevel,
  normalizeUploadCompressQuality
} from './settings-helpers'
import { ensureThemeReady, initTheme, normalizeThemeState, syncOsTheme, toggleTheme } from './settingThemeActions'

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
      passwordHash: ''
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
    page: createDefaultPageSettings(),
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
  // 注意：`secretChat.passwordHash` 与 `lockScreen.passwordHash` 都必须持久化。
  // 前者缺失会让重启后 `isSecretChatConfigured()` 恒 false；后者缺失会让锁屏无法解锁。
  // 两者都是 PBKDF2 verifier，不含可用于解密的密钥，落盘不构成明文口令泄露。
  persist: true,
  // getters 体量较大且与 state 一一对应，整块外置（见 settingGetters.ts）
  getters: createSettingGetters(),
  actions: {
    /** 初始化主题 */
    initTheme(theme: string) {
      initTheme(this.themes, theme)
    },
    /** 切换主题 */
    toggleTheme(theme: string) {
      toggleTheme(this.themes, theme)
    },
    /** 同步系统主题到内容（仅在跟随系统时生效） */
    syncOsTheme() {
      syncOsTheme(this.themes)
    },
    /** 兜底修正主题状态 */
    normalizeThemeState() {
      normalizeThemeState(this.themes)
    },
    /** 确保主题状态已初始化且可安全使用 */
    ensureThemeReady(preferredTheme?: string) {
      ensureThemeReady(this.themes, preferredTheme)
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
      this.preferences = ensurePreferenceDefaults(this.preferences)
    },
    migrateLegacyPreferenceSettings() {
      this.ensurePreferenceSettings()
      migrateLegacyPreferences(this.preferences)
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
    setRecallTime(seconds: number) {
      this.ensurePreferenceSettings()
      this.preferences.recallTime = normalizeRecallTime(seconds)
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
    /** 登记/更新已开启阅后即焚的房间（id 幂等） */
    setBurnRoomEnabled(roomId: string, duration: number) {
      this.ensurePreferenceSettings()
      const rest = this.burnRooms.filter((room: { roomId: string }) => room.roomId !== roomId)
      this.preferences.burnRooms = [...rest, { roomId, duration }]
    },
    /** 房间级阅后即焚关闭后从列表移除 */
    removeBurnRoom(roomId: string) {
      this.ensurePreferenceSettings()
      this.preferences.burnRooms = this.burnRooms.filter((room: { roomId: string }) => room.roomId !== roomId)
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
    /** F-1：信任门禁严格模式。**视觉降级**——内容早已进 DOM，模糊只降低肩窥成本，不是访问控制 */
    setTrustGateStrict(enabled: boolean) {
      this.chat = this.chat || { sendKey: 'Enter', isDouble: true, translate: 'youdao' }
      this.chat.trustGateStrict = enabled
    },
    setShowOnlineStatusEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.showOnlineStatus = enabled
    },
    setUploadCompressEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.uploadCompressEnabled = enabled
    },
    setUploadCompressQuality(quality: 0.6 | 0.8 | 0.9) {
      this.ensurePreferenceSettings()
      this.preferences.uploadCompressQuality = normalizeUploadCompressQuality(quality)
    },
    setUploadChunkEnabled(enabled: boolean) {
      this.ensurePreferenceSettings()
      this.preferences.uploadChunkEnabled = enabled
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
      this.page = ensurePageDefaults(this.page)
    },
    setPageFont(font: string) {
      this.ensurePageSettings()
      this.page.fonts = normalizePageFontFamily(font)
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
      this.shortcuts = ensureShortcutDefaults(this.shortcuts)
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
      this.chat = ensureChatDefaults(this.chat)
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
      this.screenshot = ensureScreenshotDefaults(this.screenshot)
    },
    /** 设置截图时是否隐藏窗口 */
    setScreenshotConceal(isConceal: boolean) {
      this.ensureScreenshotSettings()
      this.screenshot.isConceal = isConceal
    },
    ensureNotificationSettings() {
      this.notification = ensureNotificationDefaults(this.notification)
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
      this.secretChat = ensureSecretChatDefaults(this.secretChat)
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
