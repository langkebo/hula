import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import FriendListItem from '../FriendListItem.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
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

const mockFriend: MatrixContact = {
  userId: '@alice:example.com',
  displayName: 'Alice',
  name: 'Alice',
  avatarUrl: 'mxc://example.com/alice',
  friendStatus: 'normal',
  activeStatus: OnlineEnum.ONLINE,
  statusMessage: 'Available',
  uid: '@alice:example.com',
  account: '@alice:example.com',
  avatar: 'mxc://example.com/alice',
  remark: '',
  lastOptTime: Date.now(),
  hideMyPosts: false,
  hideTheirPosts: false
}

describe('FriendListItem', () => {
  const globalStubs = {
    NBadge: { template: '<div><slot /></div>' },
    NAvatar: { template: '<img />' },
    NTag: { template: '<span><slot /></span>' },
    NButton: { template: '<button><slot name="icon" /></button>' }
  }
  const globalDirectives = {
    safeHtml: {
      mounted(el: HTMLElement, binding: { value?: string }) {
        el.innerHTML = binding.value ?? ''
      },
      updated(el: HTMLElement, binding: { value?: string }) {
        el.innerHTML = binding.value ?? ''
      }
    }
  }

  it('renders friend information correctly', () => {
    const wrapper = mount(FriendListItem, {
      props: {
        friend: mockFriend
      },
      global: {
        stubs: globalStubs,
        directives: globalDirectives
      }
    })

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('friend.list.online')
    expect(wrapper.text()).toContain('Available')
  })

  it('highlights search query', () => {
    const wrapper = mount(FriendListItem, {
      props: {
        friend: mockFriend,
        query: 'Ali'
      },
      global: {
        stubs: globalStubs,
        directives: globalDirectives
      }
    })

    const nameSpan = wrapper.find('.friend-list-item__name')
    expect(nameSpan.html()).toContain('<mark>Ali</mark>ce')
  })

  it('emits select event on click', async () => {
    const wrapper = mount(FriendListItem, {
      props: {
        friend: mockFriend
      },
      global: {
        stubs: globalStubs,
        directives: globalDirectives
      }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([mockFriend])
  })

  it('emits send-message event when message button is clicked', async () => {
    const wrapper = mount(FriendListItem, {
      props: {
        friend: mockFriend
      },
      global: {
        stubs: globalStubs,
        directives: globalDirectives
      }
    })

    const buttons = wrapper.findAll('button')
    // The first button is send-message based on template
    await buttons[0].trigger('click')
    expect(wrapper.emitted('send-message')).toBeTruthy()
  })

  it('applies RTL class when dir is rtl', () => {
    const wrapper = mount(FriendListItem, {
      props: {
        friend: mockFriend,
        dir: 'rtl'
      },
      global: {
        stubs: globalStubs,
        directives: globalDirectives
      }
    })

    expect(wrapper.classes()).toContain('friend-list-item--rtl')
    expect(wrapper.attributes('dir')).toBe('rtl')
  })
})
