import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const { waitForClientReadyMock, getPushRulesMock, getPushersMock, getNotificationsMock } = vi.hoisted(() => ({
  waitForClientReadyMock: vi.fn(),
  getPushRulesMock: vi.fn().mockResolvedValue({ global: {} }),
  getPushersMock: vi.fn().mockResolvedValue([]),
  getNotificationsMock: vi.fn().mockResolvedValue({ notifications: [] })
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
    subscribePushRules: vi.fn(() => vi.fn())
  }
}))

vi.mock('@/services/matrix/notifications/MatrixNotificationService', () => ({
  matrixNotificationService: {
    getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
    syncDndFromAccountData: vi.fn().mockResolvedValue(null)
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
  NSwitch: { name: 'NSwitch', template: '<div />' },
  NTimePicker: { name: 'NTimePicker', template: '<div />' },
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

    readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    waitForClientReadyMock.mockReturnValue(readyPromise)
  })

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
})
