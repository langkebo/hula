import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TabBar from '../index.vue'

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    unReadMark: {
      newMsgUnreadCount: 3,
      newFriendUnreadCount: 1,
      newGroupUnreadCount: 2
    }
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'mobile_tabbar.items.messages': '消息',
        'mobile_tabbar.items.contacts': '联系人',
        'mobile_tabbar.items.rooms': '房间',
        'mobile_tabbar.items.spaces': '空间',
        'mobile_tabbar.items.me': '我的'
      })[key] ?? key
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/mobile/dynamic'
  })
}))

describe('Mobile TabBar', () => {
  it('registers dynamic as a formal mobile navigation entry', () => {
    const wrapper = mount(TabBar, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="to"><slot /></a>'
          },
          'van-badge': {
            props: ['content', 'max', 'offset', 'color'],
            template: '<div><slot /></div>'
          }
        }
      }
    })

    const links = wrapper.findAll('[data-to]')
    expect(links).toHaveLength(5)
    expect(links.map((node) => node.attributes('data-to'))).toEqual([
      '/mobile/message',
      '/mobile/friends',
      '/mobile/rooms',
      '/mobile/dynamic',
      '/mobile/my'
    ])
    expect(wrapper.text()).toContain('空间')
  })
})
