import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { FriendRequestItem } from '@/stores/domains/chat/contacts'
import FriendRequestCard from '../FriendRequestCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      if (key === 'friend.request.expires_in') return `expires in ${params.hours}h`
      return key
    }
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url: string) => url
  }
}))

const mockRequest: FriendRequestItem = {
  userId: '@bob:example.com',
  displayName: 'Bob',
  avatarUrl: 'mxc://example.com/bob',
  message: "Hello, let's be friends!",
  timestamp: Date.now(),
  direction: 'incoming',
  applyId: 'bob'
}

describe('FriendRequestCard', () => {
  const globalStubs = {
    NAvatar: { template: '<img />' },
    NButton: { template: '<button><slot /></button>' }
  }

  it('renders incoming request correctly', () => {
    const wrapper = mount(FriendRequestCard, {
      props: {
        request: mockRequest
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('@bob:example.com')
    expect(wrapper.text()).toContain("Hello, let's be friends!")
    expect(wrapper.text()).toContain('friend.request.accept')
    expect(wrapper.text()).toContain('friend.request.reject')
  })

  it('renders outgoing request without action buttons', () => {
    const wrapper = mount(FriendRequestCard, {
      props: {
        request: { ...mockRequest, direction: 'outgoing' }
      },
      global: {
        stubs: globalStubs
      }
    })

    // outgoing（已发出的申请）没有生产挂载点：取消入口由 FriendsSettings 承担，
    // 卡片本身不再渲染任何动作按钮。`friend.request.cancel` 已作为孤儿文案删除（Task 7），
    // 桩件对未命中 key 原样返回，故断言其不出现 = 断言取消入口没有被重新接回卡片。
    expect(wrapper.text()).not.toContain('friend.request.cancel')
    expect(wrapper.text()).not.toContain('friend.request.accept')
    expect(wrapper.find('[data-test="friend-request-accept"]').exists()).toBe(false)
  })

  it('shows countdown correctly', () => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const wrapper = mount(FriendRequestCard, {
      props: {
        request: { ...mockRequest, timestamp: oneDayAgo },
        now: now
      },
      global: {
        stubs: globalStubs
      }
    })

    // 7 days total - 1 day ago = 6 days remaining = 144 hours
    expect(wrapper.text()).toContain('expires in 144h')
  })

  it('emits accept event', async () => {
    const wrapper = mount(FriendRequestCard, {
      props: {
        request: mockRequest
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.find('[data-test="friend-request-accept"]').trigger('click')
    expect(wrapper.emitted('accept')).toBeTruthy()
  })
})
