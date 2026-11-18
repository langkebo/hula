import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPushDevicesMock, showFeedbackMock } = vi.hoisted(() => ({
  getPushDevicesMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: '<button class="n-button"><slot /></button>',
    props: ['size', 'type', 'loading']
  },
  NCollapse: { name: 'NCollapse', template: '<div class="n-collapse"><slot /></div>' },
  NCollapseItem: {
    name: 'NCollapseItem',
    template: '<div class="n-collapse-item"><slot /></div>',
    props: ['title', 'name']
  },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NEmpty: { name: 'NEmpty', template: '<div class="n-empty" />', props: ['description'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>', props: ['labelPlacement'] },
  NFormItem: { name: 'NFormItem', template: '<div class="n-form-item"><slot /></div>', props: ['label'] },
  NInput: { name: 'NInput', template: '<input class="n-input" />', props: ['value', 'placeholder'] },
  NPopconfirm: { name: 'NPopconfirm', template: '<div class="n-popconfirm"><slot name="trigger" /><slot /></div>' },
  NSelect: { name: 'NSelect', template: '<div class="n-select" />', props: ['value', 'options'] },
  NSpin: { name: 'NSpin', template: '<div class="n-spin"><slot /></div>', props: ['show'] }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/matrix/notifications/MatrixPushService', () => ({
  matrixPushService: {
    getPushDevices: getPushDevicesMock,
    registerPushDevice: vi.fn(),
    unregisterPushDevice: vi.fn(),
    sendPushNotification: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

import PushDeviceSettings from '../PushDeviceSettings.vue'

const mountSection = () => mount(PushDeviceSettings)

describe('PushDeviceSettings 推送设备四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPushDevicesMock.mockResolvedValue([])
  })

  it('首屏读取失败时展示错误与重试，而不是「暂无设备」空态', async () => {
    getPushDevicesMock.mockRejectedValueOnce(new Error('500'))

    const wrapper = mountSection()
    await flushPromises()

    const vm = wrapper.vm as unknown as { loadFailed: boolean }
    expect(vm.loadFailed).toBe(true)
    expect(wrapper.find('[data-testid="push-devices-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(true)
    expect(wrapper.find('.n-empty').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="push-device-item"]')).toHaveLength(0)
    expect(showFeedbackMock).toHaveBeenCalledWith('setting.push.device_endpoints.loadFailed', 'error')
  })

  it('点击重试成功后清除错误态并渲染设备列表', async () => {
    getPushDevicesMock.mockRejectedValueOnce(new Error('500'))

    const wrapper = mountSection()
    await flushPromises()
    expect(wrapper.find('[data-testid="push-devices-error"]').exists()).toBe(true)

    getPushDevicesMock.mockResolvedValueOnce([
      { device_id: 'device-1', push_type: 'fcm', platform: 'android', enabled: true, created_ts: 0 }
    ])
    await wrapper.get('[data-testid="error-retry"]').trigger('click')
    await flushPromises()

    const vm = wrapper.vm as unknown as { loadFailed: boolean }
    expect(vm.loadFailed).toBe(false)
    expect(wrapper.find('[data-testid="push-devices-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="push-device-item"]')).toHaveLength(1)
  })
})
