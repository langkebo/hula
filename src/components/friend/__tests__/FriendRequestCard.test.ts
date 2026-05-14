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

  it('renders outgoing request correctly', () => {
    const wrapper = mount(FriendRequestCard, {
      props: {
        request: { ...mockRequest, direction: 'outgoing' }
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.text()).toContain('friend.request.cancel')
    expect(wrapper.text()).not.toContain('friend.request.accept')
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
