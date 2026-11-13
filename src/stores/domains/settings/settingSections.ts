import {
  createDefaultPageSettings,
  getDefaultNotificationSettings,
  getDefaultPreferenceSettings,
  getDefaultShortcuts,
  LEGACY_PREFERENCE_STORAGE_KEYS,
  normalizeBurnDefaultDuration,
  normalizeEmojiSize,
  normalizeNotificationVolume,
  normalizePageFontFamily,
  normalizeRecallTime,
  normalizeSpaceDefaultNotification,
  normalizeStrictUnverifiedRooms,
  normalizeThreadNotificationLevel,
  normalizeUploadCompressQuality,
  readLegacyBooleanPreference
} from './settings-helpers'

/**
 * 设置各分区的**补全与迁移**逻辑。
 *
 * 从 `setting.ts` 抽出（该文件已超 600 行）：这些函数只读写传入的分区对象，
 * 不接触 pinia 实例，store 里的 action 退化为单行赋值/转发。
 */

/** 补全偏好设置缺失字段（持久化数据来自旧版本时可能缺键） */
export function ensurePreferenceSettings(
  preferences: STO.Setting['preferences'] | undefined
): STO.Setting['preferences'] {
  const defaults = getDefaultPreferenceSettings()
  if (!preferences) return defaults

  preferences.messageConfirm = preferences.messageConfirm ?? defaults.messageConfirm
  preferences.linkPreview = preferences.linkPreview ?? defaults.linkPreview
  preferences.emojiConvert = preferences.emojiConvert ?? defaults.emojiConvert
  preferences.emojiSize = normalizeEmojiSize(preferences.emojiSize)
  preferences.recallTime = normalizeRecallTime(preferences.recallTime)
  preferences.burnDefaultEnabled = preferences.burnDefaultEnabled ?? defaults.burnDefaultEnabled
  preferences.burnDefaultDuration = normalizeBurnDefaultDuration(preferences.burnDefaultDuration)
  preferences.burnShowCountdown = preferences.burnShowCountdown ?? defaults.burnShowCountdown
  preferences.threadAutoSubscribe = preferences.threadAutoSubscribe ?? defaults.threadAutoSubscribe
  preferences.threadShowInRoom = preferences.threadShowInRoom ?? defaults.threadShowInRoom
  preferences.threadNotificationLevel =
    normalizeThreadNotificationLevel(preferences.threadNotificationLevel) ?? defaults.threadNotificationLevel
  preferences.spaceAutoJoinRooms = preferences.spaceAutoJoinRooms ?? defaults.spaceAutoJoinRooms
  preferences.spaceShowSubspaces = preferences.spaceShowSubspaces ?? defaults.spaceShowSubspaces
  preferences.spaceDefaultNotification =
    normalizeSpaceDefaultNotification(preferences.spaceDefaultNotification) ?? defaults.spaceDefaultNotification
  preferences.sendReadReceipts = preferences.sendReadReceipts ?? defaults.sendReadReceipts
  preferences.sendTypingNotifications = preferences.sendTypingNotifications ?? defaults.sendTypingNotifications
  preferences.showOnlineStatus = preferences.showOnlineStatus ?? defaults.showOnlineStatus
  preferences.uploadCompressEnabled = preferences.uploadCompressEnabled ?? defaults.uploadCompressEnabled
  preferences.uploadCompressQuality = normalizeUploadCompressQuality(preferences.uploadCompressQuality)
  preferences.uploadChunkEnabled = preferences.uploadChunkEnabled ?? defaults.uploadChunkEnabled
  preferences.blockUnverifiedDevices = preferences.blockUnverifiedDevices ?? defaults.blockUnverifiedDevices
  preferences.strictUnverifiedRooms = normalizeStrictUnverifiedRooms(preferences.strictUnverifiedRooms)
  preferences.burnRooms = preferences.burnRooms ?? defaults.burnRooms
  return preferences
}

/**
 * 把旧版散落在 localStorage 顶层的偏好键迁入 store，并逐项清理旧键。
 * 调用方需先执行 `ensurePreferenceSettings`（本函数不负责补全缺省值）。
 */
export function migrateLegacyPreferences(preferences: STO.Setting['preferences']): void {
  if (typeof localStorage === 'undefined') return

  const messageConfirm = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.messageConfirm)
  if (typeof messageConfirm === 'boolean') {
    preferences.messageConfirm = messageConfirm
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.messageConfirm)
  }

  const linkPreview = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.linkPreview)
  if (typeof linkPreview === 'boolean') {
    preferences.linkPreview = linkPreview
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.linkPreview)
  }

  const emojiConvert = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.emojiConvert)
  if (typeof emojiConvert === 'boolean') {
    preferences.emojiConvert = emojiConvert
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.emojiConvert)
  }

  const emojiSize = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.emojiSize)
  if (emojiSize !== null) {
    preferences.emojiSize = normalizeEmojiSize(emojiSize)
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.emojiSize)
  }

  const burnDefaultEnabled = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultEnabled)
  if (typeof burnDefaultEnabled === 'boolean') {
    preferences.burnDefaultEnabled = burnDefaultEnabled
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultEnabled)
  }

  const burnDefaultDuration = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultDuration)
  if (burnDefaultDuration !== null) {
    preferences.burnDefaultDuration = normalizeBurnDefaultDuration(parseInt(burnDefaultDuration, 10))
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnDefaultDuration)
  }

  const burnShowCountdown = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.burnShowCountdown)
  if (typeof burnShowCountdown === 'boolean') {
    preferences.burnShowCountdown = burnShowCountdown
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.burnShowCountdown)
  }

  const threadAutoSubscribe = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.threadAutoSubscribe)
  if (typeof threadAutoSubscribe === 'boolean') {
    preferences.threadAutoSubscribe = threadAutoSubscribe
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadAutoSubscribe)
  }

  const threadShowInRoom = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.threadShowInRoom)
  if (typeof threadShowInRoom === 'boolean') {
    preferences.threadShowInRoom = threadShowInRoom
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadShowInRoom)
  }

  const threadNotificationLevel = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadNotificationLevel)
  if (threadNotificationLevel !== null) {
    preferences.threadNotificationLevel = normalizeThreadNotificationLevel(threadNotificationLevel)
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.threadNotificationLevel)
  }

  const spaceAutoJoinRooms = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.spaceAutoJoinRooms)
  if (typeof spaceAutoJoinRooms === 'boolean') {
    preferences.spaceAutoJoinRooms = spaceAutoJoinRooms
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceAutoJoinRooms)
  }

  const spaceShowSubspaces = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.spaceShowSubspaces)
  if (typeof spaceShowSubspaces === 'boolean') {
    preferences.spaceShowSubspaces = spaceShowSubspaces
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceShowSubspaces)
  }

  const spaceDefaultNotification = localStorage.getItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceDefaultNotification)
  if (spaceDefaultNotification !== null) {
    preferences.spaceDefaultNotification = normalizeSpaceDefaultNotification(spaceDefaultNotification)
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.spaceDefaultNotification)
  }

  const sendReadReceipts = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.sendReadReceipts)
  if (typeof sendReadReceipts === 'boolean') {
    preferences.sendReadReceipts = sendReadReceipts
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.sendReadReceipts)
  }

  const sendTypingNotifications = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.sendTypingNotifications)
  if (typeof sendTypingNotifications === 'boolean') {
    preferences.sendTypingNotifications = sendTypingNotifications
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.sendTypingNotifications)
  }

  const showOnlineStatus = readLegacyBooleanPreference(LEGACY_PREFERENCE_STORAGE_KEYS.showOnlineStatus)
  if (typeof showOnlineStatus === 'boolean') {
    preferences.showOnlineStatus = showOnlineStatus
    localStorage.removeItem(LEGACY_PREFERENCE_STORAGE_KEYS.showOnlineStatus)
  }
}

/** 补全界面设置缺失字段 */
export function ensurePageSettings(page: STO.Setting['page'] | undefined): STO.Setting['page'] {
  if (!page) return createDefaultPageSettings()
  page.shadow = page.shadow ?? true
  page.fonts = normalizePageFontFamily(page.fonts)
  page.blur = page.blur ?? true
  page.lang = page.lang || 'zh-CN'
  return page
}

/** 补全快捷键设置缺失字段 */
export function ensureShortcuts(shortcuts: STO.Setting['shortcuts'] | undefined): STO.Setting['shortcuts'] {
  const defaults = getDefaultShortcuts()
  if (!shortcuts) return defaults
  shortcuts.screenshot = shortcuts.screenshot || defaults.screenshot
  shortcuts.openMainPanel = shortcuts.openMainPanel || defaults.openMainPanel
  shortcuts.globalEnabled = shortcuts.globalEnabled ?? defaults.globalEnabled
  return shortcuts
}

/** 补全聊天设置缺失字段 */
export function ensureChatSettings(chat: STO.Setting['chat'] | undefined): STO.Setting['chat'] {
  if (!chat) return { sendKey: 'Enter', isDouble: true, translate: 'youdao' }
  chat.sendKey = chat.sendKey || 'Enter'
  chat.isDouble = chat.isDouble ?? true
  chat.translate = chat.translate || 'youdao'
  return chat
}

/** 补全截图设置缺失字段 */
export function ensureScreenshotSettings(screenshot: STO.Setting['screenshot'] | undefined): STO.Setting['screenshot'] {
  if (!screenshot) return { isConceal: false }
  screenshot.isConceal = screenshot.isConceal ?? false
  return screenshot
}

/** 补全通知设置缺失字段 */
export function ensureNotificationSettings(
  notification: STO.Setting['notification'] | undefined
): STO.Setting['notification'] {
  const defaults = getDefaultNotificationSettings()
  if (!notification) return defaults
  notification.messageSound = notification.messageSound ?? defaults.messageSound
  notification.volume = normalizeNotificationVolume(notification.volume)
  return notification
}

/** 补全私密聊天设置缺失字段 */
export function ensureSecretChatSettings(secretChat: STO.Setting['secretChat'] | undefined): STO.Setting['secretChat'] {
  if (!secretChat) {
    return {
      enabled: false,
      passwordHash: '',
      hideSessions: false,
      autoLock: false,
      lockTimeout: 5
    }
  }
  secretChat.enabled = secretChat.enabled ?? false
  secretChat.passwordHash = secretChat.passwordHash || ''
  secretChat.hideSessions = secretChat.hideSessions ?? false
  secretChat.autoLock = secretChat.autoLock ?? false
  secretChat.lockTimeout = Math.max(1, Math.round(secretChat.lockTimeout ?? 5))
  return secretChat
}
