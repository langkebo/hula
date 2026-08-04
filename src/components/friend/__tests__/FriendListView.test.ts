import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { OnlineEnum } from '@/enums'
import FriendListView from '../FriendListView.vue'

// FriendListItem 使用 v-safe-html 渲染高亮文本，测试中注册一个简单 stub 直接设置 innerHTML
const safeHtmlDirective = {
  mounted(el: HTMLElement, binding: { value?: string }) {
    el.innerHTML = binding.value ?? ''
  },
  updated(el: HTMLElement, binding: { value?: string }) {
    el.innerHTML = binding.value ?? ''
  }
}

const mountView = () =>
  mount(FriendListView, {
    global: {
      directives: {
        'safe-html': safeHtmlDirective
      }
    }
  })

const {
  routerPushMock,
  contactStoreMock,
  capabilityState,
  announceMock,
  addSpecialFriendMock,
  showFeedbackMock,
  getFriendDmRoomMock,
  openMsgSessionByRoomIdMock
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
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
  showFeedbackMock: vi.fn(),
  getFriendDmRoomMock: vi.fn(),
  openMsgSessionByRoomIdMock: vi.fn()
}))

const route = reactive({
  path: '/friend',
  name: 'friend',
  params: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>
})

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push: routerPushMock
  })
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

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

vi.mock('@/composables/search/useSearchShortcut', () => ({
  useSearchShortcut: () => {},
  triggerGlobalSearch: vi.fn()
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

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendDmRoom: getFriendDmRoomMock
  }
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSessionByRoomId: openMsgSessionByRoomIdMock
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
      },
      showGlobalSearchAction: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:modelValue', 'search', 'select-history', 'clear-history', 'global-search'],
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
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-global',
              onClick: () => emit('global-search', props.modelValue)
            },
            'global-search'
          )
        ])
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
              'data-test': 'context-menu-send-message',
              onClick: () => emit('select', { label: 'friend.context.send_message' })
            },
            'send-message'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'context-menu-secret-chat',
              onClick: () => emit('select', { label: 'friend.context.secret_chat' })
            },
            'secret-chat'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'context-menu-remove',
              onClick: () => emit('select', { label: 'friend.context.remove' })
            },
            'remove'
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
              onClick: (event: Event) => emit('click', event)
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
    // 阶段 2：重置路由状态到默认的 /friend
    route.path = '/friend'
    route.name = 'friend'
    route.params = {}
    route.query = {}
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
    // 默认：未找到已有 DM 房间，startDirectRoom 返回新房间 ID
    getFriendDmRoomMock.mockResolvedValue({ room_id: '', exists: false })
    contactStoreMock.startDirectRoom.mockResolvedValue('@new-room:example.com')
  })

  it('renders friend list semantics and marks selected friend after click', async () => {
    const wrapper = mountView()

    await flushPromises()

    const list = wrapper.get('[role="list"]')
    const items = wrapper.findAll('.friend-list-item')

    expect(list.attributes('aria-label')).toBe('friend.list.friend_list_label')
    expect(items).toHaveLength(2)
    expect(items[0]?.classes('friend-list-item--selected')).toBe(false)

    await items[0]!.trigger('click')

    // 阶段 2：单击好友项触发 router.push 跳转到好友详情路由
    expect(routerPushMock).toHaveBeenCalledWith({
      name: 'friend-details',
      params: { userId: '@alice:example.com' }
    })

    // 模拟路由变化后，选中标记应通过 route.params.userId 派生
    route.path = '/friend/@alice:example.com'
    route.name = 'friend-details'
    route.params = { userId: '@alice:example.com' }
    await flushPromises()

    expect(wrapper.findAll('.friend-list-item')[0]?.classes('friend-list-item--selected')).toBe(true)
  })

  it('restores search history and updates it after a new search', async () => {
    localStorage.setItem('tjg-friend-search-history', JSON.stringify(['Alice']))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="friend-search-history-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="friend-search-history-visible"]').text()).toBe('true')

    await wrapper.get('[data-test="friend-search-input"]').setValue('Bob')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(
      JSON.parse(localStorage.getItem('tjg-friend-search-history') || '[]').map((item: { value: string }) => item.value)
    ).toEqual(['Bob', 'Alice'])
  })

  it('shows a dedicated empty state when search has no results', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="friend-search-input"]').setValue('Charlie')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-illustration="no-results"]').exists()).toBe(true)
    expect(wrapper.find('.empty-state__description').text()).toBe('friend.search.empty_description')
    expect(wrapper.text()).toContain('friend.search.empty_title')
  })

  it('搜索结果中匹配文本被高亮标记', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('mark').exists()).toBe(false)

    await wrapper.get('[data-test="friend-search-input"]').setValue('Ali')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    const highlight = wrapper.find('mark')
    expect(highlight.exists()).toBe(true)
    expect(highlight.text()).toBe('Ali')
  })

  it('清空搜索框后恢复完整好友列表', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.friend-list-item')).toHaveLength(2)

    await wrapper.get('[data-test="friend-search-input"]').setValue('Bob')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.friend-list-item')).toHaveLength(1)

    await wrapper.get('[data-test="friend-search-input"]').setValue('')
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.friend-list-item')).toHaveLength(2)
    expect(wrapper.find('mark').exists()).toBe(false)
  })

  it('loading 状态下显示骨架屏替代 spinner', async () => {
    contactStoreMock.isLoading = true
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'SkeletonFriendList' }).exists()).toBe(true)
    expect(wrapper.findAll('.friend-list-item')).toHaveLength(0)

    contactStoreMock.isLoading = false
  })

  it('announces search progress and result feedback through live region', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="friend-search-input"]').setValue('Alice')
    await flushPromises()

    expect(announceMock).toHaveBeenCalledWith('friend.search.searching', 'polite')

    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    await flushPromises()

    expect(announceMock).toHaveBeenCalledWith('friend.search.result_count', 'polite')
  })

  it('announces secret-friend action results through live region', async () => {
    const wrapper = mountView()

    await flushPromises()

    const firstItem = wrapper.findAll('.friend-list-item')[0]
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

  it('clicking send-message action button starts a direct room with the correct user id', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstItem = wrapper.findAll('.friend-list-item')[0]
    expect(firstItem).toBeTruthy()
    // FriendListItem 渲染三个动作按钮：send-message / remove / more
    const actionButtons = firstItem!.findAll('button')
    await actionButtons[0]!.trigger('click')
    await flushPromises()

    expect(getFriendDmRoomMock).toHaveBeenCalledWith('@alice:example.com')
    expect(contactStoreMock.startDirectRoom).toHaveBeenCalledWith('@alice:example.com', false)
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('@new-room:example.com')
  })

  it('clicking send-message action button opens existing DM room without creating a new one', async () => {
    getFriendDmRoomMock.mockResolvedValue({ room_id: '@existing-dm:example.com', exists: true })

    const wrapper = mountView()
    await flushPromises()

    const firstItem = wrapper.findAll('.friend-list-item')[0]
    expect(firstItem).toBeTruthy()
    const actionButtons = firstItem!.findAll('button')
    await actionButtons[0]!.trigger('click')
    await flushPromises()

    expect(getFriendDmRoomMock).toHaveBeenCalledWith('@alice:example.com')
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('@existing-dm:example.com')
    expect(contactStoreMock.startDirectRoom).not.toHaveBeenCalled()
  })

  it('clicking remove action button removes the correct user from contacts', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstItem = wrapper.findAll('.friend-list-item')[0]
    expect(firstItem).toBeTruthy()
    const actionButtons = firstItem!.findAll('button')
    // 第二个动作按钮为 remove
    await actionButtons[1]!.trigger('click')
    await flushPromises()

    expect(contactStoreMock.removeFromContacts).toHaveBeenCalledWith('@alice:example.com')
    // send-message 路径不应被触发
    expect(getFriendDmRoomMock).not.toHaveBeenCalled()
    expect(contactStoreMock.startDirectRoom).not.toHaveBeenCalled()
  })

  it('context menu send_message action reuses the same shared helper as the action button', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstItem = wrapper.findAll('.friend-list-item')[0]
    expect(firstItem).toBeTruthy()

    await firstItem!.trigger('contextmenu')
    await wrapper.get('[data-test="context-menu-send-message"]').trigger('click')
    await flushPromises()

    expect(getFriendDmRoomMock).toHaveBeenCalledWith('@alice:example.com')
    expect(contactStoreMock.startDirectRoom).toHaveBeenCalledWith('@alice:example.com', false)
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('@new-room:example.com')
  })

  it('context menu remove action reuses the same shared helper as the action button', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstItem = wrapper.findAll('.friend-list-item')[0]
    expect(firstItem).toBeTruthy()

    await firstItem!.trigger('contextmenu')
    await wrapper.get('[data-test="context-menu-remove"]').trigger('click')
    await flushPromises()

    expect(contactStoreMock.removeFromContacts).toHaveBeenCalledWith('@alice:example.com')
    // send-message 路径不应被触发
    expect(getFriendDmRoomMock).not.toHaveBeenCalled()
    expect(contactStoreMock.startDirectRoom).not.toHaveBeenCalled()
  })
})
