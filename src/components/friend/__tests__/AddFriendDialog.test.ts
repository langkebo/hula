import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import AddFriendDialog from '../AddFriendDialog.vue'

const { announceMock, showFeedbackMock } = vi.hoisted(() => ({
  announceMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

const searchFriendsViaApiMock = vi.fn()
const getFriendSuggestionsMock = vi.fn()
const getUserProfileMock = vi.fn()
const isFriendMock = vi.fn()
const sendFriendRequestMock = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'friend.add.result_found') {
        return `friend.add.result_found:${params?.user ?? ''}`
      }

      return key
    }
  })
}))

vi.mock('@/composables/useFriends', () => ({
  useFriends: () => ({
    getFriendSuggestions: getFriendSuggestionsMock,
    searchFriendsViaApi: searchFriendsViaApiMock
  })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({
    getUserProfile: getUserProfileMock,
    isFriend: isFriendMock,
    sendFriendRequest: sendFriendRequestMock
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
  }
}))

vi.mock('@/components/friend/FriendSearchBar.vue', () => ({
  default: defineComponent({
    name: 'FriendSearchBarStub',
    props: {
      history: {
        type: Array,
        default: () => []
      },
      showHistory: {
        type: Boolean,
        default: false
      }
    },
    emits: ['search', 'select-history', 'clear-history', 'update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'friend-search-bar-stub' }, [
          h('div', { 'data-test': 'friend-search-history-visible' }, String(props.showHistory)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-trigger',
              onClick: () => emit('search', '@alice:example.com')
            },
            'search'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-clear-history',
              onClick: () => emit('clear-history')
            },
            'clear-history'
          )
        ])
    }
  })
}))

vi.mock('naive-ui', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NModal: passthrough('NModal'),
    NFlex: passthrough('NFlex'),
    NSelect: passthrough('NSelect'),
    NSpin: passthrough('NSpin'),
    NAvatar: passthrough('NAvatar'),
    NDivider: passthrough('NDivider'),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'NButton',
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    }),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: {
        description: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('div', { 'data-test': 'NEmpty', 'data-description': props.description })
      }
    }),
    NIcon: passthrough('NIcon')
  }
})

describe('AddFriendDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getFriendSuggestionsMock.mockResolvedValue([])
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:example.com' }])
    getUserProfileMock.mockResolvedValue({
      userId: '@alice:example.com',
      displayName: 'Alice',
      avatarUrl: 'mxc://example/alice'
    })
    isFriendMock.mockResolvedValue(false)
    sendFriendRequestMock.mockResolvedValue(true)
    ;(window as any).$message = {
      info: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn()
    }
  })

  it('reuses the shared search bar and restores history for add-friend search', async () => {
    localStorage.setItem(
      'hula-add-friend-search-history',
      JSON.stringify([{ value: '@cached:example.com', updatedAt: Date.now() }])
    )

    const wrapper = mount(AddFriendDialog, {
      props: {
        show: false
      }
    })

    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(wrapper.get('[data-test="friend-search-history-visible"]').text()).toBe('true')

    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    expect(searchFriendsViaApiMock).toHaveBeenCalledWith('@alice:example.com', {
      mode: 'fuzzy',
      limit: 1
    })
    expect(wrapper.text()).toContain('friend.add.result_found:Alice')

    const storedHistory = JSON.parse(localStorage.getItem('hula-add-friend-search-history') || '[]')
    expect(storedHistory[0]?.value).toBe('@alice:example.com')

    await wrapper.get('[data-test="friend-search-clear-history"]').trigger('click')
    expect(localStorage.getItem('hula-add-friend-search-history')).toBeNull()
  })

  it('announces send-friend-request success and failure through live region', async () => {
    const wrapper = mount(AddFriendDialog, {
      props: {
        show: true
      }
    })

    await flushPromises()
    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    const sendButton = wrapper.findAll('button').find((button) => button.text() === 'friend.add.send')

    expect(sendButton).toBeTruthy()

    await sendButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.success', 'success', 'polite')

    sendFriendRequestMock.mockRejectedValueOnce(new Error('send failed'))

    await wrapper.setProps({ show: true })
    await flushPromises()
    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    const retrySendButton = wrapper.findAll('button').find((button) => button.text() === 'friend.add.send')

    expect(retrySendButton).toBeTruthy()

    await retrySendButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('send failed', 'error', 'assertive')
  })

  it('announces already-friend info and search failures through live region', async () => {
    const wrapper = mount(AddFriendDialog, {
      props: {
        show: true
      }
    })

    isFriendMock.mockResolvedValueOnce(true)

    await flushPromises()
    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.already_friend', 'info', 'polite')

    searchFriendsViaApiMock.mockRejectedValueOnce(new Error('search failed'))

    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('search failed', 'error', 'assertive')
  })

  it('announces overlong verification message through live region', async () => {
    const wrapper = mount(AddFriendDialog, {
      props: {
        show: true
      }
    })

    await flushPromises()
    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    await wrapper.get('input').setValue('x'.repeat(501))
    await flushPromises()

    const sendButton = wrapper.findAll('button').find((button) => button.text() === 'friend.add.send')

    expect(sendButton).toBeTruthy()

    await sendButton!.trigger('click')
    await flushPromises()

    expect(sendFriendRequestMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.message_too_long', 'warning', 'assertive')
  })
})
