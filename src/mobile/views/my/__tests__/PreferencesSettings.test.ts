import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreferencesSettings from '../PreferencesSettings.vue'

const showToastMock = vi.fn()
const setSendMessageShortcutMock = vi.fn()

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
  useSettingStore: () => ({
    setSendMessageShortcut: (...args: any[]) => setSendMessageShortcutMock(...args)
  })
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

  it('loads messageConfirm from localStorage', () => {
    localStorage.setItem('hula-message-confirm', 'true')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).messageConfirm).toBe(true)
  })

  it('loads linkPreview from localStorage', () => {
    localStorage.setItem('hula-link-preview', 'false')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).linkPreview).toBe(false)
  })

  it('loads burnDefaultEnabled from localStorage', () => {
    localStorage.setItem('hula-burn-default-enabled', 'true')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDefaultEnabled).toBe(true)
  })

  it('loads threadAutoSubscribe from localStorage', () => {
    localStorage.setItem('hula-thread-auto-subscribe', 'false')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).threadAutoSubscribe).toBe(false)
  })

  it('loads sendReadReceipts from localStorage', () => {
    localStorage.setItem('hula-send-read-receipts', 'false')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendReadReceipts).toBe(false)
  })

  it('saves toggle to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.handleToggle('hula-message-confirm', true)
    expect(localStorage.getItem('hula-message-confirm')).toBe('true')
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

  it('handleBurnDurationConfirm saves to localStorage', () => {
    const wrapper = mount(PreferencesSettings)
    const vm = wrapper.vm as any
    vm.handleBurnDurationConfirm({ selectedValues: [300] })
    expect(localStorage.getItem('hula-burn-default-duration')).toBe('300')
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

  it('loads burnDefaultDuration from localStorage', () => {
    localStorage.setItem('hula-burn-default-duration', '3600')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).burnDefaultDuration).toBe(3600)
  })

  it('loads sendTypingNotifications from localStorage', () => {
    localStorage.setItem('hula-send-typing-notifications', 'false')
    const wrapper = mount(PreferencesSettings)
    expect((wrapper.vm as any).sendTypingNotifications).toBe(false)
  })
})
