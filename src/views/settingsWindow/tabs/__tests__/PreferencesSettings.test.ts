import { mount } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreferencesSettings from '../PreferencesSettings.vue'

const messageSuccessMock = vi.fn()
const setSendMessageShortcutMock = vi.fn()

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

vi.mock('naive-ui', () => ({
  NSelect: { name: 'NSelect', template: '<select><slot /></select>', props: ['value', 'options'] },
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  useMessage: () => ({ success: messageSuccessMock })
}))

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    chat: { value: { sendKey: 'Enter' } },
    page: { value: { lang: 'AUTO' } }
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    page: { lang: 'AUTO' },
    chat: { sendKey: 'Enter' },
    setSendMessageShortcut: (value: string) => setSendMessageShortcutMock(value)
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: { value: 'AUTO' } })
}))

describe('PreferencesSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as PreferencesSettingsVm

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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

  it('loads message confirm from localStorage', () => {
    localStorage.setItem('hula-message-confirm', 'true')
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).messageConfirm).toBe(true)
  })

  it('loads link preview from localStorage', () => {
    localStorage.setItem('hula-link-preview', 'false')
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).linkPreview).toBe(false)
  })

  it('loads emoji convert from localStorage', () => {
    localStorage.setItem('hula-emoji-convert', 'false')
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).emojiConvert).toBe(false)
  })

  it('loads emoji size from localStorage', () => {
    localStorage.setItem('hula-emoji-size', 'large')
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).emojiSize).toBe('large')
  })

  it('saves message confirm to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleConfirmChange(true)
    expect(localStorage.getItem('hula-message-confirm')).toBe('true')
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('saves link preview to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleLinkPreviewChange(false)
    expect(localStorage.getItem('hula-link-preview')).toBe('false')
  })

  it('saves emoji convert to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleEmojiChange(false)
    expect(localStorage.getItem('hula-emoji-convert')).toBe('false')
  })

  it('calls settingStore on send key change', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleSendKeyChange('Ctrl+Enter')
    expect(setSendMessageShortcutMock).toHaveBeenCalledWith('Ctrl+Enter')
  })

  it('has burn after read defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.burnDefaultEnabled).toBe(false)
    expect(vm.burnDefaultDuration).toBe(60)
    expect(vm.burnShowCountdown).toBe(true)
  })

  it('loads burn defaults from localStorage', () => {
    localStorage.setItem('hula-burn-default-enabled', 'true')
    localStorage.setItem('hula-burn-default-duration', '300')
    localStorage.setItem('hula-burn-show-countdown', 'false')
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.burnDefaultEnabled).toBe(true)
    expect(vm.burnDefaultDuration).toBe(300)
    expect(vm.burnShowCountdown).toBe(false)
  })

  it('saves burn default toggle to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleBurnDefaultToggle(true)
    expect(localStorage.getItem('hula-burn-default-enabled')).toBe('true')
  })

  it('saves burn duration to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleBurnDurationChange(300)
    expect(localStorage.getItem('hula-burn-default-duration')).toBe('300')
  })

  it('saves burn countdown toggle to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleBurnCountdownToggle(false)
    expect(localStorage.getItem('hula-burn-show-countdown')).toBe('false')
  })

  it('has thread preference defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.threadAutoSubscribe).toBe(true)
    expect(vm.threadShowInRoom).toBe(true)
    expect(vm.threadNotificationLevel).toBe('participate')
  })

  it('loads thread preferences from localStorage', () => {
    localStorage.setItem('hula-thread-auto-subscribe', 'false')
    localStorage.setItem('hula-thread-show-in-room', 'false')
    localStorage.setItem('hula-thread-notification-level', 'all')
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.threadAutoSubscribe).toBe(false)
    expect(vm.threadShowInRoom).toBe(false)
    expect(vm.threadNotificationLevel).toBe('all')
  })

  it('saves thread preferences to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleThreadAutoSubscribe(false)
    expect(localStorage.getItem('hula-thread-auto-subscribe')).toBe('false')
    vm.handleThreadShowInRoom(false)
    expect(localStorage.getItem('hula-thread-show-in-room')).toBe('false')
    vm.handleThreadNotificationChange('none')
    expect(localStorage.getItem('hula-thread-notification-level')).toBe('none')
  })

  it('has space preference defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.spaceAutoJoinRooms).toBe(false)
    expect(vm.spaceShowSubspaces).toBe(true)
    expect(vm.spaceDefaultNotification).toBe('all_messages')
  })

  it('loads space preferences from localStorage', () => {
    localStorage.setItem('hula-space-auto-join', 'true')
    localStorage.setItem('hula-space-show-subspaces', 'false')
    localStorage.setItem('hula-space-default-notification', 'mentions_only')
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.spaceAutoJoinRooms).toBe(true)
    expect(vm.spaceShowSubspaces).toBe(false)
    expect(vm.spaceDefaultNotification).toBe('mentions_only')
  })

  it('saves space preferences to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleSpaceAutoJoin(true)
    expect(localStorage.getItem('hula-space-auto-join')).toBe('true')
    vm.handleSpaceShowSubspaces(false)
    expect(localStorage.getItem('hula-space-show-subspaces')).toBe('false')
    vm.handleSpaceNotificationChange('none')
    expect(localStorage.getItem('hula-space-default-notification')).toBe('none')
  })

  it('has privacy preference defaults', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.sendReadReceipts).toBe(true)
    expect(vm.sendTypingNotifications).toBe(true)
  })

  it('loads privacy preferences from localStorage', () => {
    localStorage.setItem('hula-send-read-receipts', 'false')
    localStorage.setItem('hula-send-typing-notifications', 'false')
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.sendReadReceipts).toBe(false)
    expect(vm.sendTypingNotifications).toBe(false)
  })

  it('saves privacy preferences to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    vm.handleReadReceiptsToggle(false)
    expect(localStorage.getItem('hula-send-read-receipts')).toBe('false')
    vm.handleTypingToggle(false)
    expect(localStorage.getItem('hula-send-typing-notifications')).toBe('false')
  })

  it('has correct language options', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = getVm(wrapper)
    expect(vm.languageOptions).toHaveLength(5)
    expect(vm.languageOptions.map((o) => o.value)).toEqual(['AUTO', 'zh-CN', 'zh-TW', 'en', 'ja'])
  })

  it('has correct send key options', () => {
    const wrapper = mount(PreferencesSettings)
    expect(getVm(wrapper).sendKeyOptions).toHaveLength(3)
  })
})
