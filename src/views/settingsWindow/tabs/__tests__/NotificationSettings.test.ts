import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import NotificationSettings from '../NotificationSettings.vue'

const messageSuccessMock = vi.fn()
const messageWarningMock = vi.fn()
const setMessageSoundEnabledMock = vi.fn()
const setNotificationVolumeMock = vi.fn()

// 真实配置由 MatrixNotificationService 持久化在 tjg-notification-config。
// 组件必须先静态导入本模块，受 ESM 静态导入顺序约束无法用 vi.doMock 拦截，
// 因此在模块作用域用 vi.mock 提供可控桩件（工厂内的引用保持惰性，无 TDZ 风险）。
const notificationConfigMock = {
  enableDesktop: true,
  enableSound: true,
  enableVibrate: true,
  showPreview: true,
  showSender: true,
  showMessageContent: true
}
const updateNotificationConfigMock = vi.fn((partial: Partial<typeof notificationConfigMock>) => {
  Object.assign(notificationConfigMock, partial)
})
const translationMap: Record<string, string> = {
  'setting.notification.desktop.title': '桌面通知',
  'setting.notification.push_section.title': '推送与规则'
}

type NotificationSettingsVm = ComponentPublicInstance & {
  desktopNotification: boolean
  showMessageContent: boolean
  showSenderName: boolean
  notificationConfig: { enableDesktop: boolean; showMessageContent: boolean; showSender: boolean }
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
  handleNotificationChange: (value: boolean) => Promise<void>
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
  NModal: {
    name: 'NModal',
    template: '<div class="n-modal"><slot /></div>',
    props: ['show', 'title', 'positiveText', 'negativeText', 'maskClosable'],
    emits: ['update:show', 'positiveClick', 'negativeClick']
  },
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

vi.mock('@/services/matrix/notifications/MatrixNotificationService', () => ({
  matrixNotificationService: {
    getConfig: () => ({ ...notificationConfigMock }),
    updateConfig: (partial: Partial<typeof notificationConfigMock>) => updateNotificationConfigMock(partial)
  }
}))

describe('NotificationSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as NotificationSettingsVm

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.assign(notificationConfigMock, {
      enableDesktop: true,
      enableSound: true,
      enableVibrate: true,
      showPreview: true,
      showSender: true,
      showMessageContent: true
    })
    ;(window as any).$message = { success: messageSuccessMock, warning: messageWarningMock }
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

  it('loads the three notification toggles from MatrixNotificationService config', async () => {
    Object.assign(notificationConfigMock, {
      enableDesktop: false,
      showMessageContent: false,
      showSender: false
    })

    const wrapper = mount(NotificationSettings)
    await flushPromises()
    const vm = getVm(wrapper)

    expect(vm.notificationConfig.enableDesktop).toBe(false)
    expect(vm.desktopNotification).toBe(false)
    expect(vm.showMessageContent).toBe(false)
    expect(vm.showSenderName).toBe(false)
  })

  it('loads keywords from localStorage', () => {
    localStorage.setItem('tjg-keywords', JSON.stringify(['urgent', 'important']))
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).keywords).toEqual(['urgent', 'important'])
  })

  it('loads keyword notification from localStorage', () => {
    localStorage.setItem('tjg-keyword-notification', 'true')
    const wrapper = mount(NotificationSettings)
    expect(getVm(wrapper).keywordNotification).toBe(true)
  })

  it('adds keyword and saves to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.newKeyword = 'test-keyword'
    vm.addKeyword()
    expect(vm.keywords).toContain('test-keyword')
    expect(JSON.parse(localStorage.getItem('tjg-keywords')!)).toContain('test-keyword')
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
    localStorage.setItem('tjg-keywords', JSON.stringify(['a', 'b', 'c']))
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.removeKeyword('b')
    expect(vm.keywords).not.toContain('b')
    expect(vm.keywords).toHaveLength(2)
  })

  it('saves content visibility through MatrixNotificationService', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleContentChange(false)
    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ showMessageContent: false })
    expect(localStorage.getItem('tjg-show-content')).toBeNull()
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('saves sender visibility through MatrixNotificationService', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleSenderChange(false)
    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ showSender: false })
    expect(localStorage.getItem('tjg-show-sender')).toBeNull()
  })

  it('saves keyword toggle to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleKeywordToggle(true)
    expect(localStorage.getItem('tjg-keyword-notification')).toBe('true')
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
    localStorage.setItem('tjg-thread-reply-notify', 'false')
    localStorage.setItem('tjg-thread-participate-notify', 'false')
    localStorage.setItem('tjg-thread-mention-notify', 'false')
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
    expect(localStorage.getItem('tjg-thread-reply-notify')).toBe('false')
    vm.handleThreadParticipateNotify(false)
    expect(localStorage.getItem('tjg-thread-participate-notify')).toBe('false')
    vm.handleThreadMentionNotify(false)
    expect(localStorage.getItem('tjg-thread-mention-notify')).toBe('false')
  })

  it('loads space notification settings from localStorage', () => {
    localStorage.setItem('tjg-space-new-room-notify', 'false')
    localStorage.setItem('tjg-space-member-change-notify', 'true')
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    expect(vm.spaceNewRoomNotify).toBe(false)
    expect(vm.spaceMemberChangeNotify).toBe(true)
  })

  it('saves space notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleSpaceNewRoomNotify(false)
    expect(localStorage.getItem('tjg-space-new-room-notify')).toBe('false')
    vm.handleSpaceMemberChangeNotify(true)
    expect(localStorage.getItem('tjg-space-member-change-notify')).toBe('true')
  })

  it('loads friend notification settings from localStorage', () => {
    localStorage.setItem('tjg-friend-request-notify', 'false')
    localStorage.setItem('tjg-friend-accept-notify', 'false')
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    expect(vm.friendRequestNotify).toBe(false)
    expect(vm.friendAcceptNotify).toBe(false)
  })

  it('saves friend notification settings to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.handleFriendRequestNotify(false)
    expect(localStorage.getItem('tjg-friend-request-notify')).toBe('false')
    vm.handleFriendAcceptNotify(false)
    expect(localStorage.getItem('tjg-friend-accept-notify')).toBe('false')
  })

  it('桌面通知总开关写入 MatrixNotificationService 配置而不是死 key', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    await getVm(wrapper).handleNotificationChange(false)

    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ enableDesktop: false })
    expect(localStorage.getItem('tjg-desktop-notification')).toBeNull()
  })

  it('消息内容开关写入 MatrixNotificationService 配置而不是死 key', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    getVm(wrapper).handleContentChange(false)

    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ showMessageContent: false })
    expect(localStorage.getItem('tjg-show-content')).toBeNull()
  })

  it('发送者开关写入 MatrixNotificationService 配置而不是死 key', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    getVm(wrapper).handleSenderChange(false)

    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ showSender: false })
    expect(localStorage.getItem('tjg-show-sender')).toBeNull()
  })
})
