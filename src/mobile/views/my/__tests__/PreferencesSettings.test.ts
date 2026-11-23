import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreferencesSettings from '../PreferencesSettings.vue'

const showToastMock = vi.fn()
const setSendMessageShortcutMock = vi.fn()
const setMessageConfirmEnabledMock = vi.fn()
const setLinkPreviewEnabledMock = vi.fn()
const setEmojiConvertEnabledMock = vi.fn()
const setEmojiSizeMock = vi.fn()
const setRecallTimeMock = vi.fn()
const setBurnDefaultEnabledMock = vi.fn()
const setBurnDefaultDurationMock = vi.fn()
const setBurnShowCountdownEnabledMock = vi.fn()
const setThreadAutoSubscribeEnabledMock = vi.fn()
const setThreadShowInRoomEnabledMock = vi.fn()
const setSendReadReceiptsEnabledMock = vi.fn()
const setSendTypingNotificationsEnabledMock = vi.fn()
const migrateLegacyPreferenceSettingsMock = vi.fn()

const settingStoreMock = {
  messageConfirmEnabled: false,
  linkPreviewEnabled: true,
  emojiConvertEnabled: true,
  emojiSize: 'medium',
  recallTime: 120,
  sendMessageShortcut: 'Enter',
  burnDefaultEnabled: false,
  burnDefaultDuration: 60,
  burnShowCountdownEnabled: true,
  threadAutoSubscribeEnabled: true,
  threadShowInRoomEnabled: true,
  sendReadReceiptsEnabled: true,
  sendTypingNotificationsEnabled: true,
  migrateLegacyPreferenceSettings: (...args: any[]) => migrateLegacyPreferenceSettingsMock(...args),
  setMessageConfirmEnabled: (...args: any[]) => setMessageConfirmEnabledMock(...args),
  setLinkPreviewEnabled: (...args: any[]) => setLinkPreviewEnabledMock(...args),
  setEmojiConvertEnabled: (...args: any[]) => setEmojiConvertEnabledMock(...args),
  setEmojiSize: (value: string) => {
    settingStoreMock.emojiSize = value
    setEmojiSizeMock(value)
  },
  setRecallTime: (value: number) => {
    settingStoreMock.recallTime = value
    setRecallTimeMock(value)
  },
  setBurnDefaultEnabled: (...args: any[]) => setBurnDefaultEnabledMock(...args),
  setBurnDefaultDuration: (value: number) => {
    settingStoreMock.burnDefaultDuration = value
    setBurnDefaultDurationMock(value)
  },
  setBurnShowCountdownEnabled: (...args: any[]) => setBurnShowCountdownEnabledMock(...args),
  setThreadAutoSubscribeEnabled: (...args: any[]) => setThreadAutoSubscribeEnabledMock(...args),
  setThreadShowInRoomEnabled: (...args: any[]) => setThreadShowInRoomEnabledMock(...args),
  setSendReadReceiptsEnabled: (...args: any[]) => setSendReadReceiptsEnabledMock(...args),
  setSendTypingNotificationsEnabled: (...args: any[]) => setSendTypingNotificationsEnabledMock(...args),
  setSendMessageShortcut: (value: string) => {
    settingStoreMock.sendMessageShortcut = value
    setSendMessageShortcutMock(value)
  }
}

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStoreMock
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div class="auto-fix"><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div class="header-bar" />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

describe('PreferencesSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    settingStoreMock.messageConfirmEnabled = false
    settingStoreMock.linkPreviewEnabled = true
    settingStoreMock.emojiConvertEnabled = true
    settingStoreMock.emojiSize = 'medium'
    settingStoreMock.recallTime = 120
    settingStoreMock.sendMessageShortcut = 'Enter'
    settingStoreMock.burnDefaultEnabled = false
    settingStoreMock.burnDefaultDuration = 60
    settingStoreMock.burnShowCountdownEnabled = true
    settingStoreMock.threadAutoSubscribeEnabled = true
    settingStoreMock.threadShowInRoomEnabled = true
    settingStoreMock.sendReadReceiptsEnabled = true
    settingStoreMock.sendTypingNotificationsEnabled = true
  })

  it('renders correctly', () => {
    const wrapper = mount(PreferencesSettings)
    expect(wrapper.html()).not.toBe('')
  })

  it('has correct default values', () => {
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).messageConfirm).toBe(false)
    expect((wrapper.vm as any).linkPreview).toBe(true)
    expect((wrapper.vm as any).emojiConvert).toBe(true)
    expect((wrapper.vm as any).emojiSize).toBe('medium')
    expect((wrapper.vm as any).recallTime).toBe(120)
    expect((wrapper.vm as any).sendKey).toBe('Enter')
    expect((wrapper.vm as any).burnDefaultEnabled).toBe(false)
    expect((wrapper.vm as any).burnShowCountdown).toBe(true)
    expect((wrapper.vm as any).threadAutoSubscribe).toBe(true)
    expect((wrapper.vm as any).threadShowInRoom).toBe(true)
    expect((wrapper.vm as any).sendReadReceipts).toBe(true)
    expect((wrapper.vm as any).sendTypingNotifications).toBe(true)
  })

  it('loads messageConfirm from settingStore getter', () => {
    settingStoreMock.messageConfirmEnabled = true
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).messageConfirm).toBe(true)
  })

  it('loads linkPreview from settingStore getter', () => {
    settingStoreMock.linkPreviewEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).linkPreview).toBe(false)
  })

  it('loads burnDefaultEnabled from settingStore getter', () => {
    settingStoreMock.burnDefaultEnabled = true
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDefaultEnabled).toBe(true)
  })

  it('loads threadAutoSubscribe from settingStore getter', () => {
    settingStoreMock.threadAutoSubscribeEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).threadAutoSubscribe).toBe(false)
  })

  it('loads sendReadReceipts from settingStore getter', () => {
    settingStoreMock.sendReadReceiptsEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendReadReceipts).toBe(false)
  })

  it('writes preference toggles back to settingStore', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.messageConfirm = true
    vm.linkPreview = false
    vm.emojiConvert = false
    vm.burnDefaultEnabled = true
    vm.burnShowCountdown = false
    vm.threadAutoSubscribe = false
    vm.threadShowInRoom = false
    vm.sendReadReceipts = false
    vm.sendTypingNotifications = false
    expect(setMessageConfirmEnabledMock).toHaveBeenCalledWith(true)
    expect(setLinkPreviewEnabledMock).toHaveBeenCalledWith(false)
    expect(setEmojiConvertEnabledMock).toHaveBeenCalledWith(false)
    expect(setBurnDefaultEnabledMock).toHaveBeenCalledWith(true)
    expect(setBurnShowCountdownEnabledMock).toHaveBeenCalledWith(false)
    expect(setThreadAutoSubscribeEnabledMock).toHaveBeenCalledWith(false)
    expect(setThreadShowInRoomEnabledMock).toHaveBeenCalledWith(false)
    expect(setSendReadReceiptsEnabledMock).toHaveBeenCalledWith(false)
    expect(setSendTypingNotificationsEnabledMock).toHaveBeenCalledWith(false)
  })

  it('loads sendKey from settingStore instead of a local duplicate', () => {
    settingStoreMock.sendMessageShortcut = 'Ctrl+Enter'
    localStorage.setItem('tjg-send-key', 'Shift+Enter')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendKey).toBe('Ctrl+Enter')
  })

  it('handleSendKeyConfirm writes through settingStore only', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.sendKeyPicker.show = true
    vm.sendKeyPicker.confirm({ selectedValues: ['Ctrl+Enter'] })
    expect(setSendMessageShortcutMock).toHaveBeenCalledWith('Ctrl+Enter')
    expect(localStorage.getItem('tjg-send-key')).toBeNull()
    expect(vm.sendKeyPicker.show).toBe(false)
  })

  it('handleBurnDurationConfirm saves to settingStore', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.burnDurationPicker.confirm({ selectedValues: [300] })
    expect(setBurnDefaultDurationMock).toHaveBeenCalledWith(300)
    expect(vm.burnDurationPicker.show).toBe(false)
  })

  it('sendKeyLabel returns correct label', () => {
    settingStoreMock.sendMessageShortcut = 'Ctrl+Enter'
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendKeyPicker.label).toBe('Ctrl + Enter')
  })

  it('burnDurationLabel returns correct label', () => {
    settingStoreMock.burnDefaultDuration = 300
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDurationPicker.label).toBe('5分钟')
  })

  it('loads burnDefaultDuration from settingStore getter', () => {
    settingStoreMock.burnDefaultDuration = 1800
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDefaultDuration).toBe(1800)
  })

  it('loads sendTypingNotifications from settingStore getter', () => {
    settingStoreMock.sendTypingNotificationsEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendTypingNotifications).toBe(false)
  })

  it('handleRecallTimeConfirm saves to settingStore', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.recallTimePicker.confirm({ selectedValues: [600] })
    expect(setRecallTimeMock).toHaveBeenCalledWith(600)
    expect(vm.recallTimePicker.show).toBe(false)
  })

  it('handleEmojiSizeConfirm saves to settingStore', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.emojiSizePicker.confirm({ selectedValues: ['large'] })
    expect(setEmojiSizeMock).toHaveBeenCalledWith('large')
    expect(vm.emojiSizePicker.show).toBe(false)
  })

  it('recallTimeLabel and emojiSizeLabel return correct labels', () => {
    settingStoreMock.recallTime = 300
    settingStoreMock.emojiSize = 'small'
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).recallTimePicker.label).toBe('5 分钟')
    expect((wrapper.vm as any).emojiSizePicker.label).toBe('小')
  })
})
