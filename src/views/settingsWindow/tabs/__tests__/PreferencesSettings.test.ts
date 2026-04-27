import { mount } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreferencesSettings from '../PreferencesSettings.vue'

const messageSuccessMock = vi.fn()
const messageWarningMock = vi.fn()
const messageErrorMock = vi.fn()
const setSendMessageShortcutMock = vi.fn()
const setAutoLoginMock = vi.fn()
const setAutoStartupMock = vi.fn()
const setMessageConfirmEnabledMock = vi.fn()
const setLinkPreviewEnabledMock = vi.fn()
const setEmojiConvertEnabledMock = vi.fn()
const setEmojiSizeMock = vi.fn()
const setBurnDefaultEnabledMock = vi.fn()
const setBurnDefaultDurationMock = vi.fn()
const setBurnShowCountdownEnabledMock = vi.fn()
const setThreadAutoSubscribeEnabledMock = vi.fn()
const setThreadShowInRoomEnabledMock = vi.fn()
const setThreadNotificationLevelMock = vi.fn()
const setSpaceAutoJoinRoomsEnabledMock = vi.fn()
const setSpaceShowSubspacesEnabledMock = vi.fn()
const setSpaceDefaultNotificationMock = vi.fn()
const setSendReadReceiptsEnabledMock = vi.fn()
const setSendTypingNotificationsEnabledMock = vi.fn()
const migrateLegacyPreferenceSettingsMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.preferences.language_section': '语言',
  'setting.preferences.interface_language_label': '界面语言',
  'setting.preferences.interface_language_desc': '选择应用显示语言',
  'setting.preferences.language_auto': '自动检测',
  'setting.preferences.language_zh_cn': '简体中文',
  'setting.preferences.language_zh_tw': '繁體中文',
  'setting.preferences.language_en': 'English',
  'setting.preferences.language_ja': '日本語',
  'setting.preferences.startup_storage_section': '启动与存储',
  'setting.preferences.auto_login_label': '自动登录',
  'setting.preferences.auto_login_desc': '启动应用后自动恢复上次登录状态',
  'setting.preferences.auto_startup_label': '开机启动',
  'setting.preferences.auto_startup_desc': '系统启动后自动启动桌面端应用',
  'setting.preferences.storage_directory_label': '本地存储目录',
  'setting.preferences.storage_directory_desc': '统一管理扫描目录并查看当前空间占用',
  'setting.preferences.storage_disk_usage': '磁盘占用 {percentage}%',
  'setting.preferences.storage_scan_progress': '扫描进度 {percentage}%',
  'setting.preferences.messaging_section': '消息发送',
  'setting.preferences.send_key_label': '发送键',
  'setting.preferences.send_key_desc': '选择发送消息的快捷键',
  'setting.preferences.send_key_ctrl_enter': 'Ctrl + Enter',
  'setting.preferences.send_key_shift_enter': 'Shift + Enter',
  'setting.preferences.message_confirm_label': '消息确认',
  'setting.preferences.message_confirm_desc': '发送前显示确认对话框',
  'setting.preferences.recall_time_label': '消息撤回时间',
  'setting.preferences.recall_time_desc': '设置消息可撤回的时间窗口',
  'setting.preferences.recall_2_minutes': '2 分钟',
  'setting.preferences.recall_5_minutes': '5 分钟',
  'setting.preferences.recall_10_minutes': '10 分钟',
  'setting.preferences.link_preview_section': '链接预览',
  'setting.preferences.link_preview_label': '启用链接预览',
  'setting.preferences.link_preview_desc': '自动生成消息中链接的预览',
  'setting.preferences.emoji_section': '表情符号',
  'setting.preferences.emoji_convert_label': '自动转换表情',
  'setting.preferences.emoji_convert_desc': '将 :) 等符号自动转换为表情',
  'setting.preferences.emoji_size_label': '表情大小',
  'setting.preferences.emoji_size_desc': '设置消息中表情的显示大小',
  'setting.preferences.emoji_small': '小',
  'setting.preferences.emoji_medium': '中',
  'setting.preferences.emoji_large': '大',
  'setting.preferences.burn_defaults_section': '阅后即焚默认',
  'setting.preferences.burn_default_enabled_label': '新私聊默认开启阅后即焚',
  'setting.preferences.burn_default_enabled_desc': '创建新私聊时自动开启阅后即焚',
  'setting.preferences.burn_default_duration_label': '默认焚毁时间',
  'setting.preferences.burn_default_duration_desc': '阅后即焚消息的默认焚毁时间',
  'setting.preferences.burn_show_countdown_label': '显示焚毁倒计时',
  'setting.preferences.burn_show_countdown_desc': '在消息上显示焚毁倒计时进度',
  'setting.preferences.thread_section': '线程偏好',
  'setting.preferences.thread_auto_subscribe_label': '参与线程时自动订阅',
  'setting.preferences.thread_auto_subscribe_desc': '在线程中发送消息后自动订阅该线程',
  'setting.preferences.thread_show_in_room_label': '在房间内显示线程入口',
  'setting.preferences.thread_show_in_room_desc': '在消息列表中显示线程入口图标',
  'setting.preferences.thread_notification_label': '线程通知级别',
  'setting.preferences.thread_notification_desc': '控制线程消息的通知行为',
  'setting.preferences.space_section': '空间偏好',
  'setting.preferences.space_auto_join_label': '加入空间时自动加入其房间',
  'setting.preferences.space_auto_join_desc': '加入空间后自动加入其中的所有房间',
  'setting.preferences.space_show_subspaces_label': '显示子空间',
  'setting.preferences.space_show_subspaces_desc': '在空间列表中显示嵌套的子空间',
  'setting.preferences.space_notification_label': '空间默认通知',
  'setting.preferences.space_notification_desc': '新加入空间的默认通知级别',
  'setting.preferences.privacy_section': '隐私偏好',
  'setting.preferences.read_receipts_label': '发送已读回执',
  'setting.preferences.read_receipts_desc': '让对方知道你已读消息',
  'setting.preferences.typing_notifications_label': '发送输入状态',
  'setting.preferences.typing_notifications_desc': '让对方看到你正在输入',
  'setting.preferences.notification_all_messages': '所有消息',
  'setting.preferences.notification_participating_only': '仅参与的',
  'setting.preferences.notification_mentions_only': '仅提及',
  'setting.preferences.notification_none': '无通知',
  'setting.preferences.feedback.enabled': '已启用{label}',
  'setting.preferences.feedback.disabled': '已禁用{label}',
  'setting.preferences.feedback.option_set': '{label}已设置为 {value}',
  'setting.preferences.feedback.read_auto_startup_failed': '读取开机启动状态失败',
  'setting.preferences.feedback.initialize_storage_scan_failed': '初始化存储扫描失败',
  'setting.preferences.feedback.auto_startup_change_failed': '设置开机启动失败',
  'setting.storage.path_type_default': '默认目录',
  'setting.storage.path_type_custom': '自定义目录',
  'setting.storage.fetching_directory': '正在获取目录路径...',
  'setting.storage.select_directory': '选择目录',
  'setting.storage.start_scan': '开始扫描',
  'setting.storage.scanning': '扫描中...',
  'setting.storage.select_directory_title': '选择要扫描的目录',
  'setting.storage.select_directory_error': '选择目录失败',
  'setting.storage.processed_files': '已处理文件',
  'setting.storage.processed_files_unit': '{count} 个',
  'setting.storage.total_size': '累计大小',
  'setting.burn_after_read.durations.30_seconds': '30秒',
  'setting.burn_after_read.durations.1_minute': '1分钟',
  'setting.burn_after_read.durations.5_minutes': '5分钟',
  'setting.burn_after_read.durations.1_hour': '1小时',
  'setting.burn_after_read.durations.24_hours': '24小时'
}

type SelectOption = {
  label: string
  value: string
}

type PreferencesSettingsVm = ComponentPublicInstance & {
  language: string
  sendKey: string
  messageConfirm: boolean
  linkPreview: boolean
  emojiConvert: boolean
  emojiSize: string
  burnDefaultEnabled: boolean
  burnDefaultDuration: number
  burnShowCountdown: boolean
  threadAutoSubscribe: boolean
  threadShowInRoom: boolean
  threadNotificationLevel: string
  spaceAutoJoinRooms: boolean
  spaceShowSubspaces: boolean
  spaceDefaultNotification: string
  sendReadReceipts: boolean
  sendTypingNotifications: boolean
  languageOptions: SelectOption[]
  sendKeyOptions: SelectOption[]
  handleConfirmChange: (value: boolean) => void
  handleLinkPreviewChange: (value: boolean) => void
  handleEmojiChange: (value: boolean) => void
  handleEmojiSizeChange: (value: string) => void
  handleSendKeyChange: (value: string) => void
  handleBurnDefaultToggle: (value: boolean) => void
  handleBurnDurationChange: (value: number) => void
  handleBurnCountdownToggle: (value: boolean) => void
  handleThreadAutoSubscribe: (value: boolean) => void
  handleThreadShowInRoom: (value: boolean) => void
  handleThreadNotificationChange: (value: string) => void
  handleSpaceAutoJoin: (value: boolean) => void
  handleSpaceShowSubspaces: (value: boolean) => void
  handleSpaceNotificationChange: (value: string) => void
  handleReadReceiptsToggle: (value: boolean) => void
  handleTypingToggle: (value: boolean) => void
}

const settingStoreMock = {
  chat: { sendKey: 'Enter' },
  autoLoginEnabled: false,
  autoStartupEnabled: false,
  languagePreference: 'AUTO',
  sendMessageShortcut: 'Enter',
  messageConfirmEnabled: false,
  linkPreviewEnabled: true,
  emojiConvertEnabled: true,
  emojiSize: 'medium',
  burnDefaultEnabled: false,
  burnDefaultDuration: 60,
  burnShowCountdownEnabled: true,
  threadAutoSubscribeEnabled: true,
  threadShowInRoomEnabled: true,
  threadNotificationLevel: 'participate',
  spaceAutoJoinRoomsEnabled: false,
  spaceShowSubspacesEnabled: true,
  spaceDefaultNotification: 'all_messages',
  sendReadReceiptsEnabled: true,
  sendTypingNotificationsEnabled: true,
  migrateLegacyPreferenceSettings: () => migrateLegacyPreferenceSettingsMock(),
  setAutoLogin: (value: boolean) => setAutoLoginMock(value),
  setAutoStartup: (value: boolean) => setAutoStartupMock(value),
  setSendMessageShortcut: (value: string) => setSendMessageShortcutMock(value),
  setMessageConfirmEnabled: (value: boolean) => setMessageConfirmEnabledMock(value),
  setLinkPreviewEnabled: (value: boolean) => setLinkPreviewEnabledMock(value),
  setEmojiConvertEnabled: (value: boolean) => setEmojiConvertEnabledMock(value),
  setEmojiSize: (value: string) => setEmojiSizeMock(value),
  setBurnDefaultEnabled: (value: boolean) => setBurnDefaultEnabledMock(value),
  setBurnDefaultDuration: (value: number) => setBurnDefaultDurationMock(value),
  setBurnShowCountdownEnabled: (value: boolean) => setBurnShowCountdownEnabledMock(value),
  setThreadAutoSubscribeEnabled: (value: boolean) => setThreadAutoSubscribeEnabledMock(value),
  setThreadShowInRoomEnabled: (value: boolean) => setThreadShowInRoomEnabledMock(value),
  setThreadNotificationLevel: (value: string) => setThreadNotificationLevelMock(value),
  setSpaceAutoJoinRoomsEnabled: (value: boolean) => setSpaceAutoJoinRoomsEnabledMock(value),
  setSpaceShowSubspacesEnabled: (value: boolean) => setSpaceShowSubspacesEnabledMock(value),
  setSpaceDefaultNotification: (value: string) => setSpaceDefaultNotificationMock(value),
  setSendReadReceiptsEnabled: (value: boolean) => setSendReadReceiptsEnabledMock(value),
  setSendTypingNotificationsEnabled: (value: boolean) => setSendTypingNotificationsEnabledMock(value)
}

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>' },
  NProgress: { name: 'NProgress', template: '<div class="n-progress" />', props: ['percentage'] },
  NRadio: { name: 'NRadio', template: '<label><slot /></label>', props: ['value'] },
  NRadioGroup: { name: 'NRadioGroup', template: '<div class="n-radio-group"><slot /></div>', props: ['value'] },
  NSelect: { name: 'NSelect', template: '<select><slot /></select>', props: ['value', 'options'] },
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock, error: messageErrorMock })
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()
  const { ref } = await import('vue')
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(store)
          .filter(([, value]) => typeof value !== 'function')
          .map(([key, value]) => [key, ref(value)])
      )
  }
})

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStoreMock
}))

vi.mock('@/stores/domains/widget/scanner', () => ({
  useScannerStore: () => ({
    pathType: 'default',
    currentDirectory: '',
    scanning: false,
    showDiskUsage: false,
    diskInfo: null,
    scanProgress: { total_size: 0 },
    scanningProgress: 0,
    initializeScanner: vi.fn(),
    setPathType: vi.fn(),
    setCustomDirectory: vi.fn(),
    startScan: vi.fn()
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => false
}))

vi.mock('@tauri-apps/plugin-autostart', () => ({
  disable: vi.fn(),
  enable: vi.fn(),
  isEnabled: vi.fn(async () => false)
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => null)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'AUTO' },
    t: (key: string, params?: Record<string, string | number>) => {
      const template = translationMap[key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
        template
      )
    }
  })
}))

describe('PreferencesSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as PreferencesSettingsVm

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    settingStoreMock.chat.sendKey = 'Enter'
    settingStoreMock.autoLoginEnabled = false
    settingStoreMock.autoStartupEnabled = false
    settingStoreMock.languagePreference = 'AUTO'
    settingStoreMock.sendMessageShortcut = 'Enter'
    settingStoreMock.messageConfirmEnabled = false
    settingStoreMock.linkPreviewEnabled = true
    settingStoreMock.emojiConvertEnabled = true
    settingStoreMock.emojiSize = 'medium'
    settingStoreMock.burnDefaultEnabled = false
    settingStoreMock.burnDefaultDuration = 60
    settingStoreMock.burnShowCountdownEnabled = true
    settingStoreMock.threadAutoSubscribeEnabled = true
    settingStoreMock.threadShowInRoomEnabled = true
    settingStoreMock.threadNotificationLevel = 'participate'
    settingStoreMock.spaceAutoJoinRoomsEnabled = false
    settingStoreMock.spaceShowSubspacesEnabled = true
    settingStoreMock.spaceDefaultNotification = 'all_messages'
    settingStoreMock.sendReadReceiptsEnabled = true
    settingStoreMock.sendTypingNotificationsEnabled = true
  })

  it('renders correctly', () => {
    const wrapper = mount(PreferencesSettings)
    expect(wrapper.find('.preferences-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('语言')
  })

  it('has correct default values', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.language).toBe('AUTO')
    expect(vm.sendKey).toBe('Enter')
    expect(vm.messageConfirm).toBe(false)
    expect(vm.linkPreview).toBe(true)
    expect(vm.emojiConvert).toBe(true)
    expect(vm.emojiSize).toBe('medium')
  })

  it('loads message confirm from settingStore getter', () => {
    settingStoreMock.messageConfirmEnabled = true
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).messageConfirm).toBe(true)
  })

  it('loads link preview from settingStore getter', () => {
    settingStoreMock.linkPreviewEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).linkPreview).toBe(false)
  })

  it('loads emoji convert from settingStore getter', () => {
    settingStoreMock.emojiConvertEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).emojiConvert).toBe(false)
  })

  it('loads emoji size from settingStore getter', () => {
    settingStoreMock.emojiSize = 'large'
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).emojiSize).toBe('large')
  })

  it('calls settingStore on emoji size change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleEmojiSizeChange('large')
    expect(setEmojiSizeMock).toHaveBeenCalledWith('large')
  })

  it('calls settingStore on message confirm change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleConfirmChange(true)
    expect(setMessageConfirmEnabledMock).toHaveBeenCalledWith(true)
    expect(messageSuccessMock).toHaveBeenCalledWith('已启用消息确认')
  })

  it('calls settingStore on link preview change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleLinkPreviewChange(false)
    expect(setLinkPreviewEnabledMock).toHaveBeenCalledWith(false)
  })

  it('calls settingStore on emoji convert change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleEmojiChange(false)
    expect(setEmojiConvertEnabledMock).toHaveBeenCalledWith(false)
  })

  it('calls settingStore on send key change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleSendKeyChange('Ctrl+Enter')
    expect(setSendMessageShortcutMock).toHaveBeenCalledWith('Ctrl+Enter')
    expect(messageSuccessMock).toHaveBeenCalledWith('发送键已设置为 Ctrl + Enter')
  })

  it('has burn after read defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.burnDefaultEnabled).toBe(false)
    expect(vm.burnDefaultDuration).toBe(60)
    expect(vm.burnShowCountdown).toBe(true)
  })

  it('loads burn defaults from settingStore', () => {
    settingStoreMock.burnDefaultEnabled = true
    settingStoreMock.burnDefaultDuration = 300
    settingStoreMock.burnShowCountdownEnabled = false
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.burnDefaultEnabled).toBe(true)
    expect(vm.burnDefaultDuration).toBe(300)
    expect(vm.burnShowCountdown).toBe(false)
  })

  it('calls settingStore on burn default toggle', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleBurnDefaultToggle(true)
    expect(setBurnDefaultEnabledMock).toHaveBeenCalledWith(true)
  })

  it('calls settingStore on burn duration change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleBurnDurationChange(300)
    expect(setBurnDefaultDurationMock).toHaveBeenCalledWith(300)
  })

  it('calls settingStore on burn countdown toggle', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleBurnCountdownToggle(false)
    expect(setBurnShowCountdownEnabledMock).toHaveBeenCalledWith(false)
  })

  it('has thread preference defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.threadAutoSubscribe).toBe(true)
    expect(vm.threadShowInRoom).toBe(true)
    expect(vm.threadNotificationLevel).toBe('participate')
  })

  it('loads thread preferences from settingStore', () => {
    settingStoreMock.threadAutoSubscribeEnabled = false
    settingStoreMock.threadShowInRoomEnabled = false
    settingStoreMock.threadNotificationLevel = 'all'
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.threadAutoSubscribe).toBe(false)
    expect(vm.threadShowInRoom).toBe(false)
    expect(vm.threadNotificationLevel).toBe('all')
  })

  it('calls settingStore for thread preferences', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleThreadAutoSubscribe(false)
    expect(setThreadAutoSubscribeEnabledMock).toHaveBeenCalledWith(false)
    vm.handleThreadShowInRoom(false)
    expect(setThreadShowInRoomEnabledMock).toHaveBeenCalledWith(false)
    vm.handleThreadNotificationChange('none')
    expect(setThreadNotificationLevelMock).toHaveBeenCalledWith('none')
  })

  it('has space preference defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.spaceAutoJoinRooms).toBe(false)
    expect(vm.spaceShowSubspaces).toBe(true)
    expect(vm.spaceDefaultNotification).toBe('all_messages')
  })

  it('loads space preferences from settingStore', () => {
    settingStoreMock.spaceAutoJoinRoomsEnabled = true
    settingStoreMock.spaceShowSubspacesEnabled = false
    settingStoreMock.spaceDefaultNotification = 'mentions_only'
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.spaceAutoJoinRooms).toBe(true)
    expect(vm.spaceShowSubspaces).toBe(false)
    expect(vm.spaceDefaultNotification).toBe('mentions_only')
  })

  it('calls settingStore for space preferences', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleSpaceAutoJoin(true)
    expect(setSpaceAutoJoinRoomsEnabledMock).toHaveBeenCalledWith(true)
    vm.handleSpaceShowSubspaces(false)
    expect(setSpaceShowSubspacesEnabledMock).toHaveBeenCalledWith(false)
    vm.handleSpaceNotificationChange('none')
    expect(setSpaceDefaultNotificationMock).toHaveBeenCalledWith('none')
  })

  it('has privacy preference defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.sendReadReceipts).toBe(true)
    expect(vm.sendTypingNotifications).toBe(true)
  })

  it('loads privacy preferences from settingStore', () => {
    settingStoreMock.sendReadReceiptsEnabled = false
    settingStoreMock.sendTypingNotificationsEnabled = false
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.sendReadReceipts).toBe(false)
    expect(vm.sendTypingNotifications).toBe(false)
  })

  it('calls settingStore for privacy preference toggles', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleReadReceiptsToggle(false)
    expect(setSendReadReceiptsEnabledMock).toHaveBeenCalledWith(false)
    vm.handleTypingToggle(false)
    expect(setSendTypingNotificationsEnabledMock).toHaveBeenCalledWith(false)
  })

  it('has correct language options', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.languageOptions).toHaveLength(5)
    expect(vm.languageOptions.map((o) => o.value)).toEqual(['AUTO', 'zh-CN', 'zh-TW', 'en', 'ja'])
    expect(vm.languageOptions[0].label).toBe('自动检测')
  })

  it('has correct send key options', () => {
    const wrapper = mount(PreferencesSettings)
    const sendKeyOptions = getVm(wrapper).sendKeyOptions
    expect(sendKeyOptions).toHaveLength(3)
    expect(sendKeyOptions.map((option) => option.label)).toEqual(['Enter', 'Ctrl + Enter', 'Shift + Enter'])
  })
})
