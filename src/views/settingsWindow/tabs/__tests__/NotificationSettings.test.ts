import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import {
  DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES,
  loadNotificationDisplayPreferences
} from '@/services/matrix/notifications/notificationDisplayPreferences'
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
  showMessageContent: true,
  events: {} as Record<string, boolean>
}
const updateNotificationConfigMock = vi.fn((partial: Partial<typeof notificationConfigMock>) => {
  Object.assign(notificationConfigMock, partial)
})
const setEventNotificationEnabledMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.notification.desktop.title': '桌面通知',
  'setting.notification.keyword.title': '关键词通知',
  'setting.notification.thread.title': '线程通知',
  'setting.notification.space.title': '空间通知',
  'setting.notification.friend.title': '好友通知',
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
  threadMentionNotify: boolean
  addKeyword: () => void
  removeKeyword: (keyword: string) => void
  handleNotificationChange: (value: boolean) => Promise<void>
  handleContentChange: (value: boolean) => void
  handleSenderChange: (value: boolean) => void
  handleKeywordToggle: (value: boolean) => void
  handleSoundChange: (value: boolean) => void
  handleVolumeChange: (value: number) => void
  handleThreadMentionNotify: (value: boolean) => void
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
    getConfig: () => ({ ...notificationConfigMock, events: { ...notificationConfigMock.events } }),
    updateConfig: (partial: Partial<typeof notificationConfigMock>) => updateNotificationConfigMock(partial),
    setEventNotificationEnabled: (kind: string, enabled: boolean) => setEventNotificationEnabledMock(kind, enabled)
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
      showMessageContent: true,
      events: {}
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

  it('loads keywords from the display preferences store', () => {
    localStorage.setItem(
      'tjg-notification-display-preferences',
      JSON.stringify({ ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES, keywords: ['urgent', 'important'] })
    )

    const wrapper = mount(NotificationSettings)

    expect(getVm(wrapper).keywords).toEqual(['urgent', 'important'])
  })

  it('loads the keyword notification toggle from the display preferences store', () => {
    localStorage.setItem(
      'tjg-notification-display-preferences',
      JSON.stringify({ ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES, keywordNotifications: true })
    )

    const wrapper = mount(NotificationSettings)

    expect(getVm(wrapper).keywordNotification).toBe(true)
  })

  it('migrates the legacy keyword keys into the display preferences store on mount', async () => {
    localStorage.setItem('tjg-keyword-notification', 'true')
    localStorage.setItem('tjg-keywords', JSON.stringify(['deploy']))

    const wrapper = mount(NotificationSettings)
    await flushPromises()
    const vm = getVm(wrapper)

    expect(vm.keywordNotification).toBe(true)
    expect(vm.keywords).toEqual(['deploy'])
    expect(localStorage.getItem('tjg-keyword-notification')).toBeNull()
    expect(localStorage.getItem('tjg-keywords')).toBeNull()
  })

  it('adds a keyword into the display preferences store instead of the dead legacy key', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.newKeyword = 'test-keyword'
    vm.addKeyword()

    expect(loadNotificationDisplayPreferences().keywords).toContain('test-keyword')
    expect(localStorage.getItem('tjg-keywords')).toBeNull()
    expect(vm.newKeyword).toBe('')
  })

  it('does not add duplicate keyword', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)
    vm.addKeyword()
    vm.newKeyword = 'existing'
    vm.addKeyword()
    vm.newKeyword = 'existing'
    vm.addKeyword()

    expect(vm.keywords).toHaveLength(1)
  })

  it('removes a keyword from the display preferences store', () => {
    localStorage.setItem(
      'tjg-notification-display-preferences',
      JSON.stringify({ ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES, keywords: ['a', 'b', 'c'] })
    )
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)

    vm.removeKeyword('b')

    expect(vm.keywords).not.toContain('b')
    expect(vm.keywords).toHaveLength(2)
    expect(loadNotificationDisplayPreferences().keywords).toEqual(['a', 'c'])
  })

  it('saves the keyword toggle into the display preferences store', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)

    vm.handleKeywordToggle(true)

    expect(loadNotificationDisplayPreferences().keywordNotifications).toBe(true)
    expect(localStorage.getItem('tjg-keyword-notification')).toBeNull()
  })

  it('loads the thread mention switch from the service config, defaulting to on', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()
    expect(getVm(wrapper).threadMentionNotify).toBe(true)

    notificationConfigMock.events = { thread_mention: false }
    const second = mount(NotificationSettings)
    await flushPromises()
    expect(getVm(second).threadMentionNotify).toBe(false)
  })

  it('saves the thread mention switch through the service, never through the legacy key', () => {
    const wrapper = mount(NotificationSettings)
    const vm = getVm(wrapper)

    vm.handleThreadMentionNotify(false)

    expect(setEventNotificationEnabledMock).toHaveBeenCalledWith('thread_mention', false)
    expect(localStorage.getItem('tjg-thread-mention-notify')).toBeNull()
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('no longer renders the six switches that had no delivery path', () => {
    const wrapper = mount(NotificationSettings)
    const text = wrapper.text()

    expect(text).not.toContain('setting.notification.thread.reply_label')
    expect(text).not.toContain('setting.notification.thread.participate_label')
    expect(text).not.toContain('空间通知')
    expect(text).not.toContain('好友通知')
    expect(wrapper.text()).toContain('线程通知')
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

  it('桌面通知总开关写入 MatrixNotificationService 配置而不是死 key', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    await getVm(wrapper).handleNotificationChange(false)

    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ enableDesktop: false })
    expect(localStorage.getItem('tjg-desktop-notification')).toBeNull()
  })
})
