import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { OnlineEnum } from '@/enums'
import FriendListView from '../FriendListView.vue'

const { contactStoreMock, capabilityState, announceMock, addSpecialFriendMock, showFeedbackMock } = vi.hoisted(() => ({
  contactStoreMock: {
    contactsList: [] as Array<Record<string, unknown>>,
    requestFriendsList: [] as Array<Record<string, unknown>>,
    isLoading: false,
    incomingRequestsCount: 0,
    lastFriendError: null as { message: string } | null,
    initialize: vi.fn(),
    startDirectRoom: vi.fn(),
    setFriendStatus: vi.fn(),
    removeFromContacts: vi.fn(),
    setFriendNote: vi.fn(),
    setFriendDisplayName: vi.fn()
  },
  capabilityState: {
    isLoaded: { value: true },
    canUseFriendList: { value: true }
  },
  announceMock: vi.fn(),
  addSpecialFriendMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
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
  useContactStore: () => contactStoreMock
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => capabilityState
}))

vi.mock('@/services/matrix/friends/MatrixSpecialFriendService', () => ({
  matrixSpecialFriendService: {
    addSpecialFriend: addSpecialFriendMock
  }
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url?: string) => url ?? ''
  }
}))

vi.mock('@/components/friend/AddFriendDialog.vue', () => ({
  default: defineComponent({
    name: 'AddFriendDialogStub',
    setup() {
      return () => h('div', { 'data-test': 'add-friend-dialog-stub' })
    }
  })
}))

vi.mock('@/components/friend/FriendRequestDialog.vue', () => ({
  default: defineComponent({
    name: 'FriendRequestDialogStub',
    setup() {
      return () => h('div', { 'data-test': 'friend-request-dialog-stub' })
    }
  })
}))

vi.mock('@/components/friend/FriendSearchBar.vue', () => ({
  default: defineComponent({
    name: 'FriendSearchBarStub',
    props: {
      modelValue: {
        type: String,
        default: ''
      },
      history: {
        type: Array,
        default: () => []
      },
      showHistory: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:modelValue', 'search', 'select-history', 'clear-history'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'friend-search-bar-stub' }, [
          h('input', {
            'data-test': 'friend-search-input',
            value: props.modelValue,
            onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value)
          }),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-submit',
              onClick: () => emit('search', props.modelValue)
            },
            'search'
          ),
          h('div', { 'data-test': 'friend-search-history-count' }, String(props.history.length)),
          h('div', { 'data-test': 'friend-search-history-visible' }, String(props.showHistory)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-select-history',
              onClick: () => emit('select-history', 'Alice')
            },
            'select-history'
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

vi.mock('@/components/friend/FriendDetailDrawer.vue', () => ({
  default: defineComponent({
    name: 'FriendDetailDrawerStub',
    props: {
      show: {
        type: Boolean,
        default: false
      },
      userId: {
        type: String,
        default: ''
      }
    },
    setup(props) {
      return () =>
        h('div', {
          'data-test': 'friend-detail-drawer-stub',
          'data-show': String(props.show),
          'data-user-id': props.userId
        })
    }
  })
}))

vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: defineComponent({
    name: 'ContextMenuStub',
    emits: ['select'],
    setup(_, { emit, expose }) {
      expose({
        show: vi.fn()
      })

      return () =>
        h('div', { 'data-test': 'context-menu-stub' }, [
          h(
            'button',
            {
              type: 'button',
              'data-test': 'context-menu-secret-chat',
              onClick: () => emit('select', { label: 'friend.context.secret_chat' })
            },
            'secret-chat'
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
    NSpin: passthrough('NSpin'),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: {
        description: {
          type: String,
          default: ''
        }
      },
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            { 'data-test': 'NEmpty', 'data-description': props.description },
            slots.default?.() ?? slots.extra?.()
          )
      }
    }),
    NFlex: passthrough('NFlex'),
    NBadge: passthrough('NBadge'),
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
            [...(slots.icon?.() ?? []), ...(slots.default?.() ?? [])]
          )
      }
    }),
    NIcon: passthrough('NIcon'),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        },
        placeholder: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit, slots }) {
        return () =>
          h('label', { 'data-test': 'NInput' }, [
            ...(slots.prefix?.() ?? []),
            h('input', {
              value: props.value,
              placeholder: props.placeholder,
              onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
            })
          ])
      }
    }),
    NDivider: passthrough('NDivider'),
    NScrollbar: passthrough('NScrollbar'),
    NAvatar: passthrough('NAvatar'),
    NTag: passthrough('NTag')
  }
})

describe('FriendListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    capabilityState.isLoaded.value = true
    capabilityState.canUseFriendList.value = true
    contactStoreMock.contactsList = [
      {
        userId: '@alice:example.com',
        displayName: 'Alice',
        name: 'Alice',
        avatarUrl: 'mxc://example/alice',
        friendStatus: 'normal',
        activeStatus: OnlineEnum.ONLINE,
        remark: '',
        lastOptTime: Date.now()
      },
      {
        userId: '@bob:example.com',
        displayName: 'Bob',
        name: 'Bob',
        avatarUrl: 'mxc://example/bob',
        friendStatus: 'blocked',
        activeStatus: 'offline',
        remark: '',
        lastOptTime: Date.now() - 86_400_000
      }
    ]
    contactStoreMock.isLoading = false
    contactStoreMock.incomingRequestsCount = 1
    contactStoreMock.lastFriendError = null
  })

  it('renders friend list semantics and marks selected friend after click', async () => {
    const wrapper = mount(FriendListView)

    await flushPromises()

    const list = wrapper.get('[role="list"]')
    const items = wrapper.findAll('[role="listitem"]')

    expect(list.attributes('aria-label')).toBe('friend.list.friend_list_label')
    expect(items).toHaveLength(2)
    expect(items[0]?.attributes('aria-current')).toBeUndefined()

    await items[0]!.trigger('click')

    expect(items[0]?.attributes('aria-current')).toBe('true')
    expect(wrapper.get('[data-test="friend-detail-drawer-stub"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-test="friend-detail-drawer-stub"]').attributes('data-user-id')).toBe('@alice:example.com')
  })

  it('restores search history and updates it after a new search', async () => {
    localStorage.setItem('hula-friend-search-history', JSON.stringify(['Alice']))

    const wrapper = mount(FriendListView)
    await flushPromises()

    expect(wrapper.get('[data-test="friend-search-history-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="friend-search-history-visible"]').text()).toBe('true')

    await wrapper.get('[data-test="friend-search-input"]').setValue('Bob')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(
      JSON.parse(localStorage.getItem('hula-friend-search-history') || '[]').map(
        (item: { value: string }) => item.value
      )
    ).toEqual(['Bob', 'Alice'])
  })

  it('shows a dedicated empty state when search has no results', async () => {
    const wrapper = mount(FriendListView)
    await flushPromises()

    await wrapper.get('[data-test="friend-search-input"]').setValue('Charlie')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="NEmpty"]').attributes('data-description')).toBe('friend.search.empty_description')
    expect(wrapper.text()).toContain('friend.search.empty_title')
  })

  it('announces search progress and result feedback through live region', async () => {
    const wrapper = mount(FriendListView)
    await flushPromises()

    await wrapper.get('[data-test="friend-search-input"]').setValue('Alice')
    await flushPromises()

    expect(announceMock).toHaveBeenCalledWith('friend.search.searching', 'polite')

    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(announceMock).toHaveBeenCalledWith('friend.search.result_count', 'polite')
  })

  it('announces secret-friend action results through live region', async () => {
    const wrapper = mount(FriendListView)

    await flushPromises()

    const firstItem = wrapper.findAll('[role="listitem"]')[0]
    expect(firstItem).toBeTruthy()

    await firstItem!.trigger('contextmenu')
    await wrapper.get('[data-test="context-menu-secret-chat"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.secret_chat.success', 'success')

    addSpecialFriendMock.mockRejectedValueOnce(new Error('secret friend failed'))

    await firstItem!.trigger('contextmenu')
    await wrapper.get('[data-test="context-menu-secret-chat"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('Error: secret friend failed', 'error')
  })
})
