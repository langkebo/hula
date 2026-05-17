import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CallTypeEnum, RoomTypeEnum } from '@/enums'
import { useWindow } from '../useWindow'

const {
  showFeedbackMock,
  getByLabelMock,
  primaryMonitorMock,
  isDesktopMock,
  invokeSilentlyMock,
  invokeWithErrorHandlerMock,
  loggerErrorMock,
  onceImmediateEventState,
  onceImmediatePayloadState,
  createdWindows
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  getByLabelMock: vi.fn(),
  primaryMonitorMock: vi.fn(),
  isDesktopMock: vi.fn(() => true),
  invokeSilentlyMock: vi.fn(),
  invokeWithErrorHandlerMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  onceImmediateEventState: { value: null as null | string },
  onceImmediatePayloadState: { value: undefined as unknown },
  createdWindows: [] as Array<{ label: string; options: Record<string, unknown> }>
}))

const globalStoreState = {
  currentSession: null as null | { type: RoomTypeEnum; detailId?: string },
  currentSessionRoomId: '!room:example.com'
}

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalSize: class {
    constructor(
      public width: number,
      public height: number
    ) {}
  }
}))

vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn(function MockWebviewWindow(
    this: Record<string, unknown>,
    label: string,
    options: Record<string, unknown>
  ) {
    createdWindows.push({ label, options })
    this.label = label
    this.once = vi.fn((event: string, callback?: (payload?: unknown) => unknown) => {
      if (event === onceImmediateEventState.value) {
        callback?.(onceImmediatePayloadState.value)
      }
      return Promise.resolve()
    })
    this.requestUserAttention = vi.fn()
    this.setFocus = vi.fn()
    this.setSize = vi.fn()
    this.setResizable = vi.fn()
    this.isMinimized = vi.fn().mockResolvedValue(false)
    this.isVisible = vi.fn().mockResolvedValue(true)
    this.show = vi.fn()
    this.unminimize = vi.fn()
    this.close = vi.fn()
  })

  Object.assign(WebviewWindow, {
    getByLabel: getByLabelMock
  })

  return { WebviewWindow }
})

vi.mock('@tauri-apps/api/window', () => ({
  UserAttentionType: { Critical: 'critical' },
  primaryMonitor: primaryMonitorMock
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreState
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isCompatibility: vi.fn(() => false),
  isDesktop: isDesktopMock,
  isMac: vi.fn(() => false),
  isWindows: vi.fn(() => false),
  isWindows10: vi.fn(() => false)
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: invokeSilentlyMock,
  invokeWithErrorHandler: invokeWithErrorHandlerMock
}))

describe('useWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createdWindows.length = 0
    onceImmediateEventState.value = null
    onceImmediatePayloadState.value = undefined
    isDesktopMock.mockReturnValue(true)
    globalStoreState.currentSession = null
    globalStoreState.currentSessionRoomId = '!room:example.com'
    primaryMonitorMock.mockResolvedValue({
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
      name: 'test',
      position: { x: 0, y: 0 }
    } as any)
    getByLabelMock.mockResolvedValue(null)
  })

  it('在非桌面平台返回 null', async () => {
    isDesktopMock.mockReturnValue(false)

    const { createWebviewWindow } = useWindow()
    const result = await createWebviewWindow('Test', 'test', 800, 600)

    expect(result).toBeNull()
  })

  it('桌面环境可创建 webview 窗口', async () => {
    const { createWebviewWindow } = useWindow()
    const result = await createWebviewWindow('Test Window', 'test', 800, 600)

    expect(result).toBeTruthy()
    expect(createdWindows[0]?.label).toBe('test')
  })

  it('startRtcCall 在会话未就绪、群聊和缺少用户信息时播报反馈', async () => {
    const { startRtcCall } = useWindow()

    await startRtcCall(CallTypeEnum.VIDEO)
    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.window.session_not_ready', 'warning')

    showFeedbackMock.mockClear()
    globalStoreState.currentSession = { type: RoomTypeEnum.GROUP, detailId: '@group:example.com' }
    await startRtcCall(CallTypeEnum.VIDEO)
    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.window.group_call_not_supported', 'warning')

    showFeedbackMock.mockClear()
    globalStoreState.currentSession = { type: RoomTypeEnum.SINGLE }
    await startRtcCall(CallTypeEnum.VIDEO)
    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.window.user_info_missing', 'error')
  })

  it('模态窗口创建失败时播报 error 并恢复父窗口可用状态', async () => {
    const parentSetEnabledMock = vi.fn()
    getByLabelMock.mockImplementation(async (label: string) => {
      if (label === 'parent-window') {
        return {
          setEnabled: parentSetEnabledMock
        }
      }
      return null
    })
    onceImmediateEventState.value = 'tauri://error'
    onceImmediatePayloadState.value = new Error('boom')

    const { createModalWindow } = useWindow()
    await createModalWindow('测试', 'test-modal', 500, 400, 'parent-window')

    expect(showFeedbackMock).toHaveBeenCalledWith('创建测试窗口失败', 'error')
    expect(parentSetEnabledMock).toHaveBeenCalledWith(true)
  })

  it('暴露 useWindow 基本 API', () => {
    const hook = useWindow()
    expect(hook).toHaveProperty('createWebviewWindow')
    expect(hook).toHaveProperty('createModalWindow')
    expect(hook).toHaveProperty('startRtcCall')
  })
})
