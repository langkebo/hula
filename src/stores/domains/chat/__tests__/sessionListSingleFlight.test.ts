import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { RoomTypeEnum } from '@/enums'
import type { SessionItem } from '../chat'
import { useSessionStore } from '../chat/session'

/**
 * 会话列表拉取的 single-flight 语义。
 *
 * 历史缺陷：`if (sessionOptions.isLoading) return` 会把并发调用**静默短路**，
 * 后到的调用 `await` 完以为数据已就位，实际请求还在路上。移动端首屏因此出现
 * 「bootstrap 正在拉 → 页面 onMounted 的拉取被吞 → 列表空到用户手动下拉刷新」。
 */

const { getSessionListMock, getSpecialFriendsMock } = vi.hoisted(() => ({
  getSessionListMock: vi.fn(async (): Promise<SessionItem[]> => []),
  getSpecialFriendsMock: vi.fn(async () => [] as string[])
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: { enqueue: vi.fn() }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: () => ({ getRoom: () => null, getReadReceiptsManager: () => ({}) }) },
  matrixClientService: { getClient: () => ({ getRoom: () => null, getReadReceiptsManager: () => ({}) }) }
}))

vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: { getSessionList: getSessionListMock }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: { getSpecialFriends: getSpecialFriendsMock }
}))

vi.mock('@/services/matrix/notifications/MatrixRoomNotificationService', () => ({
  matrixRoomNotificationService: { fetchUnreadCount: vi.fn() }
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:matrix.test' } })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ unreadReady: false, currentSessionRoomId: '' })
}))

vi.mock('../contacts', () => ({
  useContactStore: () => ({ contactsList: [] })
}))

const makeSession = (roomId: string): SessionItem => ({
  roomId,
  name: roomId,
  type: RoomTypeEnum.SINGLE,
  unreadCount: 0,
  activeTime: 1
})

describe('SessionStore.getSessionList single-flight', () => {
  beforeEach(() => {
    const pinia = createPinia()
    pinia.use(createPersistedState())
    setActivePinia(pinia)
    // sessionUnread 走持久化插件，需要 app 上下文
    createApp({}).use(pinia)
    vi.clearAllMocks()
    getSpecialFriendsMock.mockResolvedValue([])
  })

  it('并发调用只发一次请求，且两个调用都在数据就位后返回', async () => {
    // 用对象持有 resolve：闭包赋值给 let 会让 TS 把后续调用收窄成 never
    const gate: { resolve?: (value: SessionItem[]) => void } = {}
    getSessionListMock.mockImplementation(
      () =>
        new Promise<SessionItem[]>((resolve) => {
          gate.resolve = resolve
        })
    )

    const store = useSessionStore()
    const first = store.getSessionList()
    const second = store.getSessionList()

    // 关键行为：并发调用**不能提前完成**。
    // 旧实现是 `if (isLoading) return` 的 async 函数 ⇒ 第二次调用立刻 resolve，
    // 调用方 await 完以为数据已就位，实际列表还是空的（移动端「暂无会话」的直接成因）。
    let secondResolved = false
    void second.then(() => {
      secondResolved = true
    })
    await flushPromises()
    expect(secondResolved, '并发调用提前完成 = 复用了早退分支而不是同一次请求').toBe(false)

    // fetchSessionList 内部先 await getSpecialFriends，等一拍再断言「只发一次」
    await flushPromises()
    expect(getSessionListMock).toHaveBeenCalledTimes(1)
    expect(store.sessionOptions.isLoading).toBe(true)

    gate.resolve?.([makeSession('!r1')])
    await Promise.all([first, second])

    // 两个调用返回时数据必须已写入 store —— 旧实现里第二个调用会立刻返回且列表仍为空
    expect(store.sessionList.map((s) => s.roomId)).toEqual(['!r1'])
    expect(store.sessionOptions.isLoading).toBe(false)
  })

  it('上一轮结束后再次调用会重新请求', async () => {
    getSessionListMock.mockResolvedValue([makeSession('!r1')])
    const store = useSessionStore()

    await store.getSessionList()
    await store.getSessionList()

    expect(getSessionListMock).toHaveBeenCalledTimes(2)
  })

  it('失败时写入 loadError 并把 isLoading 复位（不向调用方抛错）', async () => {
    getSessionListMock.mockRejectedValueOnce(new Error('boom'))
    const store = useSessionStore()

    await expect(store.getSessionList()).resolves.toBeUndefined()
    expect(store.loadError).toBe('boom')
    expect(store.sessionOptions.isLoading).toBe(false)

    // 失败后不应卡在 in-flight：下一次调用必须真的再发一次
    getSessionListMock.mockResolvedValueOnce([makeSession('!r1')])
    await store.getSessionList()
    expect(getSessionListMock).toHaveBeenCalledTimes(2)
    expect(store.loadError).toBeNull()
  })

  it('成功后清空上一次的 loadError', async () => {
    getSessionListMock.mockRejectedValueOnce(new Error('network'))
    const store = useSessionStore()
    await store.getSessionList()
    expect(store.loadError).toBe('network')

    getSessionListMock.mockResolvedValueOnce([makeSession('!r1')])
    await store.getSessionList()
    expect(store.loadError).toBeNull()
  })
})
