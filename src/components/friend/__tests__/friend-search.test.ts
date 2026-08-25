import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'

// N-1 反馈回路：验证好友搜索过滤逻辑
// 问题报告：搜索 "test1" 无结果，但列表中存在 test1
// 预期：搜索 userId/name/displayName/remark 包含关键词的好友应匹配

// Mock 依赖
vi.mock('@vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`
      return key
    }
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
  createRouter: vi.fn(() => ({ beforeEach: vi.fn() })),
  createWebHistory: vi.fn()
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: { getFriendDmRoom: vi.fn().mockResolvedValue({ room_id: null }) }
}))

vi.mock('@/services/matrix/friends/MatrixSpecialFriendService', () => ({
  matrixSpecialFriendService: { addSpecialFriend: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({ isLoaded: { value: true }, canUseFriendList: { value: true } })
}))

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (value: string) => void) => (value: string) => fn(value)
}))

vi.mock('vue-virtual-scroller', () => ({
  RecycleScroller: defineComponent({
    name: 'RecycleScroller',
    props: ['items', 'itemSize', 'keyField'],
    render() {
      return h(
        'div',
        {},
        (this.items as unknown[]).map((item) =>
          h('div', { key: (item as Record<string, unknown>)[this.keyField] as string }, [
            this.$slots.default ? this.$slots.default({ item }) : null
          ])
        )
      )
    }
  })
}))

// 模拟 MatrixContact 数据（使用 vi.hoisted 确保 vi.mock 工厂可用）
const { mockContacts } = vi.hoisted(() => {
  const mockContacts = [
    {
      userId: '@test1:matrix.test',
      displayName: 'Test User 1',
      name: 'test1',
      avatarUrl: null,
      uid: 'test1',
      account: 'test1',
      avatar: '',
      activeStatus: 0,
      remark: '',
      lastOptTime: 0,
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: 'accepted' as const
    },
    {
      userId: '@test2:matrix.test',
      displayName: 'Test User 2',
      name: 'test2',
      avatarUrl: null,
      uid: 'test2',
      account: 'test2',
      avatar: '',
      activeStatus: 0,
      remark: '',
      lastOptTime: 0,
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: 'accepted' as const
    },
    {
      userId: '@alice:matrix.test',
      displayName: 'Alice',
      name: 'alice',
      avatarUrl: null,
      uid: 'alice',
      account: 'alice',
      avatar: '',
      activeStatus: 1,
      remark: 'Alice Remark',
      lastOptTime: Date.now(),
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: 'accepted' as const
    }
  ]
  return { mockContacts }
})

vi.mock('@/stores/domains/chat/contacts', () => {
  // 使用 shallowRef 模拟 Pinia store 的 ref 自动解包
  const contactsListRef = shallowRef(mockContacts)
  return {
    useContactStore: () => ({
      get contactsList() {
        return contactsListRef.value
      },
      requestFriendsList: [],
      incomingRequestsCount: 0,
      isLoading: false,
      lastFriendError: null,
      initialize: vi.fn().mockResolvedValue(undefined),
      acceptFriendRequest: vi.fn().mockResolvedValue(undefined),
      rejectFriendRequest: vi.fn().mockResolvedValue(undefined),
      setFriendStatus: vi.fn().mockResolvedValue(undefined),
      setFriendNote: vi.fn().mockResolvedValue(undefined),
      setFriendDisplayName: vi.fn().mockResolvedValue(undefined),
      removeFromContacts: vi.fn().mockResolvedValue(undefined),
      startDirectRoom: vi.fn().mockResolvedValue('!room:matrix.test')
    })
  }
})

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ themeContent: 'dark' })
}))

vi.mock('@/enums', () => ({
  OnlineEnum: { ONLINE: 1, OFFLINE: 0 },
  ThemeEnum: { DARK: 'dark', LIGHT: 'light' },
  StoresEnum: { CAPABILITY: 'capability' }
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (url: string | null) => url || '/logo.png' }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({ announce: vi.fn() })
}))

vi.mock('@/composables/common/useRecentSearchHistory', () => ({
  useRecentSearchHistory: () => ({
    historyValues: { value: [] },
    rememberTerm: vi.fn(),
    clearHistory: vi.fn()
  })
}))

vi.mock('@/composables/common/useSearchFeedbackSummary', () => ({
  useSearchFeedbackSummary: () => ({
    showSummary: { value: false },
    showClearAction: { value: false },
    summaryText: { value: '' },
    emptyDescription: { value: '' }
  })
}))

vi.mock('@/composables/search/useSearchShortcut', () => ({
  triggerGlobalSearch: vi.fn()
}))

// Mock useFriendGrouping to avoid transitive import of useFriends → multiple Pinia stores
vi.mock('../composables/useFriendGrouping', () => ({
  useFriendGrouping: () => ({
    shouldGroup: { value: false },
    groupedSections: { value: [] },
    toggleCollapse: vi.fn(),
    isCollapsed: vi.fn(() => false),
    loadGroups: vi.fn(async () => undefined)
  })
}))

// Stub 子组件
const stubs = {
  FriendSearchBar: defineComponent({
    name: 'FriendSearchBar',
    props: ['modelValue', 'history', 'showHistory', 'showGlobalSearchAction', 'placeholder'],
    emits: ['update:modelValue', 'search', 'select-history', 'clear-history', 'global-search'],
    methods: {
      triggerSearch(value: string) {
        this.$emit('update:modelValue', value)
        this.$emit('search', value)
      }
    },
    render() {
      return h('div', { class: 'friend-search-bar-stub' }, [
        h('input', {
          class: 'search-input',
          value: this.modelValue,
          onInput: (e: Event) => {
            this.$emit('update:modelValue', (e.target as HTMLInputElement).value)
          }
        }),
        h(
          'button',
          {
            class: 'search-trigger',
            onClick: () => this.triggerSearch(this.modelValue)
          },
          'Search'
        )
      ])
    }
  }),
  EmptyState: defineComponent({
    name: 'EmptyState',
    props: ['illustration', 'title', 'description'],
    render() {
      return h('div', { class: 'empty-state-stub' }, [this.title as string])
    }
  }),
  SkeletonFriendList: defineComponent({
    name: 'SkeletonFriendList',
    render: () => h('div', { class: 'skeleton-stub' })
  }),
  ContextMenu: defineComponent({
    name: 'ContextMenu',
    render: () => h('div', { class: 'context-menu-stub' })
  })
}

// FriendListItem 使用 v-safe-html 渲染高亮文本，测试中注册一个简单 stub 直接设置 innerHTML
const safeHtmlDirective = {
  mounted(el: HTMLElement, binding: { value?: string }) {
    el.innerHTML = binding.value ?? ''
  },
  updated(el: HTMLElement, binding: { value?: string }) {
    el.innerHTML = binding.value ?? ''
  }
}

const globalConfig = { stubs, directives: { 'safe-html': safeHtmlDirective } }

import FriendListView from '../FriendListView.vue'

describe('N-1: 好友搜索过滤逻辑', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('搜索 "test1" 应匹配 userId 包含 test1 的好友', async () => {
    const wrapper = mount(FriendListView, { global: globalConfig })
    await flushPromises()
    await nextTick()

    // 确认初始列表有 3 个好友
    const items = wrapper.findAll('.friend-list-item')
    expect(items.length).toBe(3)

    // 输入搜索关键词
    const input = wrapper.find('.search-input')
    await input.setValue('test1')

    // 触发搜索
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()

    // 应显示 test1（userId @test1:matrix.test 包含 "test1"）
    const filteredItems = wrapper.findAll('.friend-list-item')
    expect(filteredItems.length).toBe(1)
  })

  it('搜索 "test" 应匹配所有 userId 含 "matrix.test" 的好友', async () => {
    // 注意：所有 userId 都以 @username:matrix.test 结尾，
    // 所以搜索 "test" 会匹配 "matrix.test" 中的 "test"，返回全部 3 个好友。
    // 这是预期的 filter 行为（userId.includes(query)）。
    const wrapper = mount(FriendListView, { global: globalConfig })
    await flushPromises()
    await nextTick()

    const input = wrapper.find('.search-input')
    await input.setValue('test')
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()

    const filteredItems = wrapper.findAll('.friend-list-item')
    expect(filteredItems.length).toBe(3) // 所有 userId 都包含 "matrix.test"
  })

  it('搜索 "alice" 应匹配 displayName 和 remark', async () => {
    const wrapper = mount(FriendListView, { global: globalConfig })
    await flushPromises()
    await nextTick()

    const input = wrapper.find('.search-input')
    await input.setValue('alice')
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()

    const filteredItems = wrapper.findAll('.friend-list-item')
    expect(filteredItems.length).toBe(1)
  })

  it('搜索 "Remark" 应匹配 remark 字段（不区分大小写）', async () => {
    const wrapper = mount(FriendListView, { global: globalConfig })
    await flushPromises()
    await nextTick()

    const input = wrapper.find('.search-input')
    await input.setValue('remark')
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()

    const filteredItems = wrapper.findAll('.friend-list-item')
    expect(filteredItems.length).toBe(1) // Alice has remark "Alice Remark"
  })

  it('搜索不存在的好友应返回空', async () => {
    const wrapper = mount(FriendListView, { global: globalConfig })
    await flushPromises()
    await nextTick()

    const input = wrapper.find('.search-input')
    await input.setValue('nonexistent')
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()

    const filteredItems = wrapper.findAll('.friend-list-item')
    expect(filteredItems.length).toBe(0)
  })

  it('清除搜索后应显示全部好友', async () => {
    const wrapper = mount(FriendListView, { global: globalConfig })
    await flushPromises()
    await nextTick()

    // 先搜索
    const input = wrapper.find('.search-input')
    await input.setValue('test1')
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()
    expect(wrapper.findAll('.friend-list-item').length).toBe(1)

    // 清除搜索
    await input.setValue('')
    await wrapper.find('.search-trigger').trigger('click')
    await nextTick()
    await flushPromises()

    // 应显示全部
    expect(wrapper.findAll('.friend-list-item').length).toBe(3)
  })
})
