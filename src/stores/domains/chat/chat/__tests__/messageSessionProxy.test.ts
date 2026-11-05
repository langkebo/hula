import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useChatStore } from '../message'
import type { SessionItem } from '../session'
import { useSessionStore } from '../session'

/**
 * 守卫：`useChatStore()` 对会话域的转发必须**保持响应式**。
 *
 * 历史缺陷（移动端消息页恒空）：`message.ts` 用对象字面量 getter 转发
 * `get sessionList() { return sessionStore.sessionList }`。setup store 返回对象里的 getter
 * 会在 store 初始化时被 Pinia 求值一次，拿到「当时的数组引用」；而
 * `sessionStore.getSessionList()` 是**整体替换**数组，快照从此指向旧数组 ⇒
 * 移动端列表 computed 没有响应式依赖、永远读旧值（表现为「暂无会话」），
 * 顺带让全局未读角标恒 0、提醒音判断失效、删除会话后不自动选下一个。
 *
 * 这里刻意用**真实的** session store + chat store（只桩掉叶子矩阵服务），
 * 因为把 session store 桩掉就等于把被测的转发关系移出测试。
 */

const { getSessionListMock } = vi.hoisted(() => ({
  getSessionListMock: vi.fn(async (): Promise<SessionItem[]> => [])
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ params: {}, name: 'home' }) }))
vi.mock('@/services/offline/OfflineQueueService', () => ({ offlineQueueService: { enqueue: vi.fn() } }))
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: () => null },
  matrixClientService: { getClient: () => null }
}))
vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: { convertEventToMessage: vi.fn(), getEventById: vi.fn() }
}))
vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: { getSessionList: getSessionListMock }
}))
vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: { getSpecialFriends: vi.fn(async () => []) }
}))
vi.mock('@/services/matrix/notifications/MatrixRoomNotificationService', () => ({
  matrixRoomNotificationService: { fetchUnreadCount: vi.fn() }
}))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    allUserInfo: [],
    getUserInfo: () => undefined,
    clearGroupDetails: vi.fn(),
    getGroupUserList: vi.fn()
  })
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:matrix.test' } })
}))
vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: '',
    unreadReady: false,
    updateCurrentSessionRoomId: vi.fn(),
    updateGlobalUnreadCount: vi.fn()
  })
}))

const makeSession = (roomId: string): SessionItem => ({
  roomId,
  name: roomId,
  type: 2,
  unreadCount: 0,
  activeTime: Date.now()
})

describe('chatStore 会话域转发（响应式守卫）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getSessionListMock.mockReset()
    getSessionListMock.mockResolvedValue([])
  })

  it('sessionStore 整体替换 sessionList 后，chatStore.sessionList 必须同步', async () => {
    const sessionStore = useSessionStore()
    const chatStore = useChatStore()

    // 初始为空（快照实现会在这里把 [] 记死）
    expect(chatStore.sessionList).toHaveLength(0)

    sessionStore.sessionList = [makeSession('!r1')]
    await nextTick()
    expect(chatStore.sessionList.map((s) => s.roomId)).toEqual(['!r1'])

    // 关键：整体替换（getSessionList 的真实写法），不是原地 push
    getSessionListMock.mockResolvedValue([makeSession('!r1'), makeSession('!r2')])
    await sessionStore.getSessionList()
    await nextTick()

    expect(sessionStore.sessionList).toHaveLength(2)
    expect(chatStore.sessionList.map((s) => s.roomId)).toEqual(['!r1', '!r2'])
  }, 60_000)

  it('chatStore.sessionList 每次读取都反映最新数组（不得是快照）', () => {
    const sessionStore = useSessionStore()
    const chatStore = useChatStore()

    sessionStore.sessionList = [makeSession('!a')]
    expect(chatStore.sessionList).toHaveLength(1)

    sessionStore.sessionList = [makeSession('!a'), makeSession('!b'), makeSession('!c')]
    expect(chatStore.sessionList).toHaveLength(3)
  })

  it('sessionOptions 转发保持响应式', () => {
    const sessionStore = useSessionStore()
    const chatStore = useChatStore()

    sessionStore.sessionOptions.isLoading = true
    expect(chatStore.sessionOptions.isLoading).toBe(true)
  })

  it('对 chatStore.syncLoading 赋值必须落到 sessionStore（setter 不能是空写）', () => {
    const sessionStore = useSessionStore()
    const chatStore = useChatStore()

    chatStore.syncLoading = true
    expect(sessionStore.syncLoading).toBe(true)
    expect(chatStore.syncLoading).toBe(true)

    sessionStore.syncLoading = false
    expect(chatStore.syncLoading).toBe(false)
  })
})
