import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const {
  waitForClientReadyMock,
  getPushRulesMock,
  getPushersMock,
  getNotificationsMock,
  getDndSettingsMock,
  setDndSettingsMock,
  setPushRuleEnabledMock
} = vi.hoisted(() => ({
  waitForClientReadyMock: vi.fn(),
  getPushRulesMock: vi.fn().mockResolvedValue({ global: {} }),
  getPushersMock: vi.fn().mockResolvedValue([]),
  getNotificationsMock: vi.fn().mockResolvedValue({ notifications: [] }),
  getDndSettingsMock: vi.fn<() => { enabled: boolean; startTime: number | null; endTime: number | null }>(() => ({
    enabled: false,
    startTime: null,
    endTime: null
  })),
  setDndSettingsMock: vi.fn(),
  setPushRuleEnabledMock: vi.fn().mockResolvedValue(undefined)
}))

// 关键：waitForClientReady 由组件 await，必须能由测试控制其 resolve 时机
let resolveReady: () => void
let readyPromise: Promise<void>

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args) },
  default: { waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args) }
}))

vi.mock('@/services/matrix/notifications/MatrixPushService', () => ({
  matrixPushService: {
    getPushers: (...args: unknown[]) => getPushersMock(...args),
    getPushRules: (...args: unknown[]) => getPushRulesMock(...args),
    setPushRuleEnabled: (...args: unknown[]) => setPushRuleEnabledMock(...args),
    subscribePushRules: vi.fn(() => vi.fn())
  }
}))

vi.mock('@/services/matrix/notifications/MatrixNotificationService', () => ({
  matrixNotificationService: {
    getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
    syncDndFromAccountData: vi.fn().mockResolvedValue(null),
    getDndSettings: () => getDndSettingsMock(),
    setDndSettings: (...args: unknown[]) => setDndSettingsMock(...args)
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>' },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NEmpty: { name: 'NEmpty', template: '<div />' },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>' },
  NInput: { name: 'NInput', template: '<input />' },
  NModal: { name: 'NModal', template: '<div><slot /></div>' },
  NSelect: { name: 'NSelect', template: '<div />' },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>' },
  NSwitch: { name: 'NSwitch', props: ['value'], emits: ['update:value'], template: '<div />' },
  NTimePicker: { name: 'NTimePicker', props: ['value'], emits: ['update:value'], template: '<div />' },
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />' }
}))

import PushSettings from '../PushSettings.vue'

describe('PushSettings — P0-#3 客户端就绪竞态', () => {
  beforeEach(() => {
    getPushRulesMock.mockClear()
    getPushersMock.mockClear()
    getNotificationsMock.mockClear()
    waitForClientReadyMock.mockClear()
    getDndSettingsMock.mockClear()
    setDndSettingsMock.mockClear()
    setPushRuleEnabledMock.mockClear()
    // mockClear 保留上一次的 mockReturnValue，勿扰设置必须逐例复位
    getDndSettingsMock.mockReturnValue({ enabled: false, startTime: null, endTime: null })
    localStorage.clear()

    readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    waitForClientReadyMock.mockReturnValue(readyPromise)
  })

  /** 挂载并把客户端置为就绪，等待 onMounted 里的设置加载完成。 */
  async function mountReady() {
    const wrapper = mount(PushSettings, {
      props: { embedded: true }
    })
    resolveReady()
    await flushPromises()
    await nextTick()
    await flushPromises()
    return wrapper
  }

  it('onMounted 应先 await 客户端就绪，再拉取推送规则', async () => {
    const wrapper = mount(PushSettings, {
      props: { embedded: true },
      global: { stubs: { NTimePicker: { name: 'NTimePicker', template: '<div />' } } }
    })

    // 就绪前不应抢跑发请求
    expect(waitForClientReadyMock).toHaveBeenCalledTimes(1)
    expect(getPushRulesMock).not.toHaveBeenCalled()
    expect(getPushersMock).not.toHaveBeenCalled()

    // 客户端就绪后，拉取才真正发生
    resolveReady()
    await flushPromises()
    await nextTick()

    expect(getPushRulesMock).toHaveBeenCalledTimes(1)
    expect(getPushersMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('客户端超时未就绪时不应让 onMounted 抛出未捕获错误', async () => {
    waitForClientReadyMock.mockRejectedValueOnce(new Error('not ready'))

    const wrapper = mount(PushSettings, {
      props: { embedded: true }
    })

    await flushPromises()
    await nextTick()

    // 组件应正常挂载并优雅降级，而非崩溃
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('勿扰设置初始化读取服务，而不是直接读 localStorage 镜像', async () => {
    getDndSettingsMock.mockReturnValue({ enabled: true, startTime: 1000, endTime: 2000 })

    const wrapper = await mountReady()

    // enabled=true 才渲染两个时间选择器，其值必须来自服务
    const pickers = wrapper.findAllComponents({ name: 'NTimePicker' })
    expect(pickers).toHaveLength(2)
    expect(pickers[0].props('value')).toBe(1000)
    expect(pickers[1].props('value')).toBe(2000)

    wrapper.unmount()
  })

  it('勿扰时间变更通过 setDndSettings 持久化，不再直接写 localStorage', async () => {
    getDndSettingsMock.mockReturnValue({ enabled: true, startTime: 1000, endTime: 2000 })

    const wrapper = await mountReady()
    const pickers = wrapper.findAllComponents({ name: 'NTimePicker' })
    pickers[0].vm.$emit('update:value', 5000)
    await nextTick()

    expect(setDndSettingsMock).toHaveBeenCalledWith({ enabled: true, startTime: 5000, endTime: 2000 })
    expect(localStorage.getItem('tjg-push-dnd-start')).toBeNull()

    wrapper.unmount()
  })

  it('勿扰开关在空边界时补齐默认时段，避免"看着打开却不生效"', async () => {
    const wrapper = await mountReady()

    // 勿扰开关是模板里最后一个开关
    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    switches[switches.length - 1].vm.$emit('update:value', true)
    await nextTick()

    // 空边界会让 isWithinDndWindow 恒为 false；打开时必须给一组真实窗口
    const start = new Date()
    start.setHours(22, 0, 0, 0)
    const end = new Date()
    end.setHours(8, 0, 0, 0)
    expect(setDndSettingsMock).toHaveBeenCalledWith({
      enabled: true,
      startTime: start.getTime(),
      endTime: end.getTime()
    })
    // 补齐的边界要反映到界面选择器上，而不是只写给服务
    const pickers = wrapper.findAllComponents({ name: 'NTimePicker' })
    expect(pickers[0].props('value')).toBe(start.getTime())
    expect(pickers[1].props('value')).toBe(end.getTime())
    expect(localStorage.getItem('tjg-push-dnd')).toBeNull()

    wrapper.unmount()
  })

  it('勿扰开关不覆盖已有的时间边界', async () => {
    getDndSettingsMock.mockReturnValue({ enabled: false, startTime: 1000, endTime: 2000 })

    const wrapper = await mountReady()
    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    switches[switches.length - 1].vm.$emit('update:value', true)
    await nextTick()

    expect(setDndSettingsMock).toHaveBeenCalledWith({ enabled: true, startTime: 1000, endTime: 2000 })

    wrapper.unmount()
  })

  it('一次点击只写一次勿扰设置（单一写入者）', async () => {
    const wrapper = await mountReady()

    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    switches[switches.length - 1].vm.$emit('update:value', true)
    await nextTick()

    expect(setDndSettingsMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('主开关一次点击只发一次推送规则请求（单一写入者）', async () => {
    const wrapper = await mountReady()

    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    switches[0].vm.$emit('update:value', false)
    await nextTick()
    await flushPromises()

    expect(setPushRuleEnabledMock).toHaveBeenCalledTimes(1)
    expect(setPushRuleEnabledMock).toHaveBeenCalledWith('global', 'override', '.m.rule.master', true)

    wrapper.unmount()
  })
})
