import { beforeEach, describe, expect, it, vi } from 'vitest'

const { chatStoreMock, globalStoreMock, groupStoreMock, userStoreMock } = vi.hoisted(() => ({
  chatStoreMock: {
    currentMessageOptions: { hasLoadedOnce: false } as { hasLoadedOnce: boolean } | undefined,
    getSession: vi.fn(),
    markSessionRead: vi.fn(),
    changeRoom: vi.fn().mockResolvedValue(undefined),
    removeSession: vi.fn(),
    sessionList: [] as unknown[]
  },
  globalStoreMock: {
    currentSessionRoomId: '',
    updateCurrentSessionRoomId: vi.fn((roomId: string) => {
      globalStoreMock.currentSessionRoomId = roomId
    })
  },
  groupStoreMock: {
    getUserListByRoomId: vi.fn(() => []),
    getGroupUserList: vi.fn().mockResolvedValue(undefined)
  },
  userStoreMock: {
    userInfo: { uid: '@me:test' }
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => chatStoreMock }))
vi.mock('@/stores/domains/chat/group', () => ({ useGroupStore: () => groupStoreMock }))
vi.mock('@/stores/domains/user/user', () => ({ useUserStore: () => userStoreMock }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalStoreMock }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))
vi.mock('@/utils/TauriInvokeHandler', () => ({ invokeWithErrorHandler: vi.fn().mockResolvedValue(undefined) }))

import { RoomTypeEnum } from '@/enums'
import { useChatSession } from '../useChatSession'

const session = (roomId: string) => ({ roomId, type: RoomTypeEnum.SINGLE, unreadCount: 0 }) as never

describe('useChatSession.switchSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalStoreMock.currentSessionRoomId = '!room:test'
    chatStoreMock.currentMessageOptions = { hasLoadedOnce: false }
  })

  it('重复进入同一房间且首屏未加载时，主动补一次 changeRoom', async () => {
    const { switchSession } = useChatSession()

    await switchSession(session('!room:test'))

    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room:test')
    expect(chatStoreMock.changeRoom).toHaveBeenCalledTimes(1)
  })

  it('重复进入同一房间但已加载完成时不重复拉取', async () => {
    chatStoreMock.currentMessageOptions = { hasLoadedOnce: true }
    const { switchSession } = useChatSession()

    await switchSession(session('!room:test'))

    expect(chatStoreMock.changeRoom).not.toHaveBeenCalled()
  })

  it('切换到不同房间时不直接调用 changeRoom（由 currentSessionRoomId watcher 负责）', async () => {
    const { switchSession } = useChatSession()

    await switchSession(session('!other:test'))

    expect(chatStoreMock.changeRoom).not.toHaveBeenCalled()
  })
})
