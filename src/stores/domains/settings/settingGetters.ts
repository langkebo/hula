import { ThemeEnum } from '@/enums'
import {
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

/**
 * 设置 store 的 getters。
 *
 * 从 `setting.ts` 抽出（该文件已超 600 行）：getters 只依赖 state，无 `this`，
 * 因此可以整块外置，store 里只留 `getters: createSettingGetters()`。
 */
export const createSettingGetters = () => ({
  screenshotShortcut: (state: STO.Setting) => state.shortcuts?.screenshot ?? getDefaultShortcuts().screenshot,
  openMainPanelShortcut: (state: STO.Setting) => state.shortcuts?.openMainPanel ?? getDefaultShortcuts().openMainPanel,
  themeContent: (state: STO.Setting) => state.themes?.content ?? ThemeEnum.LIGHT,
  themePattern: (state: STO.Setting) => state.themes?.pattern ?? ThemeEnum.LIGHT,
  languagePreference: (state: STO.Setting) => state.page?.lang ?? 'zh-CN',
  pageFontFamily: (state: STO.Setting) => normalizePageFontFamily(state.page?.fonts),
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
  recallTime: (state: STO.Setting) => normalizeRecallTime(state.preferences?.recallTime),
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
  uploadCompressEnabled: (state: STO.Setting) => state.preferences?.uploadCompressEnabled ?? true,
  uploadCompressQuality: (state: STO.Setting) =>
    normalizeUploadCompressQuality(state.preferences?.uploadCompressQuality),
  uploadChunkEnabled: (state: STO.Setting) => state.preferences?.uploadChunkEnabled ?? true,
  /** R-1：全局严格模式（不向未验证设备发送加密房间密钥） */
  blockUnverifiedDevicesEnabled: (state: STO.Setting) => state.preferences?.blockUnverifiedDevices ?? false,
  /** R-1：逐房间严格模式列表 */
  strictUnverifiedRooms: (state: STO.Setting) => state.preferences?.strictUnverifiedRooms ?? [],
  /** 已开启阅后即焚的房间列表（桌面 / 移动共用数据源） */
  burnRooms: (state: STO.Setting) => state.preferences?.burnRooms ?? []
})
