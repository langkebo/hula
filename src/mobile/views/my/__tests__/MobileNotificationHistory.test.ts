import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileNotificationHistory from '../MobileNotificationHistory.vue'

const showToastMock = vi.fn()
const getNotificationsMock = vi.fn()

vi.mock('vant', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('@/services/matrix/notifications/MatrixNotificationService', () => ({
  matrixNotificationService: {
    getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
    ackNotificationWithFallback: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

const unreadNotification = {
  notification_id: 1,
  room_id: '!room:example.com',
  event_id: '$event',
  read: false,
  ts: 1_700_000_000_000,
  content: { body: 'hello' }
}

describe('MobileNotificationHistory 四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('首屏读取失败时进入错误态，不伪装成「暂无通知」', async () => {
    getNotificationsMock.mockRejectedValue(new Error('network down'))

    const wrapper = mount(MobileNotificationHistory)
    await flushPromises()

    expect(wrapper.find('[data-test="notification-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="notification-empty"]').exists()).toBe(false)
  })

  it('错误态点重试后读取成功，渲染通知列表', async () => {
    getNotificationsMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ notifications: [unreadNotification], next_token: undefined })

    const wrapper = mount(MobileNotificationHistory)
    await flushPromises()
    expect(wrapper.find('[data-test="notification-error"]').exists()).toBe(true)

    await wrapper.find('[data-test="async-state-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="notification-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="notification-row"]')).toHaveLength(1)
    expect(getNotificationsMock).toHaveBeenCalledTimes(2)
  })

  it('读取成功但没有通知时展示空态', async () => {
    getNotificationsMock.mockResolvedValue({ notifications: [], next_token: undefined })

    const wrapper = mount(MobileNotificationHistory)
    await flushPromises()

    expect(wrapper.find('[data-test="notification-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="notification-error"]').exists()).toBe(false)
  })
})
