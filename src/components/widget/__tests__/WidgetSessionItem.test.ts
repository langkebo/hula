import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WidgetSessionItem from '../WidgetSessionItem.vue'

const { getWidgetSessionMock } = vi.hoisted(() => ({
  getWidgetSessionMock: vi.fn()
}))

vi.mock('@/services/matrix/widget/MatrixWidgetService', () => ({
  matrixWidgetService: {
    getWidgetSession: (...args: unknown[]) => getWidgetSessionMock(...args)
  }
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
    props: ['size', 'text', 'type', 'loading'],
    template: '<button :disabled="loading"><slot /></button>'
  },
  NPopconfirm: {
    name: 'NPopconfirm',
    emits: ['positive-click'],
    template:
      '<div><slot /><slot name="trigger" /><button data-testid="popconfirm-positive" @click="$emit(\'positive-click\')" /></div>'
  }
}))

const session = {
  session_id: 'sess-1',
  user_id: '@alice:hs',
  created_ts: 1700000000000,
  last_active_ts: 1700000100000
}

const mountItem = () =>
  mount(WidgetSessionItem, {
    props: { session },
    global: {
      stubs: {
        ErrorState: {
          name: 'ErrorState',
          template: '<div class="error-state"><button data-testid="error-retry" @click="$emit(\'retry\')" /></div>',
          props: ['title', 'retryText', 'compact']
        }
      }
    }
  })

describe('WidgetSessionItem — 单点会话详情接线', () => {
  beforeEach(() => {
    getWidgetSessionMock.mockReset()
  })

  it('默认只展示列表字段，不请求详情', () => {
    const wrapper = mountItem()

    expect(getWidgetSessionMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('sess-1')
    expect(wrapper.text()).toContain('@alice:hs')
    expect(wrapper.find('[data-testid="widget-session-detail-error"]').exists()).toBe(false)
  })

  it('点击详情按会话 ID 拉取并展示设备 / 过期时间 / 状态', async () => {
    getWidgetSessionMock.mockResolvedValue({
      session: { session_id: 'sess-1', device_id: 'DEV1', expires_at: 1700000200000, is_active: true }
    })

    const wrapper = mountItem()
    await wrapper.get('[data-testid="widget-session-detail-toggle"]').trigger('click')
    await flushPromises()

    expect(getWidgetSessionMock).toHaveBeenCalledWith('sess-1', true)
    expect(wrapper.text()).toContain('common.widget.session_device')
    expect(wrapper.text()).toContain('DEV1')
    expect(wrapper.text()).toContain('common.widget.session_status_active')
  })

  it('详情读取失败展示错误态与重试，不展示详情字段', async () => {
    getWidgetSessionMock.mockRejectedValue(new Error('detail-fail'))

    const wrapper = mountItem()
    await wrapper.get('[data-testid="widget-session-detail-toggle"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="widget-session-detail-error"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('common.widget.session_device')

    getWidgetSessionMock.mockResolvedValue({ session: { device_id: 'DEV2', is_active: false } })
    await wrapper.get('[data-testid="error-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="widget-session-detail-error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('DEV2')
    expect(wrapper.text()).toContain('common.widget.session_status_inactive')
  })

  it('再次点击收起详情，不重复请求', async () => {
    getWidgetSessionMock.mockResolvedValue({ session: { device_id: 'DEV1', is_active: true } })

    const wrapper = mountItem()
    const toggle = wrapper.get('[data-testid="widget-session-detail-toggle"]')
    await toggle.trigger('click')
    await flushPromises()
    await toggle.trigger('click')

    expect(getWidgetSessionMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('DEV1')
  })

  it('终止按钮把会话 ID 派发给父组件', async () => {
    const wrapper = mountItem()

    expect(wrapper.text()).toContain('common.widget.terminate_session')
    await wrapper.get('[data-testid="popconfirm-positive"]').trigger('click')

    expect(wrapper.emitted('terminate')?.[0]).toEqual(['sess-1'])
  })
})
