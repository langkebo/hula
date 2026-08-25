import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FriendsList from '../FriendsList.vue'

vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: {
      t: (key: string) => key
    }
  }),
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/components/friend/FriendListView.vue', () => ({
  default: {
    name: 'FriendListView',
    template: '<div class="friend-list-view-stub">friend-list-view</div>'
  }
}))

// 方案B：好友页顶部的「私密聊天」入口已移除，隐藏会话入口统一收口到
// 消息列表工具栏（MessageSessionToolbar openHiddenSessions → /secretChat）。
// 原 FriendsList 的跳转/密码校验行为断言随入口一并迁移。
describe('FriendsList', () => {
  it('仅承载 FriendListView，不再渲染私密聊天 shortcut 入口', () => {
    const wrapper = mount(FriendsList, {
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.find('.friend-list-view-stub').exists()).toBe(true)
    expect(wrapper.find('.friends-list-shell__shortcut').exists()).toBe(false)
  })
})
