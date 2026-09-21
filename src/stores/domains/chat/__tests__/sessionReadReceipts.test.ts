import { createPinia, setActivePinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { RoomTypeEnum } from '@/enums'
import { useSessionUnreadStore } from '@/stores/domains/chat/sessionUnread'
import { useSettingStore } from '@/stores/domains/settings/setting'
import type { SessionItem } from '../chat'
import { useSessionStore } from '../chat/session'

const { sendReceiptByEventIdMock, fetchUnreadCountMock, getSessionListMock, clientMock } = vi.hoisted(() => {
  const room = {
    getLiveTimeline: () => ({ getEvents: () => [{ getId: () => '$e1' }] })
  }
  return {
    sendReceiptByEventIdMock: vi.fn().mockResolvedValue(undefined),
    fetchUnreadCountMock: vi.fn(),
    getSessionListMock: vi.fn(async (): Promise<SessionItem[]> => []),
    clientMock: {
      getReadReceiptsManager: () => ({ sendReadReceiptByEventId: sendReceiptByEventIdMock }),
      getRoom: () => room
    }
  }
})

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: { enqueue: vi.fn() }
}))

// 真实 MatrixReceiptService（含「发送已读回执」守卫）走这两个导出，必须同时桩掉
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: () => clientMock },
  matrixClientService: { getClient: () => clientMock }
}))

vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({
  matrixSessionService: { getSessionList: getSessionListMock }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: { getSpecialFriends: vi.fn(async () => []) }
}))

vi.mock('@/services/matrix/notifications/MatrixRoomNotificationService', () => ({
  matrixRoomNotificationService: { fetchUnreadCount: fetchUnreadCountMock }
}))

// 刻意不 mock ../sessionUnread：真实的 useSessionUnreadStore 是「角标被服务端旧值写回」
// 这条回归路径上唯一能恢复计数的组件，桩掉它等于把被测的核心逻辑移出测试。
// 同理不 mock ../chat/session：必须驱动真实的 markSessionRead / getSessionList。
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:matrix.test' } })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ unreadReady: false, currentSessionRoomId: '' })
}))

vi.mock('../contacts', () => ({
  useContactStore: () => ({ contactsList: [] })
}))

const ROOM_ID = '!receipt-room:matrix.test'

const makeSession = (overrides: Partial<SessionItem> = {}): SessionItem =>
  ({
    roomId: ROOM_ID,
    name: 'receipt-room',
    type: RoomTypeEnum.SINGLE,
    unreadCount: 4,
    activeTime: 100,
    ...overrides
  }) as SessionItem

/**
 * 回归守门：markSessionRead 只在「回执确实发出」时才回读服务端未读数。
 *
 * 关闭「发送已读回执」时服务端不会收到 m.read，`GET /rooms/{id}/unread_count`
 * 仍然 >0；若无条件回读，用户正在浏览的房间会出现「角标清零 -> 弹回」并跨重启存活。
 */
describe('SessionStore markSessionRead 与「发送已读回执」偏好联动', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getSessionListMock.mockResolvedValue([])
  })

  it('关闭偏好时不回读服务端未读数，本地角标保持清零', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)
    fetchUnreadCountMock.mockResolvedValue({ notification_count: 4, highlight_count: 0 })

    const store = useSessionStore()
    store.addSession(makeSession())

    await store.markSessionRead(ROOM_ID)

    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(0)
    expect(fetchUnreadCountMock).not.toHaveBeenCalled()
    expect(sendReceiptByEventIdMock).not.toHaveBeenCalled()
  })

  it('偏好开启时回执发出，仍然回读服务端未读数', async () => {
    useSettingStore().setSendReadReceiptsEnabled(true)
    fetchUnreadCountMock.mockResolvedValue({ notification_count: 0, highlight_count: 0 })

    const store = useSessionStore()
    store.addSession(makeSession())

    await store.markSessionRead(ROOM_ID)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendReceiptByEventIdMock).toHaveBeenCalledWith(ROOM_ID, '$e1')
    expect(fetchUnreadCountMock).toHaveBeenCalledTimes(1)
    expect(fetchUnreadCountMock).toHaveBeenCalledWith(ROOM_ID)
    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(0)
  })

  /**
   * 回归守门（Task 2b）：角标回来的第二条路径。
   *
   * syncPersistedUnreadCounts() 在会话列表重建后会调用 sessionUnread.apply()，
   * 而 apply 的「情况 3」（没有 lastRead 记录）用 Math.max(cached, serverCount) 兜底。
   * 关闭已读回执后服务端 unread_count 不会清零，于是重连/刷新重建列表就把角标写回来。
   * markSessionRead 必须记录 lastRead，让 apply 走「情况 1」清零并纠正服务端脏数据。
   */
  it('关闭已读回执时，会话列表重建后角标不会被服务端旧值写回', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)

    const store = useSessionStore()
    store.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))

    await store.markSessionRead(ROOM_ID)
    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(0)

    // 服务端没收到 m.read，unread_count 仍是 3；activeTime 未变。重连/刷新重建会话列表。
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 3, activeTime: 100 })])
    await store.getSessionList()

    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(0)
  })

  /**
   * 回归守门（Task 2b 补修）：角标跨重启存活。
   *
   * 上一条用例只覆盖「同一个 pinia 实例内重建会话列表」。冷启动时 pinia 与所有 store
   * 都会重新创建：若 sessionUnread 不持久化，lastRead 记录丢失，apply 又退回情况 3，
   * 服务端的旧 unread_count 会再次把角标写回来。
   *
   * 这里真实地模拟重启：换一个全新的 pinia（重新安装持久化插件）并重新创建 store，
   * 让 state 只能来自 localStorage 的水合，而不是同一实例的内存残留。
   */
  it('冷启动（新 pinia 水合）后重建会话列表，角标仍不会被服务端旧值写回', async () => {
    localStorage.clear()

    // 与 src/stores/index.ts 一致：全新 pinia + 持久化插件，仅重建 store 而不复用实例。
    // 注意 pinia 插件只在 pinia 被 app.use() 安装后才真正注册（_p 才有内容），
    // 所以这里挂到一个一次性 app 上，否则插件不会生效、持久化根本不会发生。
    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const store = useSessionStore()
    store.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))

    await store.markSessionRead(ROOM_ID)
    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(0)
    // $subscribe 默认 pre flush，等一拍确保写入 localStorage
    await nextTick()

    // 重启：全新 pinia，sessionUnread 只能从 localStorage 水合
    bootPersistedPinia()
    const restarted = useSessionStore()
    // 服务端始终没收到 m.read：unread_count 仍是 3，activeTime 未变
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 3, activeTime: 100 })])
    await restarted.getSessionList()

    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(0)
    // 证明确实发生了「水合」而非同一 pinia 的内存残留
    expect(useSessionUnreadStore().lastReadActiveTimeStore['@me:matrix.test']?.[ROOM_ID]).toBe(100)
  })

  /**
   * 回归守门（Task 2b 评审补修 1）：未读缓存不得跨重启把角标顶回来。
   *
   * apply 的「情况 3」在没有 lastRead 记录时用 Math.max(cached, serverCount) 兜底。
   * 若 cacheStore 也被持久化，一个本客户端从未打开过的房间会把旧缓存带到重启后：
   * 用户在别的设备读完了消息、服务端 unread_count 已归零，本机却仍按旧缓存把角标写回。
   * 持久化只需覆盖 lastReadActiveTimeStore（apply 情况 1 依赖它），缓存必须留在内存里。
   */
  it('冷启动后，无 lastRead 记录的房间不会被持久化的旧缓存顶回角标', async () => {
    localStorage.clear()

    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    // 第一次启动：服务端报 5，本客户端从未打开该房间（因此没有 lastRead 记录）
    bootPersistedPinia()
    const first = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 5, activeTime: 100 })])
    await first.getSessionList()
    expect(first.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(5)
    await nextTick()

    // 重启：期间用户在别的设备读完了该房间，服务端 unread_count 归零且没有新消息
    bootPersistedPinia()
    const restarted = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 0, activeTime: 100 })])
    await restarted.getSessionList()

    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(0)
  })
})
