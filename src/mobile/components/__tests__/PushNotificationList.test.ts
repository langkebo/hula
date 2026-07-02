// src/mobile/components/__tests__/PushNotificationList.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PushNotificationList from '../PushNotificationList.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('PushNotificationList', () => {
  it('renders empty state when no notifications', () => {
    const wrapper = mount(PushNotificationList, {
      props: { notifications: [] }
    })
    expect(wrapper.text()).toContain('push.no_notifications')
  })

  it('renders notification items with title and body', () => {
    const wrapper = mount(PushNotificationList, {
      props: {
        notifications: [
          { id: '1', title: '新消息', body: '你收到了一条新消息', timestamp: 1700000000000 },
          { id: '2', title: '系统通知', body: '系统已更新', timestamp: 1700000001000 }
        ]
      }
    })
    expect(wrapper.text()).toContain('新消息')
    expect(wrapper.text()).toContain('你收到了一条新消息')
    expect(wrapper.text()).toContain('系统通知')
    expect(wrapper.findAll('[data-test="notification-item"]')).toHaveLength(2)
  })

  it('emits dismiss with notification id when dismiss button clicked', async () => {
    const wrapper = mount(PushNotificationList, {
      props: {
        notifications: [{ id: '1', title: 'Test', body: 'Body', timestamp: 1700000000000 }]
      }
    })
    await wrapper.find('[data-test="dismiss-btn-1"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toEqual([['1']])
  })

  it('emits clear when clear-all button is clicked', async () => {
    const wrapper = mount(PushNotificationList, {
      props: {
        notifications: [{ id: '1', title: 'A', body: 'B', timestamp: 1700000000000 }]
      }
    })
    await wrapper.find('[data-test="clear-all-btn"]').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })
})
