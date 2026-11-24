import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '../message'

/**
 * 守卫：`chat` / `session` / `global` 三者存在初始化环。
 *
 * Pinia 在建店时先把半成品 store 写入 `_s`，setup 返回后才把动作 `assign` 上去。
 * 顺序变成 session → global → chat 时，chat 的 setup 里 `sessionStore.getSessionList`
 * 取到的是 undefined，并被永久写进 chat store ⇒ 会话列表恒空（移动端角标链也因此断）。
 *
 * 所以 chat 对会话动作的转发必须是「调用时解析」，不能在建店时取值。
 */

const { sessionStoreMock } = vi.hoisted(() => ({
  sessionStoreMock: {
    sessionList: [] as unknown[],
    sessionOptions: { isLoading: false },
    syncLoading: false
  } as Record<string, unknown>
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ params: {}, name: 'home' }) }))
vi.mock('../session', () => ({ useSessionStore: () => sessionStoreMock }))
vi.mock('@/services/offline/OfflineQueueService', () => ({ offlineQueueService: { enqueue: vi.fn() } }))
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: () => null },
  matrixClientService: { getClient: () => null }
}))
vi.mock('@/services/matrix/MatrixEventService', () => ({
  matrixEventService: { convertEventToMessage: vi.fn(), getEventById: vi.fn() }
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

const deferredActions = [
  'getSessionList',
  'updateSession',
  'updateSessionLastActiveTime',
  'getSession',
  'addSession'
] as const

describe('chatStore 与会话 store 的循环初始化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 复位成「会话 store 正在创建、动作尚未 assign」的半成品形态
    for (const key of deferredActions) {
      delete sessionStoreMock[key]
    }
  })

  it('会话动作不能在 chat 建店时被取成 undefined，而应在调用时解析', () => {
    const chatStore = useChatStore()

    // 会话 store 创建收尾：pinia 把动作补到同一个对象上
    const getSessionList = vi.fn(async () => [])
    sessionStoreMock.getSessionList = getSessionList

    expect(typeof chatStore.getSessionList).toBe('function')
    chatStore.getSessionList()
    expect(getSessionList).toHaveBeenCalledTimes(1)
  })

  it('会话动作在半成品阶段也不得抛错（调用时仍有值）', () => {
    const chatStore = useChatStore()
    const updateSession = vi.fn(() => true)
    sessionStoreMock.updateSession = updateSession

    expect(chatStore.updateSession('!r1', { unreadCount: 1 })).toBe(true)
    expect(updateSession).toHaveBeenCalledWith('!r1', { unreadCount: 1 })
  })
})
