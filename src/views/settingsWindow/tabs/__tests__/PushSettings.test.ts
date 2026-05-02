import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import PushSettings from '../PushSettings.vue'

const {
  messageSuccessMock,
  messageErrorMock,
  dialogWarningMock,
  getPushersMock,
  getPushRulesMock,
  subscribePushRulesMock,
  unregisterPusherMock,
  setPushRuleEnabledMock,
  unsubscribeMock,
  translationMap
} = vi.hoisted(() => {
  const messageSuccessMock = vi.fn()
  const messageErrorMock = vi.fn()
  const dialogWarningMock = vi.fn()
  const getPushersMock = vi.fn()
  const getPushRulesMock = vi.fn()
  const subscribePushRulesMock = vi.fn()
  const unregisterPusherMock = vi.fn()
  const setPushRuleEnabledMock = vi.fn()
  const unsubscribeMock = vi.fn()

  const translationMap: Record<string, string> = {
    'setting.push.devices': '推送设备',
    'setting.push.noDevices': '暂无已注册的推送设备',
    'setting.push.rules': '推送规则',
    'setting.push.master.label': '启用推送通知',
    'setting.push.master.desc': '全局控制所有推送通知',
    'setting.push.message.label': '消息推送',
    'setting.push.message.desc': '接收新消息时发送推送通知',
    'setting.push.invite.label': '邀请推送',
    'setting.push.invite.desc': '收到房间邀请时发送推送通知',
    'setting.push.dnd.title': '推送时间',
    'setting.push.dnd.label': '勿扰模式',
    'setting.push.dnd.desc': '在指定时间段内不发送推送通知',
    'setting.push.dnd.startTime': '开始时间',
    'setting.push.dnd.endTime': '结束时间',
    'setting.push.delete.title': '删除推送设备',
    'setting.push.delete.content': '确定要删除推送设备 "{name}" 吗？删除后将不再接收该设备的推送通知。',
    'setting.push.delete.confirm': '确定删除',
    'setting.push.delete.cancel': '取消',
    'setting.push.delete.success': '推送设备已删除',
    'setting.push.delete.failed': '删除推送设备失败',
    'setting.push.fetchFailed': '获取推送设备列表失败',
    'setting.push.enabled': '已启用',
    'setting.push.disabled': '已禁用',
    'setting.push.updateFailed': '推送设置更新失败'
  }
  return {
    messageSuccessMock,
    messageErrorMock,
    dialogWarningMock,
    getPushersMock,
    getPushRulesMock,
    subscribePushRulesMock,
    unregisterPusherMock,
    setPushRuleEnabledMock,
    unsubscribeMock,
    translationMap
  }
})

type PushSettingsVm = ComponentPublicInstance & {
  pushers: Array<{ pushkey: string; app_id: string; device_display_name: string }>
  masterEnabled: boolean
  messagePushEnabled: boolean
  invitePushEnabled: boolean
  dndEnabled: boolean
  dndStartTime: number | null
  dndEndTime: number | null
  handleDeletePusher: (pusher: { pushkey: string; app_id: string; device_display_name: string }) => void
  handleMasterToggle: (enabled: boolean) => Promise<void>
  handleMessagePushToggle: (enabled: boolean) => Promise<void>
  handleInvitePushToggle: (enabled: boolean) => Promise<void>
  handleDndToggle: (enabled: boolean) => void
  handleDndTimeChange: () => void
}

vi.mock('naive-ui', () => ({
  NSpin: { name: 'NSpin', template: '<div class="n-spin"><slot /></div>', props: ['show'] },
  NEmpty: { name: 'NEmpty', template: '<div class="n-empty">{{ description }}</div>', props: ['description'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type'] },
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NTimePicker: {
    name: 'NTimePicker',
    template: '<div class="n-time-picker" />',
    props: ['value', 'format', 'clearable']
  },
  useMessage: () => ({ success: messageSuccessMock, error: messageErrorMock }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const template = translationMap[key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        template
      )
    }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })
}))

vi.mock('@/services/matrix/notifications/MatrixPushService', () => ({
  matrixPushService: {
    getPushers: (...args: unknown[]) => getPushersMock(...args),
    getPushRules: (...args: unknown[]) => getPushRulesMock(...args),
    subscribePushRules: (...args: unknown[]) => subscribePushRulesMock(...args),
    unregisterPusher: (...args: unknown[]) => unregisterPusherMock(...args),
    setPushRuleEnabled: (...args: unknown[]) => setPushRuleEnabledMock(...args)
  }
}))

describe('PushSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as PushSettingsVm

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    getPushersMock.mockResolvedValue([
      {
        pushkey: 'push-key-1',
        app_id: 'app.id',
        app_display_name: 'Hula Desktop',
        device_display_name: 'MacBook Pro',
        lang: 'zh-CN',
        kind: 'http',
        data: {}
      }
    ])

    getPushRulesMock.mockResolvedValue({
      global: {
        override: [
          { rule_id: '.m.rule.master', enabled: false },
          { rule_id: '.m.rule.invite_for_me', enabled: true }
        ],
        content: [{ rule_id: '.m.rule.contains_user_name', enabled: false }]
      }
    })

    subscribePushRulesMock.mockReturnValue(unsubscribeMock)
    unregisterPusherMock.mockResolvedValue(undefined)
    setPushRuleEnabledMock.mockResolvedValue(undefined)
  })

  it('renders fetched push devices and sections', async () => {
    const wrapper = mount(PushSettings)
    await flushPromises()

    expect(wrapper.find('.push-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('推送设备')
    expect(wrapper.text()).toContain('推送规则')
    expect(wrapper.text()).toContain('推送时间')
    expect(wrapper.text()).toContain('MacBook Pro')
  })

  it('maps push rules to toggle state on mount', async () => {
    const wrapper = mount(PushSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    expect(vm.masterEnabled).toBe(true)
    expect(vm.messagePushEnabled).toBe(false)
    expect(vm.invitePushEnabled).toBe(true)
  })

  it('loads dnd settings from localStorage on mount', async () => {
    localStorage.setItem('hula-push-dnd', 'true')
    localStorage.setItem('hula-push-dnd-start', '3600000')
    localStorage.setItem('hula-push-dnd-end', '7200000')

    const wrapper = mount(PushSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    expect(vm.dndEnabled).toBe(true)
    expect(vm.dndStartTime).toBe(3600000)
    expect(vm.dndEndTime).toBe(7200000)
  })

  it('shows delete confirmation and removes pusher after confirm', async () => {
    const wrapper = mount(PushSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    vm.handleDeletePusher(vm.pushers[0])

    const dialogOptions = dialogWarningMock.mock.calls[0][0]
    expect(dialogOptions).toEqual(
      expect.objectContaining({
        title: '删除推送设备',
        positiveText: '确定删除',
        negativeText: '取消'
      })
    )

    await dialogOptions.onPositiveClick()

    expect(unregisterPusherMock).toHaveBeenCalledWith('push-key-1', 'app.id')
    expect(vm.pushers).toHaveLength(0)
    expect(messageSuccessMock).toHaveBeenCalledWith('推送设备已删除')
  })

  it('rolls back master toggle and shows error when update fails', async () => {
    setPushRuleEnabledMock.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mount(PushSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    vm.masterEnabled = false

    await vm.handleMasterToggle(false)

    expect(setPushRuleEnabledMock).toHaveBeenCalledWith('global', 'override', '.m.rule.master', true)
    expect(vm.masterEnabled).toBe(true)
    expect(messageErrorMock).toHaveBeenCalledWith('推送设置更新失败')
  })

  it('saves dnd toggle and time range to localStorage', async () => {
    const wrapper = mount(PushSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    vm.handleDndToggle(true)
    vm.dndStartTime = 28800000
    vm.dndEndTime = 64800000
    vm.handleDndTimeChange()

    expect(localStorage.getItem('hula-push-dnd')).toBe('true')
    expect(localStorage.getItem('hula-push-dnd-start')).toBe('28800000')
    expect(localStorage.getItem('hula-push-dnd-end')).toBe('64800000')
    expect(messageSuccessMock).toHaveBeenCalledWith('已启用')
  })

  it('unsubscribes push rule listener on unmount', async () => {
    const wrapper = mount(PushSettings)
    await flushPromises()

    expect(subscribePushRulesMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
  })
})
