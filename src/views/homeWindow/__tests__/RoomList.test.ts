import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { RoomTypeEnum } from '@/enums'
import RoomListView from '../RoomList.vue'

const {
  routerReplaceMock,
  routerPushMock,
  addListenerMock,
  handleMsgClickMock,
  handleMsgDblclickMock,
  useMittOnMock,
  useMittEmitMock
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  routerPushMock: vi.fn(),
  addListenerMock: vi.fn(async () => {}),
  handleMsgClickMock: vi.fn(),
  handleMsgDblclickMock: vi.fn(),
  useMittOnMock: vi.fn(),
  useMittEmitMock: vi.fn()
}))

const route = reactive({
  path: '/room',
  name: 'room',
  params: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>
})

const globalStore = reactive({
  currentSessionRoomId: '!alpha:server'
})

const sessionSource = ref([
  {
    roomId: '!alpha:server',
    name: 'Alpha Room',
    type: RoomTypeEnum.GROUP,
    avatar: '',
    activeTime: 20,
    unreadCount: 1,
    top: false,
    account: '',
    shield: false,
    lastMsg: 'alpha latest',
    lastMsgTime: '10:00'
  },
  {
    roomId: '!beta:server',
    name: 'Beta Room',
    type: RoomTypeEnum.GROUP,
    avatar: '',
    activeTime: 10,
    unreadCount: 0,
    top: false,
    account: '',
    shield: false,
    lastMsg: 'beta latest',
    lastMsgTime: '09:00'
  },
  {
    roomId: '@alice:server',
    name: 'Alice',
    type: RoomTypeEnum.SINGLE,
    avatar: '',
    activeTime: 5,
    unreadCount: 0,
    top: false,
    account: '',
    shield: false,
    lastMsg: 'dm latest',
    lastMsgTime: '08:00'
  }
])

const chatStore = reactive({
  sessionOptions: {
    isLoading: false
  }
})

const groupInfoMap = reactive<Record<string, unknown>>({})

vi.mock('@vueuse/core', () => ({
  useDebounceFn: <Args extends unknown[], ReturnValue>(fn: (...args: Args) => ReturnValue) => fn
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    replace: routerReplaceMock,
    push: routerPushMock
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({
      label: 'home',
      listen: vi.fn()
    })
  }
}))

vi.mock('@/composables/common/useTauriListener', () => ({
  useTauriListener: () => ({
    addListener: addListenerMock
  })
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSession: vi.fn()
}))

vi.mock('@/composables/chat/useMessage', () => ({
  useMessage: () => ({
    handleMsgClick: handleMsgClickMock,
    handleMsgDelete: vi.fn(),
    handleMsgDblclick: handleMsgDblclickMock
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: useMittOnMock,
    emit: useMittEmitMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/composables/workbench/useSessionPageSync', () => ({
  useSessionPageSync: vi.fn()
}))

vi.mock('@/composables/workbench/useSessionListState', () => ({
  useSessionListState: () => ({
    chatStore,
    globalStore,
    syncLoading: ref(false),
    networkBanner: null,
    retrySessions: vi.fn(),
    sessionList: computed(() => sessionSource.value),
    handleMenuShow: vi.fn(),
    getItemClasses: vi.fn(() => ({})),
    invalidateSessionCache: vi.fn()
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getUserId: () => '@me:server'
  }
}))

vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: {
    setSessionTop: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    groupInfoMap,
    loadGroupInfo: vi.fn(async (roomId: string) => {
      groupInfoMap[roomId] = {
        roomId,
        name: roomId,
        memberCount: 10,
        onlineCount: 3,
        topic: 'test topic',
        isEncrypted: false,
        isPublic: true,
        creator: '@other:server'
      }
      return groupInfoMap[roomId]
    })
  })
}))

vi.mock('@/components/workbench/MessageSessionToolbar.vue', () => ({
  default: defineComponent({
    name: 'MessageSessionToolbarStub',
    props: {
      searchKeyword: { type: String, default: '' },
      filteredCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['update:searchKeyword', 'update:sessionTypeFilter', 'update:sessionSort', 'searchSubmit'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'room-toolbar' }, [
          h('span', { 'data-test': 'toolbar-search-value' }, props.searchKeyword),
          h('span', { 'data-test': 'toolbar-summary' }, `${props.filteredCount}/${props.totalCount}`),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-search',
              onClick: () => emit('update:searchKeyword', 'beta')
            },
            'search'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-search-submit',
              onClick: () => emit('searchSubmit')
            },
            'submit'
          )
        ])
    }
  })
}))

vi.mock('@/components/room/RoomCardGrid.vue', () => ({
  default: defineComponent({
    name: 'RoomCardGridStub',
    props: {
      rooms: { type: Array, default: () => [] },
      loading: { type: Boolean, default: false },
      emptyDescription: { type: String, default: '' }
    },
    emits: ['preview', 'message', 'info', 'settings', 'pin'],
    setup(props) {
      return () =>
        h('div', { 'data-test': 'room-card-grid' }, [
          h('span', { 'data-test': 'room-card-grid-count' }, String(props.rooms.length)),
          h('span', { 'data-test': 'room-card-grid-empty' }, props.emptyDescription)
        ])
    }
  })
}))

vi.mock('@/components/room/RoomMembershipTabs.vue', () => ({
  default: defineComponent({
    name: 'RoomMembershipTabsStub',
    props: {
      modelValue: { type: String, default: 'all' },
      joinedCount: { type: Number, default: 0 },
      createdCount: { type: Number, default: 0 }
    },
    emits: ['update:modelValue'],
    setup() {
      return () => h('div', { 'data-test': 'membership-tabs' })
    }
  })
}))

describe('RoomListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.query = {}
    route.params = {}
    route.path = '/room'
    route.name = 'room'
    globalStore.currentSessionRoomId = '!alpha:server'
    Object.keys(groupInfoMap).forEach((key) => delete groupInfoMap[key])
  })

  it('renders the room workbench shell with toolbar and card grid', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    expect(wrapper.find('[data-test="room-toolbar"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('2/2')
    expect(wrapper.get('[data-test="room-card-grid-count"]').text()).toBe('2')
  })

  it('reads the initial search value from the route query and filters the room list', async () => {
    route.query = { search: 'beta' }

    const wrapper = mount(RoomListView)
    await flushPromises()

    expect(wrapper.get('[data-test="toolbar-search-value"]').text()).toBe('beta')
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('1/2')

    const grid = wrapper.getComponent({ name: 'RoomCardGridStub' })
    expect(grid.props('rooms')).toHaveLength(1)

    // P2: 单击卡片直接进入聊天界面（不再跳转房间详情）
    await grid.vm.$emit('preview', '!beta:server')
    expect(handleMsgClickMock).toHaveBeenCalled()
  })

  it('opens room details when info action is emitted from a card', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    const grid = wrapper.getComponent({ name: 'RoomCardGridStub' })
    await grid.vm.$emit('info', '!alpha:server')

    expect(routerPushMock).toHaveBeenCalledWith({
      name: 'room-details',
      params: { roomId: '!alpha:server' }
    })
  })

  it('enters chat when search submit is emitted with filtered results', async () => {
    route.query = { search: 'beta' }

    const wrapper = mount(RoomListView)
    await flushPromises()

    // 搜索过滤后仅剩 Beta Room
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('1/2')

    // 按 Enter 提交搜索 → 进入第一个匹配结果的聊天
    await wrapper.get('[data-test="toolbar-search-submit"]').trigger('click')

    expect(handleMsgClickMock).toHaveBeenCalled()
    const calledItem = handleMsgClickMock.mock.calls[0][0]
    expect(calledItem.roomId).toBe('!beta:server')
  })

  it('does nothing when search submit is emitted with no results', async () => {
    route.query = { search: 'nonexistent' }

    const wrapper = mount(RoomListView)
    await flushPromises()

    // 无匹配结果
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('0/2')

    handleMsgClickMock.mockClear()
    await wrapper.get('[data-test="toolbar-search-submit"]').trigger('click')

    expect(handleMsgClickMock).not.toHaveBeenCalled()
  })

  it('syncs the search keyword back to the roomList route query', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    await wrapper.get('[data-test="toolbar-search"]').trigger('click')
    await flushPromises()

    expect(routerReplaceMock).toHaveBeenCalledWith({
      name: 'room',
      query: {
        search: 'beta',
        type: undefined,
        sort: undefined
      }
    })
  })

  it('updates the card grid when a new room is created or joined', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    expect(wrapper.get('[data-test="room-card-grid-count"]').text()).toBe('2')

    sessionSource.value.push({
      roomId: '!new_room:server',
      name: 'New Room',
      type: RoomTypeEnum.GROUP,
      avatar: '',
      activeTime: Date.now(),
      unreadCount: 0,
      top: false,
      account: '',
      shield: false,
      lastMsg: 'welcome',
      lastMsgTime: '10:05'
    })

    await flushPromises()

    expect(wrapper.get('[data-test="room-card-grid-count"]').text()).toBe('3')
  })

  it('enters chat when message action is emitted from a card', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    const grid = wrapper.getComponent({ name: 'RoomCardGridStub' })
    await grid.vm.$emit('message', '!alpha:server')

    expect(handleMsgClickMock).toHaveBeenCalled()
  })
})
