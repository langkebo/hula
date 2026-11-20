import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Widget } from '@/composables/widget'
import { makeWidgetConfig } from '@/services/matrix/widget/__tests__/fixtures/widget'
import WidgetDetailPanel from '../WidgetDetailPanel.vue'

const { getWidgetConfigMock, getWidgetCapabilitiesMock, getWidgetSessionsMock, showFeedbackMock } = vi.hoisted(() => ({
  getWidgetConfigMock: vi.fn(),
  getWidgetCapabilitiesMock: vi.fn(),
  getWidgetSessionsMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/widget/MatrixWidgetService', () => ({
  matrixWidgetService: {
    getWidgetConfig: (...args: unknown[]) => getWidgetConfigMock(...args),
    getWidgetCapabilities: (...args: unknown[]) => getWidgetCapabilitiesMock(...args),
    getWidgetSessions: (...args: unknown[]) => getWidgetSessionsMock(...args),
    terminateWidgetSession: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    props: ['size', 'text', 'type', 'disabled'],
    template: '<button :disabled="disabled"><slot /></button>'
  },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NIcon: { name: 'NIcon', template: '<i><slot /></i>' },
  NSpin: { name: 'NSpin', template: '<div class="n-spin"><slot /></div>', props: ['show'] },
  NTabs: { name: 'NTabs', template: '<div class="n-tabs"><slot /></div>', props: ['value', 'type', 'size'] },
  NTabPane: { name: 'NTabPane', template: '<div class="n-tab-pane"><slot /></div>', props: ['name', 'tab'] },
  NDescriptions: { name: 'NDescriptions', template: '<div class="n-descriptions"><slot /></div>' },
  NDescriptionsItem: {
    name: 'NDescriptionsItem',
    template: '<div class="n-descriptions-item"><slot /></div>',
    props: ['label']
  },
  NTag: { name: 'NTag', template: '<span class="n-tag"><slot /></span>', props: ['size', 'type'] },
  NPopconfirm: { name: 'NPopconfirm', template: '<div><slot /><slot name="trigger" /></div>' }
}))

const widget = { id: 'widget-1', name: 'Widget One' } as unknown as Widget

const mountPanel = () =>
  mount(WidgetDetailPanel, {
    props: { widget, roomId: '!room:example.com' },
    global: {
      stubs: {
        EmptyState: { name: 'EmptyState', template: '<div class="empty-state" />', props: ['description', 'compact'] }
      }
    }
  })

describe('WidgetDetailPanel — 读取失败不伪装空态', () => {
  beforeEach(() => {
    getWidgetConfigMock.mockReset().mockResolvedValue({})
    getWidgetCapabilitiesMock.mockReset().mockResolvedValue({ capabilities: [] })
    getWidgetSessionsMock.mockReset().mockResolvedValue({ sessions: [] })
    showFeedbackMock.mockClear()
  })

  it('读取成功且无数据时展示空态，没有错误块', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.findAll('.empty-state')).toHaveLength(3)
    expect(wrapper.find('[data-test="widget-config-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="widget-capabilities-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="widget-sessions-error"]').exists()).toBe(false)
  })

  it('三处读取失败时各自展示错误态与重试，且不渲染空态', async () => {
    getWidgetConfigMock.mockRejectedValue(new Error('config-fail'))
    getWidgetCapabilitiesMock.mockRejectedValue(new Error('capabilities-fail'))
    getWidgetSessionsMock.mockRejectedValue(new Error('sessions-fail'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-test="widget-config-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="widget-capabilities-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="widget-sessions-error"]').exists()).toBe(true)
    expect(wrapper.findAll('.empty-state')).toHaveLength(0)

    // 读取失败时禁用编辑入口，避免用空数据覆盖服务端
    const editButtons = wrapper
      .findAllComponents({ name: 'NButton' })
      .filter((button) => button.props('size') === 'small')
    expect(editButtons.length).toBeGreaterThanOrEqual(2)
    expect(editButtons.slice(0, 2).every((button) => button.props('disabled') === true)).toBe(true)
  })

  it('点击重试会重新读取并恢复配置内容', async () => {
    getWidgetConfigMock
      .mockRejectedValueOnce(new Error('config-fail'))
      .mockResolvedValueOnce(makeWidgetConfig({ data: { theme: 'dark' } }))

    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.find('[data-test="widget-config-error"]').exists()).toBe(true)

    await wrapper.find('[data-test="widget-config-error"] [data-testid="error-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="widget-config-error"]').exists()).toBe(false)
    expect(wrapper.find('.n-descriptions').exists()).toBe(true)
    expect(wrapper.text()).toContain('dark')
  })
})
