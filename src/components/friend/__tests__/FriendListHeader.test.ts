import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { FriendRequestItem } from '@/stores/domains/chat/contacts'
import type { FriendStatus } from '@/types/matrix-services'
import FriendListHeader from '../FriendListHeader.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'friend.list.pending_requests') return `pending ${params?.count ?? 0}`
      return key
    }
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url?: string) => url ?? ''
  }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
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

// Stub FriendSearchBar to expose deterministic hooks for testing.
const FriendSearchBarStub = defineComponent({
  name: 'FriendSearchBar',
  props: {
    modelValue: { type: String, default: '' },
    history: { type: Array, default: () => [] },
    showHistory: { type: Boolean, default: false },
    showGlobalSearchAction: { type: Boolean, default: false },
    placeholder: { type: String, default: '' }
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

const FriendRequestCardStub = defineComponent({
  name: 'FriendRequestCard',
  props: {
    request: { type: Object, required: true },
    processing: { type: Boolean, default: false }
  },
  emits: ['accept', 'reject', 'cancel'],
  setup(props, { emit }) {
    return () =>
      h('div', { 'data-test': 'friend-request-card-stub' }, [
        h('span', { 'data-test': 'friend-request-name' }, props.request.displayName || props.request.userId),
        h(
          'button',
          {
            type: 'button',
            'data-test': 'friend-request-accept',
            onClick: () => emit('accept', props.request)
          },
          'accept'
        ),
        h(
          'button',
          {
            type: 'button',
            'data-test': 'friend-request-reject',
            onClick: () => emit('reject', props.request)
          },
          'reject'
        )
      ])
  }
})

const naiveStubs = {
  NFlex: { template: '<div class="n-flex"><slot /></div>' },
  NBadge: { template: '<span class="n-badge"><slot /></span>' },
  NButton: {
    template: '<button class="n-button" @click="$emit(\'click\', $event)"><slot name="icon" /><slot /></button>'
  },
  NIcon: { template: '<span class="n-icon"><slot /></span>' }
}

const baseProps = {
  title: '好友',
  requestCount: 0,
  searchValue: '',
  searchHistory: [] as string[],
  showSearchHistory: false,
  searchPlaceholder: 'search friends',
  filterValue: 'all' as FriendStatus | 'all',
  filterOptions: [
    { label: 'All', value: 'all' as FriendStatus | 'all' },
    { label: 'Favorite', value: 'favorite' as FriendStatus | 'all' }
  ],
  previewRequests: [] as FriendRequestItem[],
  processingRequest: null as string | null,
  showSearchSummary: false,
  searchSummaryText: '',
  showSearchClearAction: false,
  getFilterCount: (_status: FriendStatus | 'all') => 0
}

const mountHeader = (overrides: Record<string, unknown> = {}) =>
  mount(FriendListHeader, {
    props: { ...baseProps, ...overrides },
    global: {
      stubs: {
        FriendSearchBar: FriendSearchBarStub,
        FriendRequestCard: FriendRequestCardStub,
        ...naiveStubs
      }
    }
  })

describe('FriendListHeader', () => {
  it('renders title and add button', () => {
    const wrapper = mountHeader()
    expect(wrapper.text()).toContain('好友')
    // add button (plus icon) and requests button (bell icon) are rendered
    const buttons = wrapper.findAll('.n-button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('renders request badge count when requestCount > 0', () => {
    const wrapper = mountHeader({ requestCount: 3 })
    // Badge should be visible (NBadge stub renders its slot regardless; verify the bell button label)
    expect(wrapper.find('[aria-label="pending 3"]').exists()).toBe(true)
  })

  it('emits click:add when add button is clicked', async () => {
    const wrapper = mountHeader()
    // The add button is the first circle button (with plus icon) - aria-label is menu.add_contact
    const addButton = wrapper.find('[aria-label="menu.add_contact"]')
    expect(addButton.exists()).toBe(true)
    await addButton.trigger('click')
    expect(wrapper.emitted('click:add')).toBeTruthy()
  })

  it('emits click:requests when requests button is clicked', async () => {
    const wrapper = mountHeader({ requestCount: 2 })
    const requestsButton = wrapper.find('[aria-label="pending 2"]')
    expect(requestsButton.exists()).toBe(true)
    await requestsButton.trigger('click')
    expect(wrapper.emitted('click:requests')).toBeTruthy()
  })

  it('emits update:searchValue when search bar input changes', async () => {
    const wrapper = mountHeader()
    await wrapper.get('[data-test="friend-search-input"]').setValue('Alice')
    expect(wrapper.emitted('update:searchValue')?.[0]).toEqual(['Alice'])
  })

  it('emits search when search submit is triggered', async () => {
    const wrapper = mountHeader({ searchValue: 'Bob' })
    await wrapper.get('[data-test="friend-search-submit"]').trigger('click')
    expect(wrapper.emitted('search')?.[0]).toEqual(['Bob'])
  })

  it('emits select-history when history selection is triggered', async () => {
    const wrapper = mountHeader()
    await wrapper.get('[data-test="friend-search-select-history"]').trigger('click')
    expect(wrapper.emitted('select-history')?.[0]).toEqual(['Alice'])
  })

  it('emits clear-history when clear history is triggered', async () => {
    const wrapper = mountHeader()
    await wrapper.get('[data-test="friend-search-clear-history"]').trigger('click')
    expect(wrapper.emitted('clear-history')).toBeTruthy()
  })

  it('emits global-search when global search is triggered', async () => {
    const wrapper = mountHeader({ searchValue: 'Carol' })
    await wrapper.get('[data-test="friend-search-global"]').trigger('click')
    expect(wrapper.emitted('global-search')?.[0]).toEqual(['Carol'])
  })

  it('renders preview requests when requestCount > 0', () => {
    const wrapper = mountHeader({
      requestCount: 1,
      previewRequests: [mockRequest]
    })
    expect(wrapper.find('[data-test="friend-request-card-stub"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Bob')
  })

  it('emits quick-accept when preview request accept button is clicked', async () => {
    const wrapper = mountHeader({
      requestCount: 1,
      previewRequests: [mockRequest]
    })
    await wrapper.get('[data-test="friend-request-accept"]').trigger('click')
    expect(wrapper.emitted('quick-accept')?.[0]).toEqual([mockRequest])
  })

  it('emits quick-reject when preview request reject button is clicked', async () => {
    const wrapper = mountHeader({
      requestCount: 1,
      previewRequests: [mockRequest]
    })
    await wrapper.get('[data-test="friend-request-reject"]').trigger('click')
    expect(wrapper.emitted('quick-reject')?.[0]).toEqual([mockRequest])
  })

  it('renders search summary when showSearchSummary is true', () => {
    const wrapper = mountHeader({
      showSearchSummary: true,
      searchSummaryText: '3 results found'
    })
    const summary = wrapper.find('.friend-list-view__search-summary')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('3 results found')
  })

  it('emits clear-active-search when clear action button is clicked', async () => {
    const wrapper = mountHeader({
      showSearchSummary: true,
      searchSummaryText: '3 results found',
      showSearchClearAction: true
    })
    const clearButton = wrapper.find('.friend-list-view__search-clear')
    expect(clearButton.exists()).toBe(true)
    await clearButton.trigger('click')
    expect(wrapper.emitted('clear-active-search')).toBeTruthy()
  })

  it('renders filter buttons with labels', () => {
    const wrapper = mountHeader()
    const filterButtons = wrapper.findAll('[data-test="filter-button"]')
    expect(filterButtons).toHaveLength(2)
    expect(filterButtons[0]?.text()).toContain('All')
    expect(filterButtons[1]?.text()).toContain('Favorite')
  })

  it('emits update:filterValue when a filter button is clicked', async () => {
    const wrapper = mountHeader()
    const filterButtons = wrapper.findAll('[data-test="filter-button"]')
    await filterButtons[1]!.trigger('click')
    expect(wrapper.emitted('update:filterValue')?.[0]).toEqual(['favorite'])
  })

  it('marks the active filter button as pressed', () => {
    const wrapper = mountHeader({ filterValue: 'favorite' })
    const filterButtons = wrapper.findAll('[data-test="filter-button"]')
    expect(filterButtons[0]?.attributes('aria-pressed')).toBe('false')
    expect(filterButtons[1]?.attributes('aria-pressed')).toBe('true')
  })

  it('shows filter count badge when count > 0', () => {
    const wrapper = mountHeader({
      filterValue: 'all',
      getFilterCount: (status: FriendStatus | 'all') => (status === 'favorite' ? 5 : 0)
    })
    const filterButtons = wrapper.findAll('[data-test="filter-button"]')
    // Favorite button (index 1) should have a badge with count 5
    expect(filterButtons[1]?.text()).toContain('5')
  })
})
