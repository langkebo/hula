import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { RoomTypeEnum } from '@/enums'
import MessageView from '../index.vue'

const {
  routerReplaceMock,
  addListenerMock,
  handleMsgClickMock,
  handleMsgDeleteMock,
  handleMsgDblclickMock,
  getSessionListMock,
  markSessionReadMock,
  useMittOnMock,
  useMittEmitMock,
  scrollToIndexMock
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  addListenerMock: vi.fn(async () => {}),
  handleMsgClickMock: vi.fn(),
  handleMsgDeleteMock: vi.fn(),
  handleMsgDblclickMock: vi.fn(),
  getSessionListMock: vi.fn(async () => {}),
  markSessionReadMock: vi.fn(),
  useMittOnMock: vi.fn(),
  useMittEmitMock: vi.fn(),
  scrollToIndexMock: vi.fn()
}))

const route = reactive({
  path: '/message',
  name: 'message',
  query: {} as Record<string, unknown>
})

const chatStore = reactive({
  syncLoading: false,
  sessionOptions: {
    isLoading: false
  },
  currentSessionInfo: null as null | { roomId: string; type: RoomTypeEnum },
  sessionList: [
    {
      roomId: '!alice:server',
      name: 'Alice',
      type: RoomTypeEnum.SINGLE,
      avatar: '',
      activeTime: 10,
      unreadCount: 0,
      top: false,
      account: '',
      shield: false,
      muteNotification: 0
    }
  ],
  getSessionList: getSessionListMock,
  getSession: vi.fn(() => null),
  markSessionRead: markSessionReadMock,
  chatMessageListByRoomId: vi.fn(() => [])
})

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    replace: routerReplaceMock
  })
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()

  return {
    ...actual,
    storeToRefs: () => ({
      syncLoading: ref(false)
    })
  }
})

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

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
    handleMsgDelete: handleMsgDeleteMock,
    handleMsgDblclick: handleMsgDblclickMock
  })
}))

// 方案B：index.vue 新增已隐藏会话入口，依赖设置密码校验与操作反馈
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    isSecretChatConfigured: vi.fn(() => true)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/composables/chat/useReplaceMsg', () => ({
  useReplaceMsg: () => ({
    checkRoomAtMe: vi.fn(() => false),
    getMessageSenderName: vi.fn(() => 'Alice'),
    formatMessageContent: vi.fn(() => 'hello')
  })
}))

vi.mock('@/composables/common/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    browserOnline: ref(true),
    isWsConnecting: ref(false),
    wsOnline: ref(true)
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: useMittOnMock,
    emit: useMittEmitMock
  }
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setTimeout: (fn: () => void, delay: number) => window.setTimeout(fn, delay)
  })
}))

vi.mock('@/stores/domains/chat/chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/domains/chat/chat')>()

  return {
    ...actual,
    useChatStore: () => chatStore,
    useSessionStore: () => ({
      syncLoading: false,
      sessionOptions: {
        isLoading: false
      },
      sessionList: [
        {
          roomId: '!alice:server',
          name: 'Alice',
          type: RoomTypeEnum.SINGLE,
          avatar: '',
          activeTime: 10,
          unreadCount: 0,
          top: false,
          account: '',
          shield: false,
          muteNotification: 0
        }
      ],
      getSessionList: getSessionListMock
    })
  }
})

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: '',
    unreadReady: true
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null),
    countInfo: null
  })
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    roomActions: {},
    roomId: '',
    room: null,
    roomList: [],
    currentJoinRule: null,
    roomSummaryCache: new Map(),
    loadRoomInfo: vi.fn(),
    loadRoomAliases: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn()
  })
}))

vi.mock('@/stores/domains/user/bot', () => ({
  useBotStore: () => ({
    displayText: ''
  })
}))

vi.mock('@/components/workbench/MessageSessionToolbar.vue', () => ({
  default: defineComponent({
    name: 'MessageSessionToolbarStub',
    props: {
      title: { type: String, default: '' },
      searchKeyword: { type: String, default: '' },
      filteredCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['update:searchKeyword', 'update:sessionTypeFilter', 'update:sessionSort'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'message-toolbar' }, [
          h('span', { 'data-test': 'toolbar-title' }, props.title),
          h('span', { 'data-test': 'toolbar-search-value' }, props.searchKeyword),
          h('span', { 'data-test': 'toolbar-summary' }, `${props.filteredCount}/${props.totalCount}`),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-search',
              onClick: () => emit('update:searchKeyword', 'alice')
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

describe('MessageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.query = {}
    route.path = '/message'
    route.name = 'message'
    chatStore.sessionOptions.isLoading = false
    chatStore.syncLoading = false
    chatStore.currentSessionInfo = null
  })

  it('renders the standalone message list layout and syncs search to the route query', async () => {
    vi.useFakeTimers()

    const wrapper = mount(MessageView)
    await flushPromises()

    expect(wrapper.find('[data-test="message-toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="session-list"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="toolbar-title"]').text()).toBe('home.action.message_short_title')
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('1/1')

    await wrapper.get('[data-test="toolbar-search"]').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(routerReplaceMock).toHaveBeenCalled()
    expect(routerReplaceMock.mock.calls.at(-1)?.[0]).toMatchObject({
      name: 'message',
      query: {
        search: 'alice'
      }
    })

    vi.useRealTimers()
  })

  it('renders RoomSessionList as a real child component (guards import-type regression)', async () => {
    const wrapper = mount(MessageView)
    await flushPromises()

    // 会话列表必须以真实子组件形式渲染，而非因 `import type` 降级为未知 HTML 元素
    expect(wrapper.findComponent({ name: 'RoomSessionListStub' }).exists()).toBe(true)
  })

  it('reads the initial search value from the route query', async () => {
    route.query = { search: 'alice' }

    const wrapper = mount(MessageView)
    await flushPromises()
    await nextTick()

    expect(wrapper.get('[data-test="toolbar-search-value"]').text()).toBe('alice')
  })
})
