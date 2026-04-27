import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreferencesSettings from '../PreferencesSettings.vue'

const showToastMock = vi.fn()
const setSendMessageShortcutMock = vi.fn()
const setMessageConfirmEnabledMock = vi.fn()
const setLinkPreviewEnabledMock = vi.fn()
const setEmojiConvertEnabledMock = vi.fn()
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
  setBurnDefaultEnabled: (...args: any[]) => setBurnDefaultEnabledMock(...args),
  setBurnDefaultDuration: (...args: any[]) => setBurnDefaultDurationMock(...args),
  setBurnShowCountdownEnabled: (...args: any[]) => setBurnShowCountdownEnabledMock(...args),
  setThreadAutoSubscribeEnabled: (...args: any[]) => setThreadAutoSubscribeEnabledMock(...args),
  setThreadShowInRoomEnabled: (...args: any[]) => setThreadShowInRoomEnabledMock(...args),
  setSendReadReceiptsEnabled: (...args: any[]) => setSendReadReceiptsEnabledMock(...args),
  setSendTypingNotificationsEnabled: (...args: any[]) => setSendTypingNotificationsEnabledMock(...args),
  setSendMessageShortcut: (...args: any[]) => setSendMessageShortcutMock(...args)
}

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
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
    expect(wrapper.html()).toBeTruthy()
  })

  it('has correct default values', () => {
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).messageConfirm).toBe(false)
    expect((wrapper.vm as any).linkPreview).toBe(true)
    expect((wrapper.vm as any).emojiConvert).toBe(true)
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

  it('calls settingStore on preference toggle', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.handleMessageConfirmChange(true)
    vm.handleLinkPreviewChange(false)
    vm.handleEmojiConvertChange(false)
    vm.handleBurnDefaultEnabledChange(true)
    vm.handleBurnShowCountdownChange(false)
    vm.handleThreadAutoSubscribeChange(false)
    vm.handleThreadShowInRoomChange(false)
    vm.handleReadReceiptsChange(false)
    vm.handleTypingNotificationsChange(false)
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

  it('loads sendKey from localStorage', () => {
    localStorage.setItem('hula-send-key', 'Ctrl+Enter')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendKey).toBe('Ctrl+Enter')
  })

  it('handleSendKeyConfirm saves to localStorage and store', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.handleSendKeyConfirm({ selectedValues: ['Ctrl+Enter'] })
    expect(localStorage.getItem('hula-send-key')).toBe('Ctrl+Enter')
    expect(setSendMessageShortcutMock).toHaveBeenCalledWith('Ctrl+Enter')
    expect((wrapper.vm as any).showSendKeyPicker).toBe(false)
  })

  it('handleBurnDurationConfirm saves to settingStore', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.handleBurnDurationConfirm({ selectedValues: [300] })
    expect(setBurnDefaultDurationMock).toHaveBeenCalledWith(300)
    expect((wrapper.vm as any).burnDefaultDuration).toBe(300)
    expect((wrapper.vm as any).showBurnDurationPicker).toBe(false)
  })

  it('sendKeyLabel returns correct label', () => {
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendKeyLabel).toBe('Enter')
    const vm = wrapper.vm as any
    vm.sendKey = 'Ctrl+Enter'
    expect((wrapper.vm as any).sendKeyLabel).toBe('Ctrl + Enter')
  })

  it('burnDurationLabel returns correct label', () => {
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDurationLabel).toBe('1分钟')
    const vm = wrapper.vm as any
    vm.burnDefaultDuration = 300
    expect((wrapper.vm as any).burnDurationLabel).toBe('5分钟')
  })

  it('loads burnDefaultDuration from settingStore getter', () => {
    settingStoreMock.burnDefaultDuration = 3600
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDefaultDuration).toBe(3600)
  })

  it('loads sendTypingNotifications from settingStore getter', () => {
    settingStoreMock.sendTypingNotificationsEnabled = false
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendTypingNotifications).toBe(false)
  })
})
