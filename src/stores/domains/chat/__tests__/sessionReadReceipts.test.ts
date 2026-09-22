import { createPinia, setActivePinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { RoomTypeEnum } from '@/enums'
import { useSessionUnreadStore } from '@/stores/domains/chat/sessionUnread'
import { useSettingStore } from '@/stores/domains/settings/setting'
import type { SessionItem } from '../chat'
import { useSessionStore } from '../chat/session'

const { sendReceiptByEventIdMock, fetchUnreadCountMock, getSessionListMock, clientMock, globalStoreMock } = vi.hoisted(
  () => {
    const room = {
      getLiveTimeline: () => ({ getEvents: () => [{ getId: () => '$e1' }] })
    }
    return {
      sendReceiptByEventIdMock: vi.fn().mockResolvedValue(undefined),
      fetchUnreadCountMock: vi.fn(),
      getSessionListMock: vi.fn(async (): Promise<SessionItem[]> => []),
      // 可变：当前打开的会话决定 apply 是否采信账本计数而不是服务端累计（评审 Important #2）
      globalStoreMock: { unreadReady: false, currentSessionRoomId: '' },
      clientMock: {
        getReadReceiptsManager: () => ({ sendReadReceiptByEventId: sendReceiptByEventIdMock }),
        getRoom: () => room
      }
    }
  }
)

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
  useGlobalStore: () => globalStoreMock
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
    globalStoreMock.currentSessionRoomId = ''
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
   * 跨设备收敛（本用例在账本整体持久化后改写，结论不变：角标 0）。
   *
   * 旧版本靠「cacheStore 不持久化」保证这里归零（旧 cache 跨重启不存在）。
   * 账本整体持久化后，归零的理由改为收敛规则：服务端计数比账本更小、且账本之后没有
   * 新消息（activeTime 未前移）时，判定为别的设备已经读过，采信服务端并把账本写回 0。
   * 「关闭已读回执」只表示不让同房间成员看到我读到哪，不代表每台设备各维护一套未读。
   */
  it('冷启动后，无 lastRead 记录的房间在别的设备已读完时收敛为 0 并写回账本', async () => {
    localStorage.clear()

    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    // 第一次启动：服务端报 5，本客户端从未打开该房间（因此没有 lastRead 记录）
    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const first = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 5, activeTime: 100 })])
    await first.getSessionList()
    expect(first.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(5)
    // 账本记 5（证明下面归零靠的是收敛规则，而不是「缓存没被持久化」）
    expect(useSessionUnreadStore().cacheStore['@me:matrix.test']?.[ROOM_ID]?.count).toBe(5)
    await nextTick()

    // 重启：期间用户在别的设备读完了该房间，服务端 unread_count 归零且没有新消息
    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const restarted = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 0, activeTime: 100 })])
    await restarted.getSessionList()

    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(0)
    expect(useSessionUnreadStore().cacheStore['@me:matrix.test']?.[ROOM_ID]?.count).toBe(0)
  })

  /**
   * 跨设备收敛（同进程）：本机从未打开过该房间（无 lastRead），旧账本记 3。
   * 用户在别的设备读完，服务端 unread_count 归零且没有新消息：角标必须收敛为 0，
   * 且账本一起写回 0，否则每轮会话列表重建都会用旧账本把角标顶回来。
   */
  it('关闭已读回执 + 同一进程内被别的设备读完：角标收敛为 0 且账本写回 0', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)

    const store = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 3, activeTime: 100 })])
    await store.getSessionList()
    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(3)

    // 别的设备读完：服务端归零，activeTime 未变
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 0, activeTime: 100 })])
    await store.getSessionList()

    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(0)
    expect(useSessionUnreadStore().cacheStore['@me:matrix.test']?.[ROOM_ID]?.count).toBe(0)
  })

  /**
   * 收敛的反向保护：服务端计数更小但房间已有更新的消息时，不得用更小的服务端值
   * 覆盖账本（那会把本机还没读的真实未读一起删掉）。
   */
  it('关闭已读回执 + 服务端计数更小但已有新消息：不误删真实未读', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)

    const store = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 10, activeTime: 100 })])
    await store.getSessionList()
    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(10)

    // 本机又收到一条（走真实增量路径：界面 + 账本 +1），账本写入时间被刷新
    store.setUnreadCount(ROOM_ID, 11)

    // 服务端因别的设备已读只剩 3；activeTime 晚于账本写入时间 = 已有一条账本没记到的消息
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 3, activeTime: Date.now() + 1000 })])
    await store.getSessionList()

    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(11)
  })

  /**
   * 核心回归（D1 缺口 a）：关闭已读回执时，关闭期间到达的新消息在冷启动后必须折算为
   * 本地增量，而不是服务端累计值。
   *
   * 链路：读 3 条（lastRead=100、账本清零、把「已结算 3 条」记入账本）→ 关闭应用 →
   * 期间来了 1 条（服务端累计 4、activeTime 200）→ 重启。服务端收不到 m.read，
   * 累计值里仍包含已读的 3 条，只有持久化的账本水位才能把它折算成 1。
   * 修复前 cacheStore 不跨重启，apply 的「情况 2」退回服务端累计 → 角标 4。
   */
  it('关闭已读回执 + 关闭期间到达新消息：冷启动后角标是本地增量而不是服务端累计', async () => {
    localStorage.clear()

    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    // 第一次启动：读 3 条
    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const first = useSessionStore()
    first.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))
    await first.markSessionRead(ROOM_ID)
    expect(first.getSession(ROOM_ID)?.unreadCount).toBe(0)
    await nextTick()

    // 重启：关闭期间来了 1 条新消息
    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const restarted = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 4, activeTime: 200 })])
    await restarted.getSessionList()

    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(1)
    expect(useSessionUnreadStore().cacheStore['@me:matrix.test']?.[ROOM_ID]?.count).toBe(1)
  })

  /**
   * 核心回归（D1 缺口 a 的第二种形态）：本机已经记过的本地增量必须跨重启存活。
   *
   * 读 3 条 → 应用运行中又来 1 条（账本记 1）→ 重启。服务端因为没有 m.read 仍报累计 4；
   * 修复前 cacheStore 不持久化，「情况 2」退回服务端累计 → 角标 4。
   */
  it('关闭已读回执 + 重启后账本里的本地增量仍优先于服务端累计', async () => {
    localStorage.clear()

    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const first = useSessionStore()
    first.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))
    await first.markSessionRead(ROOM_ID)
    first.setUnreadCount(ROOM_ID, 1)
    expect(first.getSession(ROOM_ID)?.unreadCount).toBe(1)
    await nextTick()

    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const restarted = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 4, activeTime: 200 })])
    await restarted.getSessionList()

    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(1)
    expect(useSessionUnreadStore().cacheStore['@me:matrix.test']?.[ROOM_ID]?.count).toBe(1)
  })

  /**
   * I4 回归：关闭已读回执后「读过的消息 + 新消息」。
   *
   * 服务端永远不会因本机已读而减计数，apply 的「情况 2」原样采信服务端快照，
   * 于是读 3 条后再来 1 条新消息，会话列表重建时角标变成 4（把已读的 3 条又算回来）。
   * 本地账本必须优先于服务端快照。
   */
  it('关闭已读回执时，读过之后的新消息只累计本地增量（读 3 → 新消息 → 1）', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)

    const store = useSessionStore()
    store.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))

    await store.markSessionRead(ROOM_ID)
    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(0)

    // 新消息到达：走真实增量路径（界面 + 本地账本 +1）
    store.setUnreadCount(ROOM_ID, 1)
    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(1)

    // 会话列表重建：服务端因为没有 m.read 仍报累计 4，activeTime 200 > lastRead 100
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 4, activeTime: 200 })])
    await store.getSessionList()

    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(1)
  })

  it('开启已读回执时仍采信服务端未读数（不改变原行为）', async () => {
    useSettingStore().setSendReadReceiptsEnabled(true)

    const store = useSessionStore()
    store.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))

    await store.markSessionRead(ROOM_ID)
    store.setUnreadCount(ROOM_ID, 1)

    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 4, activeTime: 200 })])
    await store.getSessionList()

    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(4)
  })

  /**
   * 评审 Important #1：`settledServerCount` 在服务端计数跌破它时没有失效路径。
   *
   * 链路：本机读 3（水位 3、角标 0）→ 别的设备把该房间读完（服务端归零、水位失效）→
   * 关闭期间来 1 条（服务端累计 1、activeTime 200）→ 冷启动。
   * 旧实现做减法：max(0, 1 - 3) = 0，角标 0（真实未读 1）且把水位写坏成 1。
   * 正确行为：服务端累计低于水位 = 服务端那一轮计数已被重置，整体重算 —— 角标 1、水位 0；
   * 下一条消息（服务端累计 2）应该得到 2，证明水位重算后仍然自洽。
   */
  it('关闭已读回执 + 别的设备读完后关闭期间到达新消息：水位失效重算，角标 1 且下一条继续 +1', async () => {
    localStorage.clear()

    const bootPersistedPinia = () => {
      const pinia = createPinia()
      pinia.use(createPersistedState({ auto: false }))
      createApp({}).use(pinia)
      setActivePinia(pinia)
    }

    // 第一次启动：读 3 条
    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const first = useSessionStore()
    first.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))
    await first.markSessionRead(ROOM_ID)
    expect(first.getSession(ROOM_ID)?.unreadCount).toBe(0)
    await nextTick()

    // 关闭期间：别的设备读完了房间（服务端归零）后又来了 1 条新消息
    bootPersistedPinia()
    useSettingStore().setSendReadReceiptsEnabled(false)
    const restarted = useSessionStore()
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 1, activeTime: 200 })])
    await restarted.getSessionList()
    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(1)

    // 下一条消息：水位已经重算，服务端累计 2 = 2 条真实未读
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 2, activeTime: 300 })])
    await restarted.getSessionList()
    expect(restarted.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(2)
  })

  /**
   * 评审 Important #2：房间正开着时到达的消息被 case 2 重复计算。
   *
   * messageMutations 对当前打开的房间不增加界面未读（消息已经在视图里），但 activeTime 仍会
   * 前进；于是「服务端累计 4 - 旧水位 3」把已经看到的这条重新算成未读，角标弹回 1。
   * 修复：apply 对当前打开的会话采信账本计数（0），只把水位对齐到服务端快照。
   */
  it('关闭已读回执 + 消息到达当前打开的房间：会话列表重建后角标保持 0，后台消息仍 +1', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)

    const store = useSessionStore()
    store.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))
    await store.markSessionRead(ROOM_ID)
    expect(store.getSession(ROOM_ID)?.unreadCount).toBe(0)

    // 房间保持打开（globalStore.currentSessionRoomId 仍是它）：消息到达只刷新 activeTime
    globalStoreMock.currentSessionRoomId = ROOM_ID

    // 服务端因为没有 m.read 累计到 4，activeTime 200 > lastRead 100
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 4, activeTime: 200 })])
    await store.getSessionList()
    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(0)

    // 之后用户切到别的房间、后台再来 1 条：本地 +1，服务端累计 5 → 角标 1（水位已被对齐）
    globalStoreMock.currentSessionRoomId = '!other:matrix.test'
    store.setUnreadCount(ROOM_ID, 1)
    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 5, activeTime: 300 })])
    await store.getSessionList()
    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(1)
  })

  /**
   * 回执开启时「当前打开房间收到消息」的既有行为：服务端即真源，角标等于服务端累计值。
   * 当前打开房间的特例只在回执关时生效，因此这条行为完全不变。
   */
  it('回执开启 + 消息到达当前打开的房间：仍以服务端为准（行为不变）', async () => {
    useSettingStore().setSendReadReceiptsEnabled(true)

    const store = useSessionStore()
    store.addSession(makeSession({ unreadCount: 3, activeTime: 100 }))
    await store.markSessionRead(ROOM_ID)
    globalStoreMock.currentSessionRoomId = ROOM_ID

    getSessionListMock.mockResolvedValue([makeSession({ unreadCount: 4, activeTime: 200 })])
    await store.getSessionList()

    expect(store.sessionList.find((s) => s.roomId === ROOM_ID)?.unreadCount).toBe(4)
  })
})
