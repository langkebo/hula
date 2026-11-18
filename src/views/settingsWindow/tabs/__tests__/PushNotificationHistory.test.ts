import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PushNotificationHistory from '../PushNotificationHistory.vue'

/**
 * 推送历史四态。
 *
 * 回归背景：读取失败曾被渲染成 `n-empty`（「暂无推送历史」），
 * 用户会误以为历史记录已被清空。
 */

const { getNotificationsMock, showFeedbackMock } = vi.hoisted(() => ({
  getNotificationsMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))
vi.mock('@/services/matrix/notifications/MatrixNotificationService', () => ({
  matrixNotificationService: {
    getNotifications: (...args: unknown[]) => getNotificationsMock(...args)
  }
}))
vi.mock('naive-ui', () => ({
  NSpin: { name: 'NSpin', template: '<div><slot /></div>' },
  NEmpty: { name: 'NEmpty', props: ['description'], template: '<div data-testid="n-empty">{{ description }}</div>' },
  NButton: {
    name: 'NButton',
    props: ['loading'],
    emits: ['click'],
    template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
  }
}))

const mountHistory = () => mount(PushNotificationHistory, { props: { ready: true } })

const unreadNotification = (id: number) => ({
  notification_id: id,
  room_id: '!room:server',
  event_id: `$event-${id}`,
  read: false,
  content: { body: `message ${id}` }
})

describe('PushNotificationHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('读取成功时渲染未读通知列表', async () => {
    getNotificationsMock.mockResolvedValue({ notifications: [unreadNotification(1)] })

    const wrapper = mountHistory()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="notification-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('message 1')
    expect(wrapper.find('[data-testid="n-empty"]').exists()).toBe(false)
  })

  it('读取失败时展示错误与重试，而不是「暂无推送历史」', async () => {
    getNotificationsMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountHistory()
    await flushPromises()

    expect(wrapper.find('[data-testid="notification-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notification-retry"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notification-empty"]').exists()).toBe(false)
  })

  it('点击重试后重新拉取并渲染列表', async () => {
    getNotificationsMock.mockRejectedValueOnce(new Error('network down'))
    getNotificationsMock.mockResolvedValueOnce({ notifications: [unreadNotification(2)] })

    const wrapper = mountHistory()
    await flushPromises()
    expect(wrapper.find('[data-testid="notification-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="notification-retry"]').trigger('click')
    await flushPromises()

    expect(getNotificationsMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="notification-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="notification-row"]')).toHaveLength(1)
  })

  it('真正的空列表才渲染空态', async () => {
    getNotificationsMock.mockResolvedValue({ notifications: [] })

    const wrapper = mountHistory()
    await flushPromises()

    expect(wrapper.find('[data-testid="notification-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notification-error"]').exists()).toBe(false)
  })

  it('会话未就绪时不抢跑拉取', async () => {
    getNotificationsMock.mockResolvedValue({ notifications: [] })

    mount(PushNotificationHistory, { props: { ready: false } })
    await flushPromises()

    expect(getNotificationsMock).not.toHaveBeenCalled()
  })
})
