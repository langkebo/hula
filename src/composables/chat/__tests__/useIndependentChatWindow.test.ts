import { enableAutoUnmount, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  buildWindowChatLabel,
  INDEPENDENT_CHAT_EVENTS,
  parseRoomIdFromLabel,
  useIndependentChatWindow
} from '../useIndependentChatWindow'

// === Mock Tauri APIs ===
// 注意：mock 实现必须使用 function 关键字（vitest 警告要求）
const { emitMock, listenMock, WebviewWindowMock, getByLabelMock } = vi.hoisted(() => ({
  emitMock: vi.fn().mockResolvedValue(undefined),
  listenMock: vi.fn().mockResolvedValue(vi.fn()),
  WebviewWindowMock: vi.fn(),
  getByLabelMock: vi.fn().mockResolvedValue(null)
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => emitMock(...(args as [string, unknown])),
  listen: (...args: unknown[]) => listenMock(...(args as [string, unknown]))
}))

vi.mock('@tauri-apps/api/webviewWindow', () => {
  // 使用 function 关键字定义 ctor，符合 vitest 对 mock 的要求
  function WebviewWindow(label: string, options: { url?: string }) {
    WebviewWindowMock(label, options)
    return {
      label,
      once: vi.fn((event: string, cb: () => void) => {
        // once 应返回 Promise，并在 resolved 时触发回调
        if (event === 'tauri://created') {
          return Promise.resolve(cb())
        }
        return Promise.resolve()
      }),
      isMinimized: vi.fn().mockResolvedValue(false),
      unminimize: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
      setFocus: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    }
  }
  // 静态方法
  ;(WebviewWindow as unknown as { getByLabel: (label: string) => Promise<unknown> }).getByLabel = (label: string) =>
    getByLabelMock(label)
  return { WebviewWindow }
})

// === Mock router ===
const pushMock = vi.fn()
const backMock = vi.fn()

vi.mock('@/router', () => ({
  default: {
    push: (...args: unknown[]) => pushMock(...(args as [string])),
    back: () => backMock()
  }
}))

// === Mock platform/runtime detection ===
vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

// === Mock store ===
const updateCurrentSessionRoomIdMock = vi.fn()

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: '!room1:example.com',
    updateCurrentSessionRoomId: updateCurrentSessionRoomIdMock
  })
}))

// === Mock action feedback ===
const showFeedbackMock = vi.fn()

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: (...args: unknown[]) => showFeedbackMock(...(args as [string, string]))
  })
}))

// === Mock Logger ===
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// 测试用 host 组件：将 composable 返回的 API 暴露给测试用例
let hostApi: ReturnType<typeof useIndependentChatWindow> | null = null

const TestHost = defineComponent({
  name: 'TestHost',
  setup() {
    const api = useIndependentChatWindow()
    hostApi = api
    onUnmounted(() => {
      // 触发 onUnmounted 钩子
    })
    return () => h('div', { class: 'test-host' })
  }
})

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }]
  })

// 在文件顶层调用一次，避免多次调用错误
enableAutoUnmount(afterEach)

describe('useIndependentChatWindow - constants & helpers', () => {
  it('exports correct event names per appendix C.3', () => {
    expect(INDEPENDENT_CHAT_EVENTS.OPENED).toBe('chat:opened-independently')
    expect(INDEPENDENT_CHAT_EVENTS.UNREAD_UPDATED).toBe('chat:unread-updated')
    expect(INDEPENDENT_CHAT_EVENTS.CLOSED).toBe('chat:closed')
  })

  it('buildWindowChatLabel composes label with prefix', () => {
    expect(buildWindowChatLabel('!room1:example.com')).toBe('windowChat--!room1:example.com')
  })

  it('parseRoomIdFromLabel extracts roomId from valid label', () => {
    expect(parseRoomIdFromLabel('windowChat--!room1:example.com')).toBe('!room1:example.com')
  })

  it('parseRoomIdFromLabel returns null for invalid label', () => {
    expect(parseRoomIdFromLabel('other-label')).toBeNull()
    expect(parseRoomIdFromLabel('')).toBeNull()
  })
})

describe('useIndependentChatWindow - openInNewWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks 会清除 mock 实现，需要重新设置返回值
    emitMock.mockResolvedValue(undefined)
    listenMock.mockResolvedValue(vi.fn())
    getByLabelMock.mockResolvedValue(null) // 默认无已存在窗口
    hostApi = null
  })

  const mountHost = () => {
    const router = buildRouter()
    return mount(TestHost, { global: { plugins: [router] } })
  }

  it('creates a new WebviewWindow with /window/chat/:roomId url', async () => {
    mountHost()
    const { openInNewWindow } = hostApi!

    await openInNewWindow('!room1:example.com')

    expect(WebviewWindowMock).toHaveBeenCalledTimes(1)
    const [label, options] = WebviewWindowMock.mock.calls[0]
    expect(label).toBe('windowChat--!room1:example.com')
    // encodeURIComponent 不编码 ! 字符
    expect(options.url).toBe(`/window/chat/${encodeURIComponent('!room1:example.com')}`)
    expect(options.url).toBe('/window/chat/!room1%3Aexample.com')
  })

  it('emits chat:opened-independently event after creation', async () => {
    mountHost()
    const { openInNewWindow } = hostApi!

    await openInNewWindow('!room1:example.com')

    // 等待 setTimeout(0) 触发 created 回调
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(emitMock).toHaveBeenCalledWith(INDEPENDENT_CHAT_EVENTS.OPENED, {
      roomId: '!room1:example.com',
      windowId: 'windowChat--!room1:example.com'
    })
  })

  it('main window backs off after opening (router.back called)', async () => {
    mountHost()
    const { openInNewWindow } = hostApi!

    await openInNewWindow('!room1:example.com')

    expect(backMock).toHaveBeenCalled()
  })

  it('clears currentSession when independent room matches current session', async () => {
    mountHost()
    const { openInNewWindow } = hostApi!

    await openInNewWindow('!room1:example.com') // globalStore.currentSessionRoomId 也是 !room1:example.com

    expect(updateCurrentSessionRoomIdMock).toHaveBeenCalledWith('')
  })

  it('focuses existing window if already open (no duplicate creation)', async () => {
    const existingWindow = {
      isMinimized: vi.fn().mockResolvedValue(false),
      unminimize: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
      setFocus: vi.fn().mockResolvedValue(undefined)
    }
    getByLabelMock.mockResolvedValue(existingWindow)

    mountHost()
    const { openInNewWindow } = hostApi!

    await openInNewWindow('!room1:example.com')

    expect(existingWindow.setFocus).toHaveBeenCalled()
    // 不应创建新窗口
    expect(WebviewWindowMock).not.toHaveBeenCalled()
    // 主窗口仍应退让
    expect(backMock).toHaveBeenCalled()
  })

  it('shows error feedback when roomId is empty', async () => {
    mountHost()
    const { openInNewWindow } = hostApi!

    const result = await openInNewWindow('')

    expect(result).toBeNull()
    expect(showFeedbackMock).toHaveBeenCalledWith('roomId is required', 'error')
  })
})

describe('useIndependentChatWindow - notifyUnreadUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emitMock.mockResolvedValue(undefined)
    hostApi = null
  })

  it('emits chat:unread-updated with roomId and count', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    const { notifyUnreadUpdate } = hostApi!

    await notifyUnreadUpdate('!room1:example.com', 5)

    expect(emitMock).toHaveBeenCalledWith(INDEPENDENT_CHAT_EVENTS.UNREAD_UPDATED, {
      roomId: '!room1:example.com',
      unreadCount: 5
    })
  })
})

describe('useIndependentChatWindow - listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)
    hostApi = null
  })

  it('listenUnreadUpdates subscribes to chat:unread-updated', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    const { listenUnreadUpdates } = hostApi!
    const cb = vi.fn()

    await listenUnreadUpdates(cb)

    expect(listenMock).toHaveBeenCalledWith(INDEPENDENT_CHAT_EVENTS.UNREAD_UPDATED, expect.any(Function))
  })

  it('listenChatClosed subscribes to chat:closed', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    const { listenChatClosed } = hostApi!
    const cb = vi.fn()

    await listenChatClosed(cb)

    expect(listenMock).toHaveBeenCalledWith(INDEPENDENT_CHAT_EVENTS.CLOSED, expect.any(Function))
  })

  it('listenChatOpened subscribes to chat:opened-independently', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    const { listenChatOpened } = hostApi!
    const cb = vi.fn()

    await listenChatOpened(cb)

    expect(listenMock).toHaveBeenCalledWith(INDEPENDENT_CHAT_EVENTS.OPENED, expect.any(Function))
  })
})
