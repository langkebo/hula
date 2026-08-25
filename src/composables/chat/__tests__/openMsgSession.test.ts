import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock 变量必须放 vi.hoisted()，否则 vi.mock 工厂 hoist 后会引用未初始化变量。
const {
  chatStoreMock,
  globalStoreMock,
  getSessionDetailWithFriendsMock,
  getRoomMock,
  buildSessionFromRoomPublicMock,
  routerPushMock,
  useMittEmitMock
} = vi.hoisted(() => ({
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
  getRoomMock: vi.fn(() => null),
  buildSessionFromRoomPublicMock: vi.fn(() => ({ roomId: '!room:test', type: 2, name: 'Bob' })),
  routerPushMock: vi.fn(),
  useMittEmitMock: vi.fn()
}))

vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => chatStoreMock }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalStoreMock }))
vi.mock('@/router', () => ({
  default: { currentRoute: { value: { path: '/friend', params: {} } }, push: routerPushMock }
}))
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getRoom: getRoomMock }
}))
vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: {
    getSessionDetailWithFriends: getSessionDetailWithFriendsMock,
    buildSessionFromRoomPublic: buildSessionFromRoomPublicMock
  }
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
    getRoomMock.mockReturnValue(null)
    getSessionDetailWithFriendsMock.mockResolvedValue({ roomId: '!room:test', type: 2, name: 'Bob' })
  })

  it('session 列表未同步（降级）时：房间已同步则直接构建会话，不走 DM 查找', async () => {
    const fakeRoom = { roomId: '!room:test', getJoinedMembers: () => [] } as any
    getRoomMock.mockReturnValue(fakeRoom)
    buildSessionFromRoomPublicMock.mockReturnValue({ roomId: '!room:test', type: 2, name: 'Bob' })

    await openMsgSessionByRoomId('!room:test')

    // 修复后：roomId 兜底路径先用 getRoom 拿实例，成功则走 buildSessionFromRoomPublic
    expect(getRoomMock).toHaveBeenCalledWith('!room:test')
    expect(buildSessionFromRoomPublicMock).toHaveBeenCalledWith(fakeRoom, null)
    expect(chatStoreMock.addSession).toHaveBeenCalled()

    // 不再走 DM 管理器（避免 Invalid user ID format 错误）
    expect(getSessionDetailWithFriendsMock).not.toHaveBeenCalled()

    // 切换当前会话 + 路由跳转
    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room:test')
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'message', params: { roomId: '!room:test' } })
  }, 4000)

  it('session 列表未同步（降级）时：房间未同步则 fallback 到 GROUP 查询', async () => {
    getRoomMock.mockReturnValue(null)
    getSessionDetailWithFriendsMock.mockResolvedValue({ roomId: '!room:test', type: 2, name: 'Bob' })

    await openMsgSessionByRoomId('!room:test')

    // getRoom 失败 → fallback
    expect(getRoomMock).toHaveBeenCalledWith('!room:test')
    expect(getSessionDetailWithFriendsMock).toHaveBeenCalledWith({
      id: '!room:test',
      roomType: expect.any(Number)
    })
    expect(chatStoreMock.addSession).toHaveBeenCalled()
  }, 4000)
})
