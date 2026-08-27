import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import { useSessionStore } from '../chat/session'

vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: { getSessionList: vi.fn(async () => []) }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: { getSpecialFriends: vi.fn(async () => []) }
}))

vi.mock('@/services/matrix/messaging/MatrixReceiptService', () => ({
  matrixReceiptService: { markRoomAsRead: vi.fn(async () => undefined) }
}))

vi.mock('@/services/matrix/notifications/MatrixRoomNotificationService', () => ({
  matrixRoomNotificationService: {}
}))

vi.mock('../sessionUnread', () => ({
  useSessionUnreadStore: () => ({
    apply: vi.fn(() => ({})),
    set: vi.fn()
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:matrix.test' } })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    unreadReady: false,
    currentSessionRoomId: ''
  })
}))

const contactsListMock: Array<{ userId: string; directRoomId?: string }> = []

vi.mock('../contacts', () => ({
  useContactStore: () => ({ contactsList: contactsListMock })
}))

const makeSession = (overrides: Partial<Parameters<typeof Object>[0]> = {}) => ({
  roomId: '!dm:matrix.test',
  name: 'test1',
  type: RoomTypeEnum.SINGLE,
  unreadCount: 0,
  activeTime: 100,
  ...overrides
})

describe('SessionStore DM 身份回填（去重数据层收口）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactsListMock.length = 0
    setActivePinia(createPinia())
  })

  it('addSession 写入缺身份的 SINGLE 会话时，用好友 directRoomId 反查回填 detailId/account', () => {
    contactsListMock.push({ userId: '@test1:matrix.test', directRoomId: '!dm:matrix.test' })
    const store = useSessionStore()

    // 模拟 m.direct 未注册 + 成员未就绪：写入的会话缺 detailId/account
    store.addSession(makeSession({ roomId: '!dm:matrix.test' }) as never)

    const session = store.getSession('!dm:matrix.test')
    expect(session?.detailId).toBe('@test1:matrix.test')
    expect(session?.account).toBe('test1')
  })

  it('非 SINGLE 或已有身份的会话不做回填', () => {
    contactsListMock.push({ userId: '@test1:matrix.test', directRoomId: '!group:matrix.test' })
    const store = useSessionStore()

    store.addSession(makeSession({ roomId: '!group:matrix.test', type: RoomTypeEnum.GROUP }) as never)
    expect(store.getSession('!group:matrix.test')?.detailId).toBeUndefined()
  })

  it('同 roomId 重复写入时，新值的 undefined 不覆盖已解析身份（非空保留）', () => {
    contactsListMock.push({ userId: '@test1:matrix.test', directRoomId: '!dm:matrix.test' })
    const store = useSessionStore()

    store.addSession(makeSession({ roomId: '!dm:matrix.test' }) as never)
    // 服务重建竞态：第二次写入身份为空
    store.addSession(makeSession({ roomId: '!dm:matrix.test', detailId: undefined, account: undefined }) as never)

    const session = store.getSession('!dm:matrix.test')
    expect(session?.detailId).toBe('@test1:matrix.test')
    expect(session?.account).toBe('test1')
  })

  it('无好友映射时不阻断新增（静默降级，UI 层成员兜底仍可用）', () => {
    const store = useSessionStore()
    store.addSession(makeSession({ roomId: '!stranger:matrix.test' }) as never)

    expect(store.getSession('!stranger:matrix.test')).toBeTruthy()
    expect(store.getSession('!stranger:matrix.test')?.detailId).toBeUndefined()
  })
})
