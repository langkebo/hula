import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DelayedEventsPanel from '../DelayedEventsPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getDelayedEventsMock = vi.fn()
const cancelMock = vi.fn()
const restartMock = vi.fn()
const sendMock = vi.fn()

vi.mock('@/services/matrix/messaging/MatrixDelayedEventsService', () => ({
  matrixDelayedEventsService: {
    getDelayedEvents: (...args: unknown[]) => getDelayedEventsMock(...args),
    cancelScheduledDelayedEvent: (...args: unknown[]) => cancelMock(...args),
    restartScheduledDelayedEvent: (...args: unknown[]) => restartMock(...args),
    sendScheduledDelayedEvent: (...args: unknown[]) => sendMock(...args)
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

const naiveStubs = {
  Button: {
    template:
      '<button class="n-button-stub" :disabled="disabled" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
    props: ['disabled', 'loading', 'type', 'size', 'block', 'secondary'],
    emits: ['click']
  },
  Spin: { template: '<div class="n-spin-stub" />', props: ['size'] },
  Empty: { template: '<div class="n-empty-stub"><slot /></div>', props: ['description'] },
  Tag: { template: '<span class="n-tag-stub"><slot /></span>', props: ['type', 'size', 'round'] },
  Divider: { template: '<hr class="n-divider-stub" />' }
}

const makeScheduledEvent = (overrides: Record<string, unknown> = {}) => ({
  delay_id: '$delay1:hs',
  room_id: '!room:hs',
  type: 'm.room.message',
  content: { body: 'hello' },
  delay: 60000,
  running_since: 1700000000000,
  ...overrides
})

describe('DelayedEventsPanel — 延迟事件管理面板 (P0-4 MSC4140)', () => {
  beforeEach(() => {
    getDelayedEventsMock.mockReset()
    cancelMock.mockReset()
    restartMock.mockReset()
    sendMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountPanel = async () => {
    const wrapper = mount(DelayedEventsPanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('挂载时调用 getDelayedEvents 加载待处理事件', async () => {
    getDelayedEventsMock.mockResolvedValue({ scheduled: [], finalised: [] })
    await mountPanel()
    expect(getDelayedEventsMock).toHaveBeenCalledWith('scheduled')
  })

  it('加载中显示 loading 状态', () => {
    getDelayedEventsMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(DelayedEventsPanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    expect(wrapper.find('.n-spin-stub').exists()).toBe(true)
  })

  it('空列表显示空状态提示', async () => {
    getDelayedEventsMock.mockResolvedValue({ scheduled: [], finalised: [] })
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-empty-stub').exists()).toBe(true)
  })

  it('渲染待处理延迟事件列表', async () => {
    const event = makeScheduledEvent()
    getDelayedEventsMock.mockResolvedValue({ scheduled: [event], finalised: [] })
    const wrapper = await mountPanel()
    expect(wrapper.findAll('.delayed-event-item')).toHaveLength(1)
    expect(wrapper.find('.delayed-event-item').text()).toContain('$delay1:hs')
    expect(wrapper.find('.delayed-event-item').text()).toContain('m.room.message')
  })

  it('每条待处理事件显示取消/重启/立即发送三个操作按钮', async () => {
    getDelayedEventsMock.mockResolvedValue({ scheduled: [makeScheduledEvent()], finalised: [] })
    const wrapper = await mountPanel()
    const item = wrapper.find('.delayed-event-item')
    expect(item.find('[data-testid="delayed-cancel-btn"]').exists()).toBe(true)
    expect(item.find('[data-testid="delayed-restart-btn"]').exists()).toBe(true)
    expect(item.find('[data-testid="delayed-send-btn"]').exists()).toBe(true)
  })

  it('点击取消按钮调用 cancelScheduledDelayedEvent 并刷新列表', async () => {
    cancelMock.mockResolvedValue({ ok: true })
    getDelayedEventsMock.mockResolvedValue({ scheduled: [makeScheduledEvent()], finalised: [] })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="delayed-cancel-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(cancelMock).toHaveBeenCalledWith('$delay1:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('delayed_events.cancel_success', 'success')
    // 刷新列表：getDelayedEvents 至少被调用 2 次（初始 + 取消后）
    expect(getDelayedEventsMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('点击重启按钮调用 restartScheduledDelayedEvent', async () => {
    restartMock.mockResolvedValue({ ok: true })
    getDelayedEventsMock.mockResolvedValue({ scheduled: [makeScheduledEvent()], finalised: [] })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="delayed-restart-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(restartMock).toHaveBeenCalledWith('$delay1:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('delayed_events.restart_success', 'success')
  })

  it('点击立即发送按钮调用 sendScheduledDelayedEvent', async () => {
    sendMock.mockResolvedValue({ ok: true })
    getDelayedEventsMock.mockResolvedValue({ scheduled: [makeScheduledEvent()], finalised: [] })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="delayed-send-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(sendMock).toHaveBeenCalledWith('$delay1:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('delayed_events.send_success', 'success')
  })

  it('取消失败时显示错误反馈', async () => {
    cancelMock.mockRejectedValue(new Error('network'))
    getDelayedEventsMock.mockResolvedValue({ scheduled: [makeScheduledEvent()], finalised: [] })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="delayed-cancel-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(showFeedbackMock).toHaveBeenCalledWith('delayed_events.cancel_failed', 'error')
  })

  it('加载失败时显示错误提示', async () => {
    getDelayedEventsMock.mockRejectedValue(new Error('server error'))
    const wrapper = await mountPanel()
    expect(wrapper.find('.delayed-events-error').exists()).toBe(true)
  })

  it('roomId 变化时重新加载', async () => {
    getDelayedEventsMock.mockResolvedValue({ scheduled: [], finalised: [] })
    const wrapper = await mountPanel()
    const initialCallCount = getDelayedEventsMock.mock.calls.length
    await wrapper.setProps({ roomId: '!new:hs' })
    await wrapper.vm.$nextTick()
    expect(getDelayedEventsMock.mock.calls.length).toBeGreaterThan(initialCallCount)
  })
})
