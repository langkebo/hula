import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import AddFriendPane from '../AddFriendPane.vue'

// === Mocks ===
const {
  searchFriendsViaApiMock,
  getFriendSuggestionsMock,
  searchUsersMock,
  getUserProfileMock,
  isFriendMock,
  sendFriendRequestMock,
  showFeedbackMock,
  announceMock,
  routerBackMock,
  rememberTermMock,
  clearHistoryMock,
  requestFriendsListRef
} = vi.hoisted(() => ({
  searchFriendsViaApiMock: vi.fn(),
  getFriendSuggestionsMock: vi.fn(),
  searchUsersMock: vi.fn(),
  getUserProfileMock: vi.fn(),
  isFriendMock: vi.fn(),
  sendFriendRequestMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  announceMock: vi.fn(),
  routerBackMock: vi.fn(),
  rememberTermMock: vi.fn(),
  clearHistoryMock: vi.fn(),
  requestFriendsListRef: { value: [] as Array<{ userId: string; direction: string }> }
}))

// draftData 必须在 vi.hoisted 外部声明（reactive 在 hoisting 阶段不可用）
const draftData = reactive({
  searchValue: '',
  searchMode: 'fuzzy' as 'fuzzy' | 'exact',
  requestMessage: ''
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({ announce: announceMock })
}))

vi.mock('@/composables/common/useRecentSearchHistory', () => ({
  useRecentSearchHistory: () => ({
    historyValues: ref<string[]>([]),
    rememberTerm: rememberTermMock,
    clearHistory: clearHistoryMock
  })
}))

vi.mock('@/composables/common/useSearchFeedbackSummary', () => ({
  useSearchFeedbackSummary: () => ({
    hasSearchKeyword: ref(false),
    showSummary: ref(false),
    showClearAction: ref(false),
    summaryText: ref(''),
    emptyDescription: ref('')
  })
}))

vi.mock('@/composables/useFriends', () => ({
  useFriends: () => ({
    searchFriendsViaApi: searchFriendsViaApiMock,
    getFriendSuggestions: getFriendSuggestionsMock
  })
}))

vi.mock('@/services/matrix/user/MatrixContactService', () => ({
  matrixContactService: { searchUsers: searchUsersMock }
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({
    getUserProfile: getUserProfileMock,
    isFriend: isFriendMock,
    sendFriendRequest: sendFriendRequestMock,
    requestFriendsList: requestFriendsListRef.value
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ themeContent: 'light' })
}))

vi.mock('@/enums', () => ({
  ThemeEnum: { LIGHT: 'light', DARK: 'dark' }
}))

vi.mock('@/stores/domains/widget/rightViewDraft', () => ({
  useRightViewDraftStore: () => ({
    // Pinia setup store 自动解包 ref，mock 中直接返回 reactive 对象模拟此行为
    addFriend: draftData,
    saveAddFriend: vi.fn((patch: Partial<typeof draftData>) => {
      Object.assign(draftData, patch)
    }),
    clearAddFriend: vi.fn(() => {
      draftData.searchValue = ''
      draftData.searchMode = 'fuzzy'
      draftData.requestMessage = ''
    }),
    restoredHint: null,
    setRestoredHint: vi.fn()
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (url: string) => url }
}))

vi.mock('@/router', () => ({
  default: { back: routerBackMock, push: vi.fn(), replace: vi.fn() }
}))

// Stub FriendSearchBar
vi.mock('../FriendSearchBar.vue', () => ({
  default: defineComponent({
    name: 'FriendSearchBar',
    props: {
      modelValue: { type: String, default: '' },
      history: { type: Array, default: () => [] },
      showHistory: Boolean,
      placeholder: String
    },
    emits: ['update:modelValue', 'search', 'select-history', 'clear-history'],
    setup(props, { emit }) {
      return () =>
        h('div', { class: 'friend-search-bar-stub' }, [
          h('input', {
            class: 'friend-search-bar-stub__input',
            value: props.modelValue,
            placeholder: props.placeholder,
            onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value)
          }),
          h(
            'button',
            {
              class: 'friend-search-bar-stub__search',
              onClick: () => emit('search', props.modelValue)
            },
            'search'
          ),
          h(
            'button',
            {
              class: 'friend-search-bar-stub__select-history',
              onClick: () => emit('select-history', 'history-term')
            },
            'history'
          ),
          h(
            'button',
            {
              class: 'friend-search-bar-stub__clear-history',
              onClick: () => emit('clear-history')
            },
            'clear'
          )
        ])
    }
  })
}))

vi.mock('naive-ui', () => {
  const stub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { class: `n-${name.toLowerCase()}` }, [slots.default?.()])
      }
    })
  return {
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: { type: String, default: '' },
        placeholder: String,
        type: { type: String, default: 'text' },
        maxlength: Number,
        showCount: Boolean
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('textarea', {
            class: 'n-input',
            value: props.value,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NSelect: defineComponent({
      name: 'NSelect',
      props: { value: { type: String, default: '' }, options: Array, size: String },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h(
            'select',
            {
              class: 'n-select',
              value: props.value,
              onChange: (e: Event) => emit('update:value', (e.target as HTMLSelectElement).value)
            },
            ((props.options as Array<{ label: string; value: string }>) || []).map((o) =>
              h('option', { value: o.value }, o.label)
            )
          )
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: { type: String, loading: Boolean, size: String, ghost: Boolean },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              class: ['n-button', `n-button--${props.type || 'default'}`],
              disabled: props.loading,
              onClick: (e: MouseEvent) => emit('click', e)
            },
            [slots.default?.()]
          )
      }
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: { src: String, size: Number, round: Boolean, fallbackSrc: String },
      setup(props) {
        return () => h('span', { class: 'n-avatar' }, props.src || 'avatar')
      }
    }),
    NFlex: stub('Flex'),
    NScrollbar: stub('Scrollbar'),
    NSpin: defineComponent({
      name: 'NSpin',
      props: { show: Boolean },
      setup(_, { slots }) {
        return () => h('div', { class: 'n-spin' }, [slots.default?.()])
      }
    }),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: { description: String, size: String },
      setup(props, { slots }) {
        return () => h('div', { class: 'n-empty' }, [slots.icon?.(), h('span', props.description), slots.extra?.()])
      }
    }),
    NDivider: stub('Divider'),
    NIcon: stub('Icon')
  }
})

// === Fixtures ===
const mountPane = () => mount(AddFriendPane)

describe('AddFriendPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draftData.searchValue = ''
    draftData.searchMode = 'fuzzy'
    draftData.requestMessage = ''
    searchFriendsViaApiMock.mockResolvedValue([])
    getFriendSuggestionsMock.mockResolvedValue([])
    searchUsersMock.mockResolvedValue([])
    getUserProfileMock.mockResolvedValue(null)
    isFriendMock.mockResolvedValue(false)
    requestFriendsListRef.value = []
    sendFriendRequestMock.mockResolvedValue(true)
  })

  // (a) 渲染
  it('renders the add friend pane with search bar', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.add-friend-pane').exists()).toBe(true)
    expect(wrapper.find('.friend-search-bar-stub').exists()).toBe(true)
  })

  it('renders suggestions when available', async () => {
    getFriendSuggestionsMock.mockResolvedValue([
      { user_id: '@suggestion:server', display_name: 'Suggestion', avatar_url: '' }
    ])
    const wrapper = mountPane()
    await flushPromises()

    expect(wrapper.find('.suggestions-section').exists()).toBe(true)
    expect(wrapper.findAll('.suggestion-item')).toHaveLength(1)
  })

  // (b) 输入 userId + message
  it('searches for user via searchFriendsViaApi when search is triggered', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    const searchInput = wrapper.find('.friend-search-bar-stub__input')
    await searchInput.setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    expect(searchFriendsViaApiMock).toHaveBeenCalledWith('alice', { mode: 'fuzzy', limit: 1 })
    expect(getUserProfileMock).toHaveBeenCalledWith('@alice:server')
  })

  it('falls back to matrixContactService.searchUsers when searchFriendsViaApi returns empty', async () => {
    searchFriendsViaApiMock.mockResolvedValue([])
    searchUsersMock.mockResolvedValue([{ userId: '@bob:server', displayName: 'Bob' }])
    getUserProfileMock.mockResolvedValue({ userId: '@bob:server', displayName: 'Bob', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('bob')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    expect(searchUsersMock).toHaveBeenCalledWith('bob')
    expect(getUserProfileMock).toHaveBeenCalledWith('@bob:server')
  })

  it('shows search result with avatar and request message textarea', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    expect(wrapper.find('.search-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alice')
    // 消息输入框
    expect(wrapper.findAll('.n-input').length).toBeGreaterThanOrEqual(1)
  })

  it('shows already_friend info when user is already a friend', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    isFriendMock.mockResolvedValue(true)
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.already_friend', 'info', 'polite')
  })

  // (c) 提交调用 contactStore.sendFriendRequest
  it('calls contactStore.sendFriendRequest on submit', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    // 输入验证消息
    const messageInput = wrapper.find('.n-input')
    await messageInput.setValue('Hello, please add me')
    await flushPromises()

    // 点击发送按钮
    const sendBtn = wrapper.find('button.n-button--primary')
    await sendBtn.trigger('click')
    await flushPromises()

    expect(sendFriendRequestMock).toHaveBeenCalledWith('@alice:server', 'Hello, please add me')
  })

  // (e) 提交成功后清空 + Toast
  it('shows success toast, clears draft and navigates back on successful send', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    sendFriendRequestMock.mockResolvedValue(true)
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.success', 'success', 'polite')
    expect(draftData.searchValue).toBe('')
    expect(draftData.requestMessage).toBe('')
    expect(routerBackMock).toHaveBeenCalled()
  })

  // (f) 错误 Toast
  it('shows error toast when sendFriendRequest throws', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    sendFriendRequestMock.mockRejectedValue(new Error('network error'))
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('network error', 'error', 'assertive')
  })

  // (g) 发送前查重：已是好友时不发送请求
  it('blocks sending when target is already a friend', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    isFriendMock.mockResolvedValue(true)
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(sendFriendRequestMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.already_friend', 'info', 'polite')
  })

  // (h) 发送前查重：已有待处理请求时不重复发送
  it('blocks sending when a friend request is already pending', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    isFriendMock.mockResolvedValue(false)
    // 注入一条 outgoing 待处理请求
    requestFriendsListRef.value = [{ userId: '@alice:server', direction: 'outgoing' }]
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(sendFriendRequestMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.request_pending', 'info', 'polite')
  })

  it('does not show success toast when sendFriendRequest returns false', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    sendFriendRequestMock.mockResolvedValue(false)
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    // 返回 false 时不显示 success toast（无 success feedback）
    expect(showFeedbackMock).not.toHaveBeenCalledWith('friend.add.success', 'success', 'polite')
  })

  it('shows error toast when search fails', async () => {
    searchFriendsViaApiMock.mockRejectedValue(new Error('search failed'))
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('search failed', 'error', 'assertive')
  })

  it('shows not_found empty state when search returns no results', async () => {
    searchFriendsViaApiMock.mockResolvedValue([])
    searchUsersMock.mockResolvedValue([])
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('nobody')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  // (d) 草稿恢复
  it('restores draft from store on mount and shows hint', async () => {
    draftData.searchValue = '@draft:server'
    draftData.searchMode = 'exact'
    draftData.requestMessage = 'draft message'
    const wrapper = mountPane()
    await flushPromises()

    // <script setup> 变量不暴露在 vm 上，通过 UI 断言
    expect(wrapper.find('.add-friend-pane__hint').exists()).toBe(true)
    const searchInput = wrapper.find('.friend-search-bar-stub__input')
    expect((searchInput.element as HTMLInputElement).value).toBe('@draft:server')
  })

  it('does not show restored hint when no draft exists', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.add-friend-pane__hint').exists()).toBe(false)
  })

  // 自动同步草稿
  it('saves draft to store when search value changes', async () => {
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('@sync:server')
    await flushPromises()

    expect(draftData.searchValue).toBe('@sync:server')
  })

  // 选择建议项
  it('searches when selecting a suggestion', async () => {
    getFriendSuggestionsMock.mockResolvedValue([
      { user_id: '@suggestion:server', display_name: 'Suggestion', avatar_url: '' }
    ])
    getUserProfileMock.mockResolvedValue({ userId: '@suggestion:server', displayName: 'Suggestion', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    const suggestionItem = wrapper.find('.suggestion-item')
    await suggestionItem.trigger('click')
    await flushPromises()

    expect(getUserProfileMock).toHaveBeenCalledWith('@suggestion:server')
    expect(wrapper.find('.search-result').exists()).toBe(true)
  })

  // 消息超长验证
  it('shows warning toast when message exceeds 500 chars', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@alice:server', display_name: 'Alice' }])
    getUserProfileMock.mockResolvedValue({ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__input').setValue('alice')
    await wrapper.find('.friend-search-bar-stub__search').trigger('click')
    await flushPromises()

    // 通过 UI 设置超长消息（<script setup> 变量不暴露在 vm 上）
    const messageTextarea = wrapper.find('.n-input')
    await messageTextarea.setValue('x'.repeat(501))
    await wrapper.vm.$nextTick()

    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('friend.add.message_too_long', 'warning', 'assertive')
    expect(sendFriendRequestMock).not.toHaveBeenCalled()
  })

  // 历史记录交互
  it('triggers search when selecting a history term', async () => {
    searchFriendsViaApiMock.mockResolvedValue([{ user_id: '@history:server', display_name: 'History' }])
    getUserProfileMock.mockResolvedValue({ userId: '@history:server', displayName: 'History', avatarUrl: '' })
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__select-history').trigger('click')
    await flushPromises()

    expect(searchFriendsViaApiMock).toHaveBeenCalledWith('history-term', expect.any(Object))
  })

  it('clears search history when clear-history event fires', async () => {
    const wrapper = mountPane()
    await flushPromises()

    await wrapper.find('.friend-search-bar-stub__clear-history').trigger('click')

    expect(clearHistoryMock).toHaveBeenCalled()
  })
})
