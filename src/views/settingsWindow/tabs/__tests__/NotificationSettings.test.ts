import { mount } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationSettings from '../NotificationSettings.vue'

const messageSuccessMock = vi.fn()
const messageWarningMock = vi.fn()
const setMessageSoundEnabledMock = vi.fn()
const setNotificationVolumeMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.notification.desktop.title': '桌面通知',
  'setting.notification.push_section.title': '推送与规则'
}

type NotificationSettingsVm = ComponentPublicInstance & {
  desktopNotification: boolean
  showMessageContent: boolean
  showSenderName: boolean
  keywords: string[]
  keywordNotification: boolean
  newKeyword: string
  threadReplyNotify: boolean
  threadParticipateNotify: boolean
  threadMentionNotify: boolean
  spaceNewRoomNotify: boolean
  spaceMemberChangeNotify: boolean
  friendRequestNotify: boolean
  friendAcceptNotify: boolean
  addKeyword: () => void
  removeKeyword: (keyword: string) => void
  handleContentChange: (value: boolean) => void
  handleSenderChange: (value: boolean) => void
  handleKeywordToggle: (value: boolean) => void
  handleSoundChange: (value: boolean) => void
  handleVolumeChange: (value: number) => void
  handleThreadReplyNotify: (value: boolean) => void
  handleThreadParticipateNotify: (value: boolean) => void
  handleThreadMentionNotify: (value: boolean) => void
  handleSpaceNewRoomNotify: (value: boolean) => void
  handleSpaceMemberChangeNotify: (value: boolean) => void
  handleFriendRequestNotify: (value: boolean) => void
  handleFriendAcceptNotify: (value: boolean) => void
}

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NSlider: { name: 'NSlider', template: '<div class="n-slider" />', props: ['value', 'min', 'max', 'step'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'placeholder'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['type'] },
  NTag: { name: 'NTag', template: '<span class="n-tag"><slot /></span>', props: ['closable'] },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (!params) {
        return translationMap[key] ?? key
      }

      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        translationMap[key] ?? key
      )
    }
  })
}))

vi.mock('@/views/settingsWindow/tabs/PushSettings.vue', () => ({
  default: {
    name: 'PushSettings',
    template: '<div class="push-settings-stub">Push Settings Stub</div>'
  }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    messageSoundEnabled: true,
    notificationVolume: 80,
    setMessageSoundEnabled: (value: boolean) => setMessageSoundEnabledMock(value),
    setNotificationVolume: (value: number) => setNotificationVolumeMock(value)
  })
}))

describe('NotificationSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as NotificationSettingsVm

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(NotificationSettings)
    expect(wrapper.find('.notification-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('桌面通知')
    expect(wrapper.text()).toContain('推送与规则')
    expect(wrapper.find('.push-settings-stub').exists()).toBe(true)
  })

  it('has desktop notification enabled by default', () => {
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).desktopNotification).toBe(true)
  })

  it('loads desktop notification from localStorage', () => {
    localStorage.setItem('hula-desktop-notification', 'false')
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).desktopNotification).toBe(false)
  })

  it('loads message content setting from localStorage', () => {
    localStorage.setItem('hula-show-content', 'false')
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).showMessageContent).toBe(false)
  })

  it('loads sender name setting from localStorage', () => {
    localStorage.setItem('hula-show-sender', 'false')
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).showSenderName).toBe(false)
  })

  it('loads keywords from localStorage', () => {
    localStorage.setItem('hula-keywords', JSON.stringify(['urgent', 'important']))
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).keywords).toEqual(['urgent', 'important'])
  })

  it('loads keyword notification from localStorage', () => {
    localStorage.setItem('hula-keyword-notification', 'true')
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).keywordNotification).toBe(true)
  })

  it('adds keyword and saves to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.newKeyword = 'test-keyword'
    vm.addKeyword()
    expect(vm.keywords).toContain('test-keyword')
    expect(JSON.parse(localStorage.getItem('hula-keywords')!)).toContain('test-keyword')
    expect(vm.newKeyword).toBe('')
  })

  it('does not add duplicate keyword', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.keywords = ['existing']
    vm.newKeyword = 'existing'
    vm.addKeyword()
    expect(vm.keywords).toHaveLength(1)
  })

  it('removes keyword and saves to localStorage', () => {
    localStorage.setItem('hula-keywords', JSON.stringify(['a', 'b', 'c']))
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.removeKeyword('b')
    expect(vm.keywords).not.toContain('b')
    expect(vm.keywords).toHaveLength(2)
  })

  it('saves content visibility to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleContentChange(false)
    expect(localStorage.getItem('hula-show-content')).toBe('false')
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('saves sender visibility to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleSenderChange(false)
    expect(localStorage.getItem('hula-show-sender')).toBe('false')
  })

  it('saves keyword toggle to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleKeywordToggle(true)
    expect(localStorage.getItem('hula-keyword-notification')).toBe('true')
  })

  it('calls settingStore on sound change', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleSoundChange(false)
    expect(setMessageSoundEnabledMock).toHaveBeenCalledWith(false)
  })

  it('calls settingStore on volume change', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleVolumeChange(50)
    expect(setNotificationVolumeMock).toHaveBeenCalledWith(50)
  })

  it('loads thread notification settings from localStorage', () => {
    localStorage.setItem('hula-thread-reply-notify', 'false')
    localStorage.setItem('hula-thread-participate-notify', 'false')
    localStorage.setItem('hula-thread-mention-notify', 'false')
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    expect(vm.threadReplyNotify).toBe(false)
    expect(vm.threadParticipateNotify).toBe(false)
    expect(vm.threadMentionNotify).toBe(false)
  })

  it('saves thread notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleThreadReplyNotify(false)
    expect(localStorage.getItem('hula-thread-reply-notify')).toBe('false')
    vm.handleThreadParticipateNotify(false)
    expect(localStorage.getItem('hula-thread-participate-notify')).toBe('false')
    vm.handleThreadMentionNotify(false)
    expect(localStorage.getItem('hula-thread-mention-notify')).toBe('false')
  })

  it('loads space notification settings from localStorage', () => {
    localStorage.setItem('hula-space-new-room-notify', 'false')
    localStorage.setItem('hula-space-member-change-notify', 'true')
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    expect(vm.spaceNewRoomNotify).toBe(false)
    expect(vm.spaceMemberChangeNotify).toBe(true)
  })

  it('saves space notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleSpaceNewRoomNotify(false)
    expect(localStorage.getItem('hula-space-new-room-notify')).toBe('false')
    vm.handleSpaceMemberChangeNotify(true)
    expect(localStorage.getItem('hula-space-member-change-notify')).toBe('true')
  })

  it('loads friend notification settings from localStorage', () => {
    localStorage.setItem('hula-friend-request-notify', 'false')
    localStorage.setItem('hula-friend-accept-notify', 'false')
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    expect(vm.friendRequestNotify).toBe(false)
    expect(vm.friendAcceptNotify).toBe(false)
  })

  it('saves friend notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleFriendRequestNotify(false)
    expect(localStorage.getItem('hula-friend-request-notify')).toBe('false')
    vm.handleFriendAcceptNotify(false)
    expect(localStorage.getItem('hula-friend-accept-notify')).toBe('false')
  })
})
