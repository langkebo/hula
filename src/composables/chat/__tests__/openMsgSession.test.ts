import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock 变量必须放 vi.hoisted()，否则 vi.mock 工厂 hoist 后会引用未初始化变量。
const { chatStoreMock, globalStoreMock, getSessionDetailWithFriendsMock, routerPushMock, useMittEmitMock } = vi.hoisted(
  () => ({
    chatStoreMock: {
      getSession: vi.fn(() => undefined),
      getSessionList: vi.fn().mockResolvedValue(undefined),
      addSession: vi.fn(),
      updateSessionLastActiveTime: vi.fn(),
      markSessionRead: vi.fn()
    },
    globalStoreMock: {
      currentSessionRoomId: '',
      updateCurrentSessionRoomId: vi.fn()
    },
    getSessionDetailWithFriendsMock: vi.fn(),
    routerPushMock: vi.fn(),
    useMittEmitMock: vi.fn()
  })
)

vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => chatStoreMock }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalStoreMock }))
vi.mock('@/router', () => ({
  default: { currentRoute: { value: { path: '/friend', params: {} } }, push: routerPushMock }
}))
vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: { getSessionDetailWithFriends: getSessionDetailWithFriendsMock }
}))
vi.mock('@/composables/common/useMitt', () => ({ useMitt: { emit: useMittEmitMock, on: vi.fn() } }))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: () => false }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))
vi.mock('@/services/i18n', () => ({ useI18nGlobal: () => ({ t: (k: string) => k }) }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'home' }) }
}))

import { openMsgSessionByRoomId } from '../openMsgSession'

describe('openMsgSessionByRoomId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatStoreMock.getSession.mockReturnValue(undefined)
    chatStoreMock.getSessionList.mockResolvedValue(undefined)
    getSessionDetailWithFriendsMock.mockResolvedValue({ roomId: '!room:test', type: 2, name: 'Bob' })
  })

  it('session 列表未同步（降级）时兜底拉取会话详情并写入 store，不静默失败', async () => {
    await openMsgSessionByRoomId('!room:test')

    // 现存行为缺陷：focusSessionRoom 仅轮询 getSessionList，降级时该 room 不在列表，
    // sessionStore.getSession 为 undefined → currentSessionInfo 空 → 消息视图不切换。
    // 修复后应主动 getSessionDetailWithFriends 兜底并 addSession，使切换生效。
    expect(getSessionDetailWithFriendsMock).toHaveBeenCalledWith('!room:test')
    expect(chatStoreMock.addSession).toHaveBeenCalled()

    // 切换当前会话 + 路由跳转（好友窗口 → /message）
    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room:test')
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'message', params: { roomId: '!room:test' } })
  }, 4000)
})
