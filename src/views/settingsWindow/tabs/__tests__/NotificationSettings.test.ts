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
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'], emits: ['update:value'] },
  NSlider: {
    name: 'NSlider',
    template: '<div class="n-slider" />',
    props: ['value', 'min', 'max', 'step'],
    emits: ['update:value']
  },
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

    // 下列 4 个 key 已在 2026-09-22 孤儿文案清理中删除（Task 7）。桩件对未命中 key 原样返回，
    // 所以断言"不出现 key 名"等价于断言对应控件没有被重新接回（接回后会渲染裸 key）。
    expect(text).not.toContain('setting.notification.thread.reply_label')
    expect(text).not.toContain('setting.notification.thread.participate_label')
    expect(text).not.toContain('setting.notification.space.title')
    expect(text).not.toContain('setting.notification.friend.title')
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

  it('renders the notification sound switch and the volume slider bound to the setting store', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('setting.notification.desktop.sound_label')
    expect(wrapper.text()).toContain('setting.notification.desktop.volume_label')
    // 默认音量 80% 由 store 读取后显示在数值标签上
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.findComponent({ name: 'NSlider' }).exists()).toBe(true)
  })

  it('sound switch toggles messageSound through the setting store', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    // 开关顺序：桌面(0) / 通知声音(1) / 内容(2) / 发送者(3) / 关键词(4) / 线程提及(5)
    wrapper.findAllComponents({ name: 'NSwitch' })[1].vm.$emit('update:value', false)
    await flushPromises()

    expect(setMessageSoundEnabledMock).toHaveBeenCalledTimes(1)
    expect(setMessageSoundEnabledMock).toHaveBeenCalledWith(false)
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('volume slider writes notification.volume through the setting store', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    wrapper.findComponent({ name: 'NSlider' }).vm.$emit('update:value', 30)
    await flushPromises()

    expect(setNotificationVolumeMock).toHaveBeenCalledTimes(1)
    expect(setNotificationVolumeMock).toHaveBeenCalledWith(30)
  })

  it('desktop toggle writes the config exactly once per click', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    wrapper.findAllComponents({ name: 'NSwitch' })[0].vm.$emit('update:value', false)
    await flushPromises()

    expect(updateNotificationConfigMock).toHaveBeenCalledTimes(1)
    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ enableDesktop: false })
  })

  it('content toggle writes the config exactly once per click', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    // 恢复通知声音开关/音量滑块后顺序：桌面(0) / 声音(1) / 内容(2) / 发送者(3) / 关键词(4) / 线程提及(5)
    wrapper.findAllComponents({ name: 'NSwitch' })[2].vm.$emit('update:value', false)
    await flushPromises()

    expect(updateNotificationConfigMock).toHaveBeenCalledTimes(1)
    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ showMessageContent: false })
  })

  it('sender toggle writes the config exactly once per click', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    wrapper.findAllComponents({ name: 'NSwitch' })[3].vm.$emit('update:value', false)
    await flushPromises()

    expect(updateNotificationConfigMock).toHaveBeenCalledTimes(1)
    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ showSender: false })
  })

  it('thread mention toggle writes exactly one account-data update per click', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    // v-model:value + @update:value 会同时触发 setter 与 handler，每次点击写两次
    // （两次 account data PUT）；改成 :value + handler 后必须恰好一次。
    wrapper.findAllComponents({ name: 'NSwitch' })[5].vm.$emit('update:value', false)
    await flushPromises()

    expect(setEventNotificationEnabledMock).toHaveBeenCalledTimes(1)
    expect(setEventNotificationEnabledMock).toHaveBeenCalledWith('thread_mention', false)
  })

  it('桌面通知总开关写入 MatrixNotificationService 配置而不是死 key', async () => {
    const wrapper = mount(NotificationSettings)
    await flushPromises()

    await getVm(wrapper).handleNotificationChange(false)

    expect(updateNotificationConfigMock).toHaveBeenCalledWith({ enableDesktop: false })
    expect(localStorage.getItem('tjg-desktop-notification')).toBeNull()
  })
})
