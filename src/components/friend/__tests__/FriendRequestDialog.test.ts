import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FriendRequestDialog from '../FriendRequestDialog.vue'

const requestFriendsListMock = [
  {
    userId: '@alice:example.com',
    displayName: 'Alice',
    avatarUrl: 'mxc://example/alice',
    direction: 'incoming',
    message: 'design sync'
  },
  {
    userId: '@bob:example.com',
    displayName: 'Bob',
    avatarUrl: 'mxc://example/bob',
    direction: 'outgoing',
    message: 'backend follow-up'
  }
]

const { contactStoreMock, announceMock, showFeedbackMock } = vi.hoisted(() => ({
  contactStoreMock: {
    requestFriendsList: [] as Array<Record<string, unknown>>,
    loadFriendRequests: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn()
  },
  announceMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'friend.request.result_count') {
        return `friend.request.result_count:${params?.keyword ?? ''}:${params?.count ?? ''}`
      }

      return key
    }
  })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
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

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url?: string) => url ?? ''
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
    emits: ['search'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'friend-search-bar-stub' }, [
          h('div', { 'data-test': 'friend-search-history-visible' }, String(props.showHistory)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-trigger',
              onClick: () => emit('search', 'backend')
            },
            'search'
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
    NTabs: passthrough('NTabs'),
    NTabPane: passthrough('NTabPane'),
    NBadge: passthrough('NBadge'),
    NScrollbar: passthrough('NScrollbar'),
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
    NFlex: passthrough('NFlex'),
    NAvatar: passthrough('NAvatar'),
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
    })
  }
})

describe('FriendRequestDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    contactStoreMock.requestFriendsList = requestFriendsListMock
    ;(window as any).$message = {
      success: vi.fn(),
      error: vi.fn()
    }
  })

  it('filters requests via the shared search bar and renders unified search summary feedback', async () => {
    localStorage.setItem(
      'hula-friend-request-search-history',
      JSON.stringify([{ value: 'backend', updatedAt: Date.now() }])
    )

    const wrapper = mount(FriendRequestDialog, {
      props: {
        show: false
      }
    })
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(contactStoreMock.loadFriendRequests).toHaveBeenCalled()
    expect(wrapper.get('[data-test="friend-search-history-visible"]').text()).toBe('true')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')

    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('friend.request.result_count:backend:1')
    expect(wrapper.text()).toContain('friend.search.clear_current')
    expect(wrapper.text()).not.toContain('Alice')
    expect(wrapper.text()).toContain('Bob')

    await wrapper.get('.friend-request-dialog__search-clear').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).not.toContain('friend.request.result_count:backend:1')
  })

  it('announces accept and reject request results through live region', async () => {
    const wrapper = mount(FriendRequestDialog, {
      props: {
        show: false
      }
    })

    await wrapper.setProps({ show: true })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const acceptButton = buttons.find((button) => button.text() === 'friend.request.accept')
    const rejectButton = buttons.find((button) => button.text() === 'friend.request.reject')

    expect(acceptButton).toBeTruthy()
    expect(rejectButton).toBeTruthy()

    await acceptButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.success.accept', 'success')

    await rejectButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.success.reject', 'success')
  })

  it('announces cancel request results through live region', async () => {
    const wrapper = mount(FriendRequestDialog, {
      props: {
        show: false
      }
    })

    await wrapper.setProps({ show: true })
    await flushPromises()

    const cancelButton = wrapper.findAll('button').find((button) => button.text() === 'friend.request.cancel')

    expect(cancelButton).toBeTruthy()

    await cancelButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.success.cancel', 'success')

    contactStoreMock.cancelFriendRequest.mockRejectedValueOnce(new Error('cancel failed'))

    await cancelButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.error.cancel', 'error')
  })

  it('announces accept and reject request failures through live region', async () => {
    contactStoreMock.acceptFriendRequest.mockRejectedValueOnce(new Error('accept failed'))
    contactStoreMock.rejectFriendRequest.mockRejectedValueOnce(new Error('reject failed'))

    const wrapper = mount(FriendRequestDialog, {
      props: {
        show: false
      }
    })

    await wrapper.setProps({ show: true })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const acceptButton = buttons.find((button) => button.text() === 'friend.request.accept')
    const rejectButton = buttons.find((button) => button.text() === 'friend.request.reject')

    expect(acceptButton).toBeTruthy()
    expect(rejectButton).toBeTruthy()

    await acceptButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.error.accept', 'error')

    await rejectButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.request.error.reject', 'error')
  })
})
