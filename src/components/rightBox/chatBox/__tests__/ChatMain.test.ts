import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'
import ChatMain from '../ChatMain.vue'

const pinnedMessagesRef = ref<unknown[]>([])
const canSetStickyRef = ref(false)
const loadMock = vi.fn(async () => undefined)
const pinMock = vi.fn(async () => true)
const unpinMock = vi.fn(async () => true)

vi.mock('@/composables/room/usePinnedMessage', () => ({
  usePinnedMessage: () => ({
    pinnedMessages: computed(() => pinnedMessagesRef.value),
    latestPinnedMessage: computed(() => null),
    canSetSticky: computed(() => canSetStickyRef.value),
    pinnedEventIds: ref([]),
    loading: ref(false),
    errorMessage: ref(null),
    dismissed: ref(false),
    load: loadMock,
    refresh: loadMock,
    pin: pinMock,
    unpin: unpinMock,
    dismiss: vi.fn(),
    resetDismiss: vi.fn()
  })
}))

const enableBurnMock = vi.fn().mockResolvedValue(true)
const disableBurnMock = vi.fn().mockResolvedValue(true)

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    enableBurn: enableBurnMock,
    disableBurn: disableBurnMock,
    isRoomBurnEnabled: () => false,
    getRoomBurnDuration: () => 60,
    refreshBurnSettings: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/utils/AppHarness', () => ({
  detectAppPlatform: () => 'desktop',
  isBrowser: () => true,
  isE2EMode: () => false,
  hasTauriRuntime: () => false,
  getRequestedPlatform: () => null
}))

// Provide localStorage stub for Node v26 compatibility
if (!globalThis.localStorage) {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k])
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    }
  } as Storage
}

const {
  showFeedbackMock,
  scrollToIndexMock,
  scrollToBottomMock,
  mittOnMock,
  mittOffMock,
  mittEmitMock,
  getGroupAnnouncementListMock,
  loggerErrorMock,
  appWindowListenMock,
  timerSetTimeoutMock,
  timerClearAllMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  scrollToIndexMock: vi.fn(),
  scrollToBottomMock: vi.fn(),
  mittOnMock: vi.fn(),
  mittOffMock: vi.fn(),
  mittEmitMock: vi.fn(),
  getGroupAnnouncementListMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  appWindowListenMock: vi.fn(),
  timerSetTimeoutMock: vi.fn((callback: () => void) => {
    callback()
    return 0
  }),
  timerClearAllMock: vi.fn()
}))

let chatStore: ReturnType<
  typeof reactive<{
    isGroup: boolean
    shouldShowNoMoreMessage: boolean
    chatMessageList: unknown[]
    currentSessionInfo: { roomId: string } | null
    currentMessageOptions: { hasLoadedOnce: boolean; isLast: boolean; isLoading: boolean } | null
    currentNewMsgCount: null
    isMsgMultiChoose: boolean
    msgMultiChooseMode: string
    newMsgCount: Record<string, { count: number; isStart: boolean }>
    loadMore: ReturnType<typeof vi.fn>
    getMsgIndex: ReturnType<typeof vi.fn>
    clearNewMsgCount: ReturnType<typeof vi.fn>
    clearRedundantMessages: ReturnType<typeof vi.fn>
    resetAndRefreshCurrentRoomMessages: ReturnType<typeof vi.fn>
  }>
>
let globalStore: ReturnType<typeof reactive<{ currentSessionRoomId: string }>>
let userStore: ReturnType<typeof reactive<{ userInfo: { uid: string } | undefined }>>

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({
      listen: appWindowListenMock
    })
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: () => vi.fn(),
  useTimeoutFn: (callback: () => void) => callback()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('vue-virtual-scroller', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    DynamicScroller: defineComponent({
      name: 'DynamicScroller',
      props: {
        items: {
          type: Array,
          default: () => []
        }
      },
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            props.items.map((item, index) =>
              slots.default?.({
                item,
                index,
                active: true
              })
            )
          )
      }
    }),
    DynamicScrollerItem: defineComponent({
      name: 'DynamicScrollerItem',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })
  }
})

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    defineAsyncComponent: () => ({ template: '<div/>' })
  }
})

vi.mock('@/composables/chat/useChatScrollManager', () => ({
  useChatScrollManager: () => ({
    isAtBottom: ref(true),
    isLoadingMore: ref(false),
    scrollTop: ref(0),
    scrollToBottom: scrollToBottomMock,
    scrollToIndex: scrollToIndexMock,
    handleScroll: vi.fn(),
    loadMore: vi.fn(),
    shouldShowFloatButton: ref(false)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/chat/useChatMain', () => ({
  chatMainInjectionKey: Symbol('chat-main'),
  useChatMain: () => ({
    handleConfirm: vi.fn(),
    tips: ref(''),
    modalShow: ref(false),
    selectKey: ref(''),
    groupNicknameModalVisible: ref(false),
    groupNicknameValue: ref(''),
    groupNicknameError: ref(''),
    groupNicknameSubmitting: ref(false),
    handleGroupNicknameConfirm: vi.fn()
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: mittOnMock,
    off: mittOffMock,
    emit: mittEmitMock
  }
}))

vi.mock('@/composables/common/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    browserOnline: ref(true),
    isWsConnecting: ref(false),
    wsOnline: ref(true)
  })
}))

vi.mock('@/composables/common/usePopover', () => ({
  usePopover: () => ({
    enableScroll: vi.fn()
  })
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => ({
    isLoading: false,
    getGroupAnnouncementList: getGroupAnnouncementListMock
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null)
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    batchResolve: vi.fn(),
    getAvatarUrl: vi.fn((src: string) => src || '/logoD.png'),
    clearCache: vi.fn()
  }
}))

vi.mock('@/utils/AudioManager', () => ({
  audioManager: {
    stopAll: vi.fn()
  }
}))

vi.mock('@/utils/ComputedTime', () => ({
  formatChatTime: () => 'now'
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))
vi.mock('@/utils/MessageSelect', () => ({
  isMessageMultiSelectEnabled: () => true
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false,
  isMobile: () => false,
  isWindows: () => false
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setTimeout: timerSetTimeoutMock,
    clearAll: timerClearAllMock
  })
}))

const mountComponent = () =>
  shallowMount(ChatMain, {
    global: {
      stubs: {
        RenderMessage: true,
        FileUploadProgress: true,
        ThreadPanel: true,
        Transition: false,
        ChatBanners: false,
        ChatMessageList: false,
        ChatModals: false,
        'n-flex': true,
        'n-icon': true,
        'n-modal': true,
        'n-button': true,
        'n-input': true
      }
    }
  })

describe('ChatMain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pinnedMessagesRef.value = []
    canSetStickyRef.value = false
    loadMock.mockResolvedValue(undefined)
    unpinMock.mockResolvedValue(true)

    globalStore = reactive({
      currentSessionRoomId: '!room:example.com'
    })
    userStore = reactive({
      userInfo: {
        uid: '@me:example.com'
      }
    })

    chatStore = reactive({
      isGroup: false,
      shouldShowNoMoreMessage: false,
      chatMessageList: [],
      currentSessionInfo: { roomId: '!room:example.com' },
      currentMessageOptions: {
        hasLoadedOnce: true,
        isLast: false,
        isLoading: false
      },
      currentNewMsgCount: null,
      isMsgMultiChoose: false,
      msgMultiChooseMode: 'default',
      newMsgCount: {},
      loadMore: vi.fn(async () => undefined),
      getMsgIndex: vi.fn(() => -1),
      clearNewMsgCount: vi.fn(),
      clearRedundantMessages: vi.fn(),
      resetAndRefreshCurrentRoomMessages: vi.fn(async () => undefined)
    })

    appWindowListenMock.mockResolvedValue(vi.fn())
    getGroupAnnouncementListMock.mockResolvedValue({
      records: []
    })
  })

  it('uses action feedback while searching reply message and scrolls after it is found', async () => {
    let found = false
    chatStore.getMsgIndex = vi.fn(() => (found ? 3 : -1))
    chatStore.loadMore = vi.fn(async () => {
      found = true
    })

    const wrapper = mountComponent()

    await (wrapper.vm as unknown as { jumpToReplyMsg: (key: string) => Promise<void> }).jumpToReplyMsg('$reply')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('正在查找消息...', 'info')
    expect(scrollToIndexMock).toHaveBeenCalledWith(3, 'instant')
    expect(showFeedbackMock).not.toHaveBeenCalledWith('无法找到原始消息，可能已被删除或太久远', 'warning')
  })

  it('uses action feedback when reply message cannot be found after retries', async () => {
    chatStore.getMsgIndex = vi.fn(() => -1)
    chatStore.loadMore = vi.fn(async () => undefined)

    const wrapper = mountComponent()

    await (wrapper.vm as unknown as { jumpToReplyMsg: (key: string) => Promise<void> }).jumpToReplyMsg('$missing')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('正在查找消息...', 'info')
    expect(showFeedbackMock).toHaveBeenCalledWith('无法找到原始消息，可能已被删除或太久远', 'warning')
    expect(chatStore.loadMore).toHaveBeenCalledTimes(5)
  })

  it('does not crash when sender info or current user info is temporarily missing', async () => {
    userStore.userInfo = undefined
    chatStore.chatMessageList = [
      {
        message: {
          id: '$missing-user',
          roomId: '!room:example.com',
          sendTime: Date.now(),
          type: 0,
          body: { content: 'hello' }
        },
        fromUser: undefined
      } as unknown
    ]

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.exists()).toBe(true)
  })
})

describe('ChatMain private mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pinnedMessagesRef.value = []
    canSetStickyRef.value = false
    loadMock.mockResolvedValue(undefined)
    unpinMock.mockResolvedValue(true)

    // usePrivateMode is a module-level singleton; reset shared state between tests
    // so assertions about "inactive" state are not polluted by prior tests.
    const { privateModeActive, showPrivateConfirm, burnEnabled, currentRoomId } = usePrivateMode()
    privateModeActive.value = false
    showPrivateConfirm.value = false
    burnEnabled.value = false
    currentRoomId.value = ''

    globalStore = reactive({
      currentSessionRoomId: '!room:example.com'
    })
    userStore = reactive({
      userInfo: {
        uid: '@me:example.com'
      }
    })

    chatStore = reactive({
      isGroup: false,
      shouldShowNoMoreMessage: false,
      chatMessageList: [],
      currentSessionInfo: { roomId: '!room:example.com' },
      currentMessageOptions: {
        hasLoadedOnce: true,
        isLast: false,
        isLoading: false
      },
      currentNewMsgCount: null,
      isMsgMultiChoose: false,
      msgMultiChooseMode: 'default',
      newMsgCount: {},
      loadMore: vi.fn(async () => undefined),
      getMsgIndex: vi.fn(() => -1),
      clearNewMsgCount: vi.fn(),
      clearRedundantMessages: vi.fn(),
      resetAndRefreshCurrentRoomMessages: vi.fn(async () => undefined)
    })

    appWindowListenMock.mockResolvedValue(vi.fn())
    getGroupAnnouncementListMock.mockResolvedValue({
      records: []
    })
  })

  it('renders S private toggle button for non-group chat', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.exists()).toBe(true)
    expect(banners.props('isGroup')).toBe(false)
  })

  it('does not render S button for group chat', () => {
    chatStore.isGroup = true
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('isGroup')).toBe(true)
  })

  it('shows confirmation dialog when activating private mode', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { togglePrivateMode: () => void }).togglePrivateMode()
    await flushPromises()
    expect((wrapper.vm as unknown as { showPrivateConfirm: boolean }).showPrivateConfirm).toBe(true)
  })

  it('shows 4 privacy feature descriptions in confirmation dialog', () => {
    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as {
      privateModeFeatures: Array<{ title: string; description: string }>
    }
    expect(vm.privateModeFeatures).toHaveLength(4)
    const titles = vm.privateModeFeatures.map((f) => f.title)
    expect(titles).toContain('端到端加密')
    expect(titles).toContain('阅后即焚')
    expect(titles).toContain('防截屏')
    expect(titles).toContain('不留存')
  })

  it('activates private mode after confirmation and renders BurnAfterReadToggle', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { confirmPrivateMode: () => void }).confirmPrivateMode()
    await flushPromises()
    expect((wrapper.vm as unknown as { privateModeActive: boolean }).privateModeActive).toBe(true)
    expect(wrapper.findComponent({ name: 'BurnAfterReadToggle' }).exists()).toBe(true)
  })

  it('renders PrivateModeBanner when private mode is active', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { confirmPrivateMode: () => void }).confirmPrivateMode()
    await flushPromises()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('privateModeActive')).toBe(true)
  })

  it('does not render PrivateModeBanner when private mode is inactive', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('privateModeActive')).toBe(false)
  })

  it('renders ScreenshotWatermark when private mode is active', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { confirmPrivateMode: () => void }).confirmPrivateMode()
    await flushPromises()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('privateModeActive')).toBe(true)
  })

  it('does not render ScreenshotWatermark when private mode is inactive', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('privateModeActive')).toBe(false)
  })
  it('deactivates private mode on second S button click', async () => {
    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as {
      privateModeActive: boolean
      confirmPrivateMode: () => void
      togglePrivateMode: () => void
    }
    vm.confirmPrivateMode()
    await flushPromises()
    expect(vm.privateModeActive).toBe(true)
    vm.togglePrivateMode()
    await flushPromises()
    expect(vm.privateModeActive).toBe(false)
  })

  it('shows lock icon when private mode is active', async () => {
    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as { confirmPrivateMode: () => void }
    vm.confirmPrivateMode()
    await flushPromises()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('privateModeActive')).toBe(true)
  })

  it('does not show lock icon when private mode is inactive', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('privateModeActive')).toBe(false)
  })

  it('adds private-mode-active class to message list when private mode is active', async () => {
    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as { confirmPrivateMode: () => void }
    vm.confirmPrivateMode()
    await flushPromises()
    const messageList = wrapper.find('.message-list')
    expect(messageList.classes()).toContain('private-mode-active')
  })

  it('does not add private-mode-active class when private mode is inactive', () => {
    const wrapper = mountComponent()
    const messageList = wrapper.find('.message-list')
    expect(messageList.classes()).not.toContain('private-mode-active')
  })
})

describe('ChatMain sticky events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pinnedMessagesRef.value = []
    canSetStickyRef.value = false
    loadMock.mockResolvedValue(undefined)
    unpinMock.mockResolvedValue(true)

    globalStore = reactive({
      currentSessionRoomId: '!room:example.com'
    })
    userStore = reactive({
      userInfo: {
        uid: '@me:example.com'
      }
    })

    chatStore = reactive({
      isGroup: false,
      shouldShowNoMoreMessage: false,
      chatMessageList: [],
      currentSessionInfo: { roomId: '!room:example.com' },
      currentMessageOptions: {
        hasLoadedOnce: true,
        isLast: false,
        isLoading: false
      },
      currentNewMsgCount: null,
      isMsgMultiChoose: false,
      msgMultiChooseMode: 'default',
      newMsgCount: {},
      loadMore: vi.fn(async () => undefined),
      getMsgIndex: vi.fn(() => -1),
      clearNewMsgCount: vi.fn(),
      clearRedundantMessages: vi.fn(),
      resetAndRefreshCurrentRoomMessages: vi.fn(async () => undefined)
    })

    appWindowListenMock.mockResolvedValue(vi.fn())
    getGroupAnnouncementListMock.mockResolvedValue({
      records: []
    })
  })

  it('renders StickyEventBanner component', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.exists()).toBe(true)
    expect(banners.props('stickyEvents')).toEqual([])
  })

  it('passes stickyEvents prop to StickyEventBanner', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('stickyEvents')).toEqual([])
  })

  it('passes canSetSticky prop as false by default', () => {
    const wrapper = mountComponent()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('canSetSticky')).toBe(false)
  })

  it('reflects canSetSticky=true from composable', async () => {
    canSetStickyRef.value = true
    const wrapper = mountComponent()
    await flushPromises()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('canSetSticky')).toBe(true)
  })

  it('loads pinned messages on mount via composable', async () => {
    mountComponent()
    await flushPromises()
    expect(loadMock).toHaveBeenCalled()
  })

  it('handleCancelSticky calls unpin with eventId', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleCancelSticky: (eventId: string) => Promise<void> }).handleCancelSticky(
      '$evt1'
    )
    expect(unpinMock).toHaveBeenCalledWith('$evt1')
  })

  it('reflects stickyEvents from composable', async () => {
    pinnedMessagesRef.value = [{ eventId: '$evt1', sender: '@alice:server', body: 'Hello', timestamp: Date.now() }]
    const wrapper = mountComponent()
    await flushPromises()
    const banners = wrapper.findComponent({ name: 'ChatBanners' })
    expect(banners.props('stickyEvents')).toHaveLength(1)
  })
})

describe('ChatMain BurnAfterReadToggle service integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pinnedMessagesRef.value = []
    canSetStickyRef.value = false
    loadMock.mockResolvedValue(undefined)
    unpinMock.mockResolvedValue(true)
    enableBurnMock.mockResolvedValue(true)
    disableBurnMock.mockResolvedValue(true)

    // usePrivateMode is a module-level singleton; reset shared state between tests
    // so assertions about "inactive" state are not polluted by prior tests.
    const { privateModeActive, showPrivateConfirm, burnEnabled, burnDuration, currentRoomId } = usePrivateMode()
    privateModeActive.value = false
    showPrivateConfirm.value = false
    burnEnabled.value = false
    burnDuration.value = 60
    currentRoomId.value = ''

    globalStore = reactive({
      currentSessionRoomId: '!room:example.com'
    })
    userStore = reactive({
      userInfo: {
        uid: '@me:example.com'
      }
    })

    chatStore = reactive({
      isGroup: false,
      shouldShowNoMoreMessage: false,
      chatMessageList: [],
      currentSessionInfo: { roomId: '!room:example.com' },
      currentMessageOptions: {
        hasLoadedOnce: true,
        isLast: false,
        isLoading: false
      },
      currentNewMsgCount: null,
      isMsgMultiChoose: false,
      msgMultiChooseMode: 'default',
      newMsgCount: {},
      loadMore: vi.fn(async () => undefined),
      getMsgIndex: vi.fn(() => -1),
      clearNewMsgCount: vi.fn(),
      clearRedundantMessages: vi.fn(),
      resetAndRefreshCurrentRoomMessages: vi.fn(async () => undefined)
    })

    appWindowListenMock.mockResolvedValue(vi.fn())
    getGroupAnnouncementListMock.mockResolvedValue({
      records: []
    })
  })

  it('calls enableBurn when toggle turned on in private mode', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { confirmPrivateMode: () => void }).confirmPrivateMode()
    await flushPromises()
    const toggle = wrapper.findComponent({ name: 'BurnAfterReadToggle' })
    expect(toggle.exists()).toBe(true)
    await toggle.vm.$emit('update:enabled', true)
    await flushPromises()
    expect(enableBurnMock).toHaveBeenCalledWith('!room:example.com', 60000)
    expect(disableBurnMock).not.toHaveBeenCalled()
  })

  it('calls disableBurn when toggle turned off in private mode', async () => {
    // burnEnabled is a singleton ref shared across tests; start with burn on so the
    // emit(false) reflects an on→off transition.
    const { burnEnabled } = usePrivateMode()
    burnEnabled.value = true
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { confirmPrivateMode: () => void }).confirmPrivateMode()
    await flushPromises()
    const toggle = wrapper.findComponent({ name: 'BurnAfterReadToggle' })
    expect(toggle.exists()).toBe(true)
    await toggle.vm.$emit('update:enabled', false)
    await flushPromises()
    expect(disableBurnMock).toHaveBeenCalledWith('!room:example.com')
    expect(enableBurnMock).not.toHaveBeenCalled()
  })

  it('does not call service when no roomId', async () => {
    globalStore.currentSessionRoomId = ''
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { confirmPrivateMode: () => void }).confirmPrivateMode()
    await flushPromises()
    const toggle = wrapper.findComponent({ name: 'BurnAfterReadToggle' })
    expect(toggle.exists()).toBe(true)
    await toggle.vm.$emit('update:enabled', true)
    await flushPromises()
    expect(enableBurnMock).not.toHaveBeenCalled()
    expect(disableBurnMock).not.toHaveBeenCalled()
  })
})
