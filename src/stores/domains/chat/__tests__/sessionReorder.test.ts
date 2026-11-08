import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import { type SessionItem, useSessionStore } from '../chat/session'

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

vi.mock('../contacts', () => ({
  useContactStore: () => ({ contactsList: [] })
}))

const makeSession = (roomId: string, overrides: Partial<SessionItem> = {}): SessionItem => ({
  roomId,
  name: roomId,
  type: RoomTypeEnum.SINGLE,
  unreadCount: 0,
  activeTime: 1000,
  ...overrides
})

const roomIds = (list: SessionItem[]) => list.map((session) => session.roomId)

describe('SessionStore.updateSessionLastActiveTime 增量归位', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('会话移到同 top 分组首位，其余会话相对顺序不变', () => {
    const store = useSessionStore()
    store.sessionList = [
      makeSession('!a', { activeTime: 3000 }),
      makeSession('!b', { activeTime: 2000 }),
      makeSession('!c', { activeTime: 1000 })
    ]
    const listBefore = store.sessionList

    store.updateSessionLastActiveTime('!b')

    expect(roomIds(store.sessionList)).toEqual(['!b', '!a', '!c'])
    // 原地 splice + triggerRef，不再替换整个数组（避免整表重算）
    expect(store.sessionList).toBe(listBefore)
  })

  it('置顶会话保持在置顶区，不会被普通会话的新活跃时间挤到后面', () => {
    const store = useSessionStore()
    store.sessionList = [
      makeSession('!pin', { top: true, activeTime: 100 }),
      makeSession('!a', { activeTime: 3000 }),
      makeSession('!b', { activeTime: 2000 })
    ]

    store.updateSessionLastActiveTime('!b')

    expect(roomIds(store.sessionList)).toEqual(['!pin', '!b', '!a'])
  })

  it('多个置顶会话时按活跃时间插到置顶组首位', () => {
    const store = useSessionStore()
    store.sessionList = [
      makeSession('!pin1', { top: true, activeTime: 5000 }),
      makeSession('!pin2', { top: true, activeTime: 4000 }),
      makeSession('!a', { activeTime: 3000 })
    ]

    store.updateSessionLastActiveTime('!pin2')

    expect(roomIds(store.sessionList)).toEqual(['!pin2', '!pin1', '!a'])
  })

  it('会话不在列表中时只更新时间戳，不打乱列表', () => {
    const store = useSessionStore()
    const orphan = makeSession('!orphan', { activeTime: 1 })
    store.sessionList = [makeSession('!a', { activeTime: 3000 }), makeSession('!b', { activeTime: 2000 })]
    const listBefore = store.sessionList

    store.updateSessionLastActiveTime('!orphan', orphan)

    expect(orphan.activeTime).toBeGreaterThan(1)
    expect(store.sessionList).toBe(listBefore)
    expect(roomIds(store.sessionList)).toEqual(['!a', '!b'])
  })
})
