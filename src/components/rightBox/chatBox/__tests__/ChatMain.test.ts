import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import ChatMain from '../ChatMain.vue'

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

vi.mock('@/hooks/useChatMain.ts', () => ({
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

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: {
    on: mittOnMock,
    off: mittOffMock,
    emit: mittEmitMock
  }
}))

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    browserOnline: ref(true),
    isWsConnecting: ref(false),
    wsOnline: ref(true)
  })
}))

vi.mock('@/hooks/usePopover.ts', () => ({
  usePopover: () => ({
    enableScroll: vi.fn()
  })
}))

vi.mock('@/hooks/useWindow.ts', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => ({
    getGroupAnnouncementList: getGroupAnnouncementListMock
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/AudioManager', () => ({
  audioManager: {
    stopAll: vi.fn()
  }
}))

vi.mock('@/utils/ComputedTime', () => ({
  timeToStr: () => 'now'
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
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
