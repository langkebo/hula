import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationSettings from '../NotificationSettings.vue'

const messageSuccessMock = vi.fn()
const messageWarningMock = vi.fn()
const setMessageSoundEnabledMock = vi.fn()
const setNotificationVolumeMock = vi.fn()

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NSlider: { name: 'NSlider', template: '<div class="n-slider" />', props: ['value', 'min', 'max', 'step'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'placeholder'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['type'] },
  NTag: { name: 'NTag', template: '<span class="n-tag"><slot /></span>', props: ['closable'] },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock })
}))

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    notification: { value: { messageSound: true, volume: 80 } }
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    notification: { messageSound: true, volume: 80 },
    setMessageSoundEnabled: (...args: any[]) => setMessageSoundEnabledMock(...args),
    setNotificationVolume: (...args: any[]) => setNotificationVolumeMock(...args)
  })
}))

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(NotificationSettings)
    expect(wrapper.find('.notification-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('桌面通知')
  })

  it('has desktop notification enabled by default', () => {
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).desktopNotification).toBe(true)
  })

  it('loads desktop notification from localStorage', () => {
    localStorage.setItem('hula-desktop-notification', 'false')
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).desktopNotification).toBe(false)
  })

  it('loads message content setting from localStorage', () => {
    localStorage.setItem('hula-show-content', 'false')
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).showMessageContent).toBe(false)
  })

  it('loads sender name setting from localStorage', () => {
    localStorage.setItem('hula-show-sender', 'false')
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).showSenderName).toBe(false)
  })

  it('loads keywords from localStorage', () => {
    localStorage.setItem('hula-keywords', JSON.stringify(['urgent', 'important']))
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).keywords).toEqual(['urgent', 'important'])
  })

  it('loads keyword notification from localStorage', () => {
    localStorage.setItem('hula-keyword-notification', 'true')
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).keywordNotification).toBe(true)
  })

  it('adds keyword and saves to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.newKeyword = 'test-keyword'
    vm.addKeyword()
    expect((wrapper.vm as any).keywords).toContain('test-keyword')
    expect(JSON.parse(localStorage.getItem('hula-keywords')!)).toContain('test-keyword')
    expect((wrapper.vm as any).newKeyword).toBe('')
  })

  it('does not add duplicate keyword', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.keywords = ['existing']
    vm.newKeyword = 'existing'
    vm.addKeyword()
    expect((wrapper.vm as any).keywords).toHaveLength(1)
  })

  it('removes keyword and saves to localStorage', () => {
    localStorage.setItem('hula-keywords', JSON.stringify(['a', 'b', 'c']))
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.removeKeyword('b')
    expect((wrapper.vm as any).keywords).not.toContain('b')
    expect((wrapper.vm as any).keywords).toHaveLength(2)
  })

  it('saves content visibility to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleContentChange(false)
    expect(localStorage.getItem('hula-show-content')).toBe('false')
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('saves sender visibility to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleSenderChange(false)
    expect(localStorage.getItem('hula-show-sender')).toBe('false')
  })

  it('saves keyword toggle to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleKeywordToggle(true)
    expect(localStorage.getItem('hula-keyword-notification')).toBe('true')
  })

  it('calls settingStore on sound change', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleSoundChange(false)
    expect(setMessageSoundEnabledMock).toHaveBeenCalledWith(false)
  })

  it('calls settingStore on volume change', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleVolumeChange(50)
    expect(setNotificationVolumeMock).toHaveBeenCalledWith(50)
  })

  it('loads thread notification settings from localStorage', () => {
    localStorage.setItem('hula-thread-reply-notify', 'false')
    localStorage.setItem('hula-thread-participate-notify', 'false')
    localStorage.setItem('hula-thread-mention-notify', 'false')
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).threadReplyNotify).toBe(false)
    expect((wrapper.vm as any).threadParticipateNotify).toBe(false)
    expect((wrapper.vm as any).threadMentionNotify).toBe(false)
  })

  it('saves thread notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
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
    expect((wrapper.vm as any).spaceNewRoomNotify).toBe(false)
    expect((wrapper.vm as any).spaceMemberChangeNotify).toBe(true)
  })

  it('saves space notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleSpaceNewRoomNotify(false)
    expect(localStorage.getItem('hula-space-new-room-notify')).toBe('false')
    vm.handleSpaceMemberChangeNotify(true)
    expect(localStorage.getItem('hula-space-member-change-notify')).toBe('true')
  })

  it('loads friend notification settings from localStorage', () => {
    localStorage.setItem('hula-friend-request-notify', 'false')
    localStorage.setItem('hula-friend-accept-notify', 'false')
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).friendRequestNotify).toBe(false)
    expect((wrapper.vm as any).friendAcceptNotify).toBe(false)
  })

  it('saves friend notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleFriendRequestNotify(false)
    expect(localStorage.getItem('hula-friend-request-notify')).toBe('false')
    vm.handleFriendAcceptNotify(false)
    expect(localStorage.getItem('hula-friend-accept-notify')).toBe('false')
  })
})
