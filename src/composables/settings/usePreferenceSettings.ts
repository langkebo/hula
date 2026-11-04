import { computed } from 'vue'
import { useSettingStore } from '@/stores/domains/settings/setting'

/**
 * 偏好设置页共享逻辑（桌面 `views/settingsWindow/tabs/PreferencesSettings.vue`
 * 与移动 `mobile/views/my/PreferencesSettings.vue` 共用）。
 *
 * 每个字段都是 **可写 computed，直接读写 settingStore**：
 * - 唯一数据源是 store（持久化到 localStorage），不再在组件里维护 ref 副本；
 * - 移动端此前把发送快捷键另存 `tjg-send-key` 并只在该端读取，已随本层收敛移除。
 *
 * 只负责状态与写回，开关反馈、选项文案（i18n）与桌面端专属项（语言、自启动、
 * 存储扫描等）仍留在各端组件。
 */
export function usePreferenceSettings() {
  const settingStore = useSettingStore()

  // 旧版本偏好迁移（幂等），两端进入设置页都要先跑一次
  settingStore.migrateLegacyPreferenceSettings()

  const messageConfirm = computed({
    get: () => settingStore.messageConfirmEnabled,
    set: (value: boolean) => settingStore.setMessageConfirmEnabled(value)
  })

  const linkPreview = computed({
    get: () => settingStore.linkPreviewEnabled,
    set: (value: boolean) => settingStore.setLinkPreviewEnabled(value)
  })

  const emojiConvert = computed({
    get: () => settingStore.emojiConvertEnabled,
    set: (value: boolean) => settingStore.setEmojiConvertEnabled(value)
  })

  const emojiSize = computed({
    get: () => settingStore.emojiSize,
    set: (value: string) => settingStore.setEmojiSize(value)
  })

  const sendKey = computed({
    get: () => settingStore.sendMessageShortcut,
    set: (value: string) => settingStore.setSendMessageShortcut(value)
  })

  const burnDefaultEnabled = computed({
    get: () => settingStore.burnDefaultEnabled,
    set: (value: boolean) => settingStore.setBurnDefaultEnabled(value)
  })

  const burnDefaultDuration = computed({
    get: () => settingStore.burnDefaultDuration,
    set: (value: number) => settingStore.setBurnDefaultDuration(value)
  })

  const burnShowCountdown = computed({
    get: () => settingStore.burnShowCountdownEnabled,
    set: (value: boolean) => settingStore.setBurnShowCountdownEnabled(value)
  })

  const threadAutoSubscribe = computed({
    get: () => settingStore.threadAutoSubscribeEnabled,
    set: (value: boolean) => settingStore.setThreadAutoSubscribeEnabled(value)
  })

  const threadShowInRoom = computed({
    get: () => settingStore.threadShowInRoomEnabled,
    set: (value: boolean) => settingStore.setThreadShowInRoomEnabled(value)
  })

  const threadNotificationLevel = computed({
    get: () => settingStore.threadNotificationLevel,
    set: (value: string) => settingStore.setThreadNotificationLevel(value)
  })

  const spaceAutoJoinRooms = computed({
    get: () => settingStore.spaceAutoJoinRoomsEnabled,
    set: (value: boolean) => settingStore.setSpaceAutoJoinRoomsEnabled(value)
  })

  const spaceShowSubspaces = computed({
    get: () => settingStore.spaceShowSubspacesEnabled,
    set: (value: boolean) => settingStore.setSpaceShowSubspacesEnabled(value)
  })

  const spaceDefaultNotification = computed({
    get: () => settingStore.spaceDefaultNotification,
    set: (value: string) => settingStore.setSpaceDefaultNotification(value)
  })

  const sendReadReceipts = computed({
    get: () => settingStore.sendReadReceiptsEnabled,
    set: (value: boolean) => settingStore.setSendReadReceiptsEnabled(value)
  })

  const sendTypingNotifications = computed({
    get: () => settingStore.sendTypingNotificationsEnabled,
    set: (value: boolean) => settingStore.setSendTypingNotificationsEnabled(value)
  })

  return {
    messageConfirm,
    linkPreview,
    emojiConvert,
    emojiSize,
    sendKey,
    burnDefaultEnabled,
    burnDefaultDuration,
    burnShowCountdown,
    threadAutoSubscribe,
    threadShowInRoom,
    threadNotificationLevel,
    spaceAutoJoinRooms,
    spaceShowSubspaces,
    spaceDefaultNotification,
    sendReadReceipts,
    sendTypingNotifications
  }
}
