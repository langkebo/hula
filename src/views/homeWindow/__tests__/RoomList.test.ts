import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { RoomTypeEnum } from '@/enums'
import RoomListView from '../RoomList.vue'

const {
  routerReplaceMock,
  addListenerMock,
  handleMsgClickMock,
  handleMsgDeleteMock,
  handleMsgDblclickMock,
  visibleMenuMock,
  visibleSpecialMenuMock,
  useMittOnMock,
  useMittEmitMock,
  scrollToIndexMock
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  addListenerMock: vi.fn(async () => {}),
  handleMsgClickMock: vi.fn(),
  handleMsgDeleteMock: vi.fn(),
  handleMsgDblclickMock: vi.fn(),
  visibleMenuMock: vi.fn(() => []),
  visibleSpecialMenuMock: vi.fn(() => []),
  useMittOnMock: vi.fn(),
  useMittEmitMock: vi.fn(),
  scrollToIndexMock: vi.fn()
}))

const route = reactive({
  path: '/roomList',
  name: 'roomList',
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

vi.mock('@vueuse/core', () => ({
  useDebounceFn: <Args extends unknown[], ReturnValue>(fn: (...args: Args) => ReturnValue) => fn
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    replace: routerReplaceMock
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

vi.mock('@/hooks/useTauriListener', () => ({
  useTauriListener: () => ({
    addListener: addListenerMock
  })
}))

vi.mock('@/hooks/session/openMsgSession', () => ({
  openMsgSession: vi.fn()
}))

vi.mock('@/hooks/useMessage.ts', () => ({
  useMessage: () => ({
    handleMsgClick: handleMsgClickMock,
    handleMsgDelete: handleMsgDeleteMock,
    handleMsgDblclick: handleMsgDblclickMock,
    visibleMenu: visibleMenuMock,
    visibleSpecialMenu: visibleSpecialMenuMock
  })
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    on: useMittOnMock,
    emit: useMittEmitMock
  }
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

vi.mock('@/components/workbench/MessageSessionToolbar.vue', () => ({
  default: defineComponent({
    name: 'MessageSessionToolbarStub',
    props: {
      searchKeyword: { type: String, default: '' },
      filteredCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['update:searchKeyword', 'update:sessionTypeFilter', 'update:sessionSort'],
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
          )
        ])
    }
  })
}))

vi.mock('@/components/workbench/RoomSessionList.vue', () => ({
  default: defineComponent({
    name: 'RoomSessionListStub',
    props: {
      sessionList: { type: Array, default: () => [] },
      emptyDescription: { type: String, default: '' }
    },
    setup(props, { expose }) {
      expose({
        scrollToIndex: scrollToIndexMock
      })

      return () =>
        h('div', { 'data-test': 'session-list' }, [
          h('span', { 'data-test': 'session-list-count' }, String(props.sessionList.length)),
          h('span', { 'data-test': 'session-list-empty' }, props.emptyDescription)
        ])
    }
  })
}))

vi.mock('@/components/workbench/WorkbenchDetailPane.vue', () => ({
  default: defineComponent({
    name: 'WorkbenchDetailPaneStub',
    props: {
      selectedSession: { type: Object, default: null },
      visibleSessionCount: { type: Number, default: 0 },
      totalSessionCount: { type: Number, default: 0 }
    },
    setup(props) {
      return () =>
        h('div', { 'data-test': 'detail-pane' }, [
          h('span', { 'data-test': 'detail-session-name' }, props.selectedSession?.name ?? ''),
          h('span', { 'data-test': 'detail-counts' }, `${props.visibleSessionCount}/${props.totalSessionCount}`)
        ])
    }
  })
}))

describe('RoomListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.query = {}
    route.path = '/roomList'
    route.name = 'roomList'
    globalStore.currentSessionRoomId = '!alpha:server'
  })

  it('renders the room workbench shell with toolbar, filtered group sessions and detail pane', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    expect(wrapper.find('[data-test="room-toolbar"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('2/2')
    expect(wrapper.get('[data-test="session-list-count"]').text()).toBe('2')
    expect(wrapper.get('[data-test="detail-session-name"]').text()).toBe('Alpha Room')
    expect(wrapper.get('[data-test="detail-counts"]').text()).toBe('2/2')
  })

  it('reads the initial search value from the route query and filters the room list', async () => {
    route.query = { search: 'beta' }

    const wrapper = mount(RoomListView)
    await flushPromises()

    expect(wrapper.get('[data-test="toolbar-search-value"]').text()).toBe('beta')
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('1/2')
    expect(wrapper.get('[data-test="session-list-count"]').text()).toBe('1')
  })

  it('syncs the search keyword back to the roomList route query', async () => {
    const wrapper = mount(RoomListView)
    await flushPromises()

    await wrapper.get('[data-test="toolbar-search"]').trigger('click')
    await flushPromises()

    expect(routerReplaceMock).toHaveBeenCalledWith({
      name: 'roomList',
      query: {
        search: 'beta',
        type: undefined,
        sort: undefined
      }
    })
  })
})
