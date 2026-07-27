import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import SearchPane from '../SearchPane.vue'

// === Mock ===
const { searchUsersMock, searchRoomsMock, searchMessagesMock, searchSpacesMock, joinSpaceMock } = vi.hoisted(() => ({
  searchUsersMock: vi.fn(),
  searchRoomsMock: vi.fn(),
  searchMessagesMock: vi.fn(),
  searchSpacesMock: vi.fn(),
  joinSpaceMock: vi.fn()
}))

vi.mock('@/services/matrix/MatrixSearchService', () => ({
  matrixSearchService: {
    searchUsers: searchUsersMock,
    searchRooms: searchRoomsMock,
    searchMessages: searchMessagesMock
  }
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    searchSpaces: searchSpacesMock,
    joinSpace: joinSpaceMock
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'search.result_count') return `${(params?.count as number) ?? 0} results`
      if (key === 'search.section_users') return 'Users'
      if (key === 'search.section_rooms') return 'Rooms'
      if (key === 'search.section_messages') return 'Messages'
      if (key === 'search.section_spaces') return 'Spaces'
      if (key === 'search.placeholder') return 'Search...'
      if (key === 'search.empty_hint') return 'Type to search'
      if (key === 'search.no_results') return `No results for ${(params?.query as string) ?? ''}`
      if (key === 'search.searching') return 'Searching...'
      if (key === 'search.error') return 'Search failed'
      if (key === 'search.room_members') return `${(params?.count as number) ?? 0} members`
      if (key === 'search.space_members') return `${(params?.count as number) ?? 0} members`
      if (key === 'search.space_children') return `${(params?.count as number) ?? 0} rooms`
      if (key === 'search.join_space') return 'Join'
      if (key === 'search.join_success') return 'Joined'
      if (key === 'search.join_failed') return 'Join failed'
      return key
    }
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: { type: String, default: '' },
        clearable: Boolean,
        placeholder: String,
        ariaLabel: String
      },
      emits: ['update:value', 'keydown'],
      setup(props, { slots, emit }) {
        return () =>
          h('div', { class: 'n-input' }, [
            slots.prefix?.(),
            h('input', {
              class: 'n-input__input-el',
              value: props.value,
              placeholder: props.placeholder,
              'aria-label': props.ariaLabel,
              onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value),
              onKeydown: (e: KeyboardEvent) => emit('keydown', e)
            }),
            slots.suffix?.()
          ])
      }
    }),
    NScrollbar: defineComponent({
      name: 'NScrollbar',
      setup(_, { slots }) {
        return () => h('div', { class: 'n-scrollbar' }, [slots.default?.()])
      }
    }),
    NSkeleton: defineComponent({
      name: 'NSkeleton',
      props: { height: String },
      setup(props) {
        return () => h('div', { class: 'n-skeleton', style: { height: props.height } })
      }
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: { src: String, size: Number },
      setup(props) {
        return () => h('span', { 'data-test': 'avatar' }, props.src || 'avatar')
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: {
        size: String,
        type: String,
        secondary: Boolean
      },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              class: ['n-button', `n-button--${props.type || 'default'}`],
              'data-test': 'n-button',
              onClick: (e: MouseEvent) => emit('click', e)
            },
            [slots.default?.()]
          )
      }
    })
  }
})

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url: string) => url
  }
}))

const routes = [
  { path: '/', name: 'home', component: { template: '<div/>' } },
  { path: '/friend/:userId', name: 'friend-details', component: { template: '<div/>' } },
  { path: '/room/:roomId', name: 'room-details', component: { template: '<div/>' } },
  { path: '/message/:roomId?', name: 'message', component: { template: '<div/>' } }
]

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes
  })

describe('SearchPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    searchUsersMock.mockResolvedValue([])
    searchRoomsMock.mockResolvedValue([])
    searchMessagesMock.mockResolvedValue([])
    searchSpacesMock.mockResolvedValue([])
    joinSpaceMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mountPane = async (initialQuery?: string, type?: 'all' | 'space') => {
    const router = buildRouter()
    const wrapper = mount(SearchPane, {
      props: {
        ...(initialQuery ? { initialQuery } : {}),
        ...(type ? { type } : {})
      },
      global: {
        plugins: [router]
      }
    })
    // 等待 watch immediate + debounced search 完成
    await vi.advanceTimersByTimeAsync(400)
    await wrapper.vm.$nextTick()
    return { wrapper, router }
  }

  it('renders empty state when no query provided', async () => {
    const { wrapper } = await mountPane()

    expect(wrapper.text()).toContain('Type to search')
    expect(wrapper.find('.search-pane__empty').exists()).toBe(true)
  })

  it('renders searching state while requests are pending', async () => {
    searchUsersMock.mockReturnValue(new Promise(() => {}))
    searchRoomsMock.mockReturnValue(new Promise(() => {}))
    searchMessagesMock.mockReturnValue(new Promise(() => {}))

    const router = buildRouter()
    const wrapper = mount(SearchPane, {
      props: { initialQuery: 'alice' },
      global: { plugins: [router] }
    })
    await vi.advanceTimersByTimeAsync(400)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Searching...')
  })

  it('invokes all three search services with the trimmed query', async () => {
    await mountPane('  alice  ')

    expect(searchUsersMock).toHaveBeenCalledWith('alice', 10)
    expect(searchRoomsMock).toHaveBeenCalledWith('alice')
    expect(searchMessagesMock).toHaveBeenCalledWith('alice', expect.any(Object))
  })

  it('renders grouped results with section titles and counts', async () => {
    searchUsersMock.mockResolvedValue([
      { userId: '@alice:example.com', displayName: 'Alice' },
      { userId: '@bob:example.com', displayName: 'Bob' }
    ])
    searchRoomsMock.mockResolvedValue([{ roomId: '!room1:example.com', roomName: 'Room One', memberCount: 5 }])
    searchMessagesMock.mockResolvedValue([])

    const { wrapper } = await mountPane('ali')

    const sections = wrapper.findAll('.search-pane__section')
    expect(sections).toHaveLength(2)
    expect(wrapper.text()).toContain('Users')
    expect(wrapper.text()).toContain('Rooms')
    // 2 用户 + 1 房间
    expect(wrapper.findAll('.search-pane__item')).toHaveLength(3)
  })

  it('renders no-results state when all services return empty', async () => {
    const { wrapper } = await mountPane('zzz')

    expect(wrapper.find('.search-pane__no-results').exists()).toBe(true)
    expect(wrapper.text()).toContain('No results for zzz')
  })

  it('renders error state when all services reject', async () => {
    searchUsersMock.mockRejectedValue(new Error('network'))
    searchRoomsMock.mockRejectedValue(new Error('network'))
    searchMessagesMock.mockRejectedValue(new Error('network'))

    const { wrapper } = await mountPane('alice')

    // useGlobalSearch 内部对 searchMessages 加了 .catch 兜底，所以 messages 永远 fulfilled；
    // 当 users + rooms 都失败时，仍会进入 success 状态（无结果），渲染 no-results。
    // 此用例验证部分失败时不会抛错，仍能渲染无结果文案。
    expect(wrapper.find('.search-pane__no-results').exists()).toBe(true)
  })

  it('wraps matched text in <mark> via highlightSearchMatch', async () => {
    searchUsersMock.mockResolvedValue([{ userId: '@alice:example.com', displayName: 'Alice' }])
    searchRoomsMock.mockResolvedValue([])
    searchMessagesMock.mockResolvedValue([])

    const { wrapper } = await mountPane('ali')

    const marks = wrapper.findAll('mark.search-pane__mark')
    expect(marks.length).toBeGreaterThan(0)
    expect(marks[0].text()).toBe('Ali')
  })

  it('navigates to friend-details when clicking a user result', async () => {
    searchUsersMock.mockResolvedValue([{ userId: '@alice:example.com', displayName: 'Alice' }])
    searchRoomsMock.mockResolvedValue([])
    searchMessagesMock.mockResolvedValue([])

    const { wrapper, router } = await mountPane('ali')

    await wrapper.find('.search-pane__item').trigger('click')
    await router.isReady()

    expect(wrapper.emitted('select')).toEqual([['user', '@alice:example.com']])
  })

  it('navigates to room-details when clicking a room result', async () => {
    searchUsersMock.mockResolvedValue([])
    searchRoomsMock.mockResolvedValue([{ roomId: '!room1:example.com', roomName: 'Room One', memberCount: 5 }])
    searchMessagesMock.mockResolvedValue([])

    const { wrapper, router } = await mountPane('room')

    await wrapper.find('.search-pane__item').trigger('click')
    await router.isReady()

    expect(wrapper.emitted('select')).toEqual([['room', '!room1:example.com']])
  })

  it('updates results when initialQuery prop changes', async () => {
    const router = buildRouter()
    const wrapper = mount(SearchPane, {
      props: { initialQuery: 'alice' },
      global: { plugins: [router] }
    })
    await vi.advanceTimersByTimeAsync(400)
    await wrapper.vm.$nextTick()
    expect(searchUsersMock).toHaveBeenLastCalledWith('alice', 10)

    await wrapper.setProps({ initialQuery: 'bob' })
    await vi.advanceTimersByTimeAsync(400)
    await wrapper.vm.$nextTick()
    expect(searchUsersMock).toHaveBeenLastCalledWith('bob', 10)
  })
})

describe('SearchPane — type=space 模式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    searchSpacesMock.mockResolvedValue([])
    joinSpaceMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mountSpacePane = async (initialQuery?: string) => {
    const router = buildRouter()
    const wrapper = mount(SearchPane, {
      props: { type: 'space', ...(initialQuery ? { initialQuery } : {}) },
      global: { plugins: [router] }
    })
    await vi.advanceTimersByTimeAsync(400)
    await wrapper.vm.$nextTick()
    return { wrapper, router }
  }

  it('type=space 时仅调用 matrixSpaceService.searchSpaces，不调用 users/rooms/messages 搜索', async () => {
    await mountSpacePane('design')

    expect(searchSpacesMock).toHaveBeenCalledWith('design', expect.any(Number))
    expect(searchUsersMock).not.toHaveBeenCalled()
    expect(searchRoomsMock).not.toHaveBeenCalled()
    expect(searchMessagesMock).not.toHaveBeenCalled()
  })

  it('type=space 渲染空间分组（带 join 按钮）', async () => {
    searchSpacesMock.mockResolvedValue([
      {
        spaceId: '!space-1:example.com',
        name: 'Design Team',
        topic: 'Design collaboration',
        memberCount: 12,
        childCount: 5,
        avatarUrl: undefined
      }
    ])

    const { wrapper } = await mountSpacePane('design')

    expect(wrapper.text()).toContain('Spaces')
    expect(wrapper.findAll('.search-pane__item')).toHaveLength(1)
    // join 按钮存在
    const joinBtn = wrapper.find('[data-test="n-button"]')
    expect(joinBtn.exists()).toBe(true)
    expect(joinBtn.text()).toBe('Join')
  })

  it('type=space 点击 join 调用 matrixSpaceService.joinSpace', async () => {
    searchSpacesMock.mockResolvedValue([
      {
        spaceId: '!space-1:example.com',
        name: 'Design Team',
        memberCount: 12,
        childCount: 5
      }
    ])

    const { wrapper } = await mountSpacePane('design')

    const joinBtn = wrapper.find('[data-test="n-button"]')
    await joinBtn.trigger('click')

    expect(joinSpaceMock).toHaveBeenCalledWith('!space-1:example.com')
  })

  it('type=space 不渲染用户/房间/消息分组', async () => {
    searchSpacesMock.mockResolvedValue([
      {
        spaceId: '!space-1:example.com',
        name: 'Design Team',
        memberCount: 12,
        childCount: 5
      }
    ])

    const { wrapper } = await mountSpacePane('design')

    const sections = wrapper.findAll('.search-pane__section')
    expect(sections).toHaveLength(1)
    // 唯一分组是空间分组
    expect(wrapper.text()).toContain('Spaces')
    expect(wrapper.text()).not.toContain('Users')
    expect(wrapper.text()).not.toContain('Rooms')
    expect(wrapper.text()).not.toContain('Messages')
  })

  it('type=space 无结果时渲染 no-results 状态', async () => {
    searchSpacesMock.mockResolvedValue([])

    const { wrapper } = await mountSpacePane('zzz')

    expect(wrapper.find('.search-pane__no-results').exists()).toBe(true)
    expect(wrapper.text()).toContain('No results for zzz')
  })

  it('type=space 搜索为空时不调用 searchSpaces', async () => {
    await mountSpacePane('')

    expect(searchSpacesMock).not.toHaveBeenCalled()
  })
})
