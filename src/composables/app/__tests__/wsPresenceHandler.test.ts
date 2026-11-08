import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef, triggerRef } from 'vue'
import { OnlineEnum } from '@/enums'
import type { PresenceInfo } from '@/services/matrix/user/MatrixPresenceService'
import { createPresenceHandler } from '../wsPresenceHandler'

const subscribeToPresence = vi.fn()
const getBatchPresence = vi.fn()
const onPresenceChange = vi.fn()

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn().mockReturnValue({}),
    waitForClientReady: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: {
    subscribeToPresence: (...args: unknown[]) => subscribeToPresence(...args),
    getBatchPresence: (...args: unknown[]) => getBatchPresence(...args),
    onPresenceChange: (...args: unknown[]) => onPresenceChange(...args)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}))

const ME = '@me:example.org'
const ALICE = '@alice:example.org'
const BOB = '@bob:example.org'

function createStores() {
  return {
    userStore: {
      userInfo: { uid: ME, activeStatus: 0, lastOptTime: 0 }
    },
    contactStore: {
      contactsList: [{ userId: ALICE }],
      updateContactPresence: vi.fn()
    },
    groupStore: {
      allUserInfo: [{ uid: BOB }],
      updateUserPresence: vi.fn(),
      getGroupUserList: vi.fn().mockResolvedValue([])
    },
    chatStore: { sessionList: [] as Array<Record<string, unknown>> },
    globalStore: { currentSession: null, currentSessionRoomId: null }
  }
}

function presence(userId: string, state: PresenceInfo['presence'] = 'online'): PresenceInfo {
  return { user_id: userId, presence: state, last_active_ago: 1000 }
}

function buildHandler() {
  const stores = createStores()
  // 依赖只用到 store 的少量字段，测试里以最小结构替代真实 Pinia store
  const handler = createPresenceHandler(stores as never)
  return { stores, handler }
}

describe('wsPresenceHandler presence 单一管线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onPresenceChange.mockReturnValue(() => {})
  })

  it('订阅失败不阻断批量查询，且失败用户不在订阅集合中', async () => {
    subscribeToPresence.mockRejectedValueOnce(new Error('subscribe failed'))
    getBatchPresence.mockResolvedValueOnce([presence(ME), presence(ALICE), presence(BOB)])
    const { stores, handler } = buildHandler()

    await handler.syncAvatarPresence()

    expect(subscribeToPresence).toHaveBeenCalledTimes(1)
    expect(getBatchPresence).toHaveBeenCalledTimes(1)
    expect(getBatchPresence).toHaveBeenCalledWith([ALICE, BOB, ME].sort())
    expect(handler.getSubscribedPresenceUserIds().size).toBe(0)
    expect(stores.contactStore.updateContactPresence).toHaveBeenCalledTimes(3)
  })

  it('同一用户只订阅一次，后续同步只做批量查询', async () => {
    subscribeToPresence.mockResolvedValue({ presences: [] })
    getBatchPresence.mockResolvedValue([presence(ALICE)])
    const { handler } = buildHandler()

    await handler.syncAvatarPresence()
    await handler.syncAvatarPresence()

    expect(subscribeToPresence).toHaveBeenCalledTimes(1)
    expect(handler.getSubscribedPresenceUserIds().size).toBe(3)
    expect(getBatchPresence).toHaveBeenCalledTimes(2)
  })

  it('批量查询失败时保持 store 原值，不写入离线状态', async () => {
    subscribeToPresence.mockResolvedValue({ presences: [] })
    getBatchPresence.mockRejectedValueOnce(new Error('batch failed'))
    const { stores, handler } = buildHandler()

    await handler.syncAvatarPresence()

    expect(stores.contactStore.updateContactPresence).not.toHaveBeenCalled()
    expect(stores.groupStore.updateUserPresence).not.toHaveBeenCalled()
    expect(stores.userStore.userInfo.activeStatus).toBe(0)
  })

  it('实时变更只更新对应用户', async () => {
    subscribeToPresence.mockResolvedValue({ presences: [] })
    getBatchPresence.mockResolvedValue([])
    const { stores, handler } = buildHandler()

    await handler.handleLoginPresence()
    expect(onPresenceChange).toHaveBeenCalledTimes(1)

    const listener = onPresenceChange.mock.calls[0]?.[0] as (info: PresenceInfo) => void
    listener(presence(ALICE, 'offline'))

    expect(stores.contactStore.updateContactPresence).toHaveBeenCalledTimes(1)
    expect(stores.contactStore.updateContactPresence.mock.calls[0]?.[0]).toBe(ALICE)
    expect(stores.groupStore.updateUserPresence).toHaveBeenCalledTimes(1)
    expect(stores.userStore.userInfo.activeStatus).toBe(0)
  })

  it('WS 上下线事件经唯一写入口写入，且显式不覆盖 presence/statusMessage', () => {
    const { stores, handler } = buildHandler()

    handler.applyPresenceStatus(ALICE, OnlineEnum.ONLINE, 12345)

    expect(stores.contactStore.updateContactPresence).toHaveBeenCalledTimes(1)
    expect(stores.contactStore.updateContactPresence.mock.calls[0]).toEqual([
      ALICE,
      { activeStatus: OnlineEnum.ONLINE, lastOptTime: 12345 }
    ])
    expect(stores.groupStore.updateUserPresence).toHaveBeenCalledTimes(1)
    expect(stores.groupStore.updateUserPresence.mock.calls[0]).toEqual([
      ALICE,
      { activeStatus: OnlineEnum.ONLINE, lastOptTime: 12345 }
    ])
  })

  it('WS 上下线事件命中本人时同步 userStore，空 userId 不写入', () => {
    const { stores, handler } = buildHandler()

    handler.applyPresenceStatus(ME, OnlineEnum.OFFLINE, 999)
    expect(stores.userStore.userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
    expect(stores.userStore.userInfo.lastOptTime).toBe(999)

    handler.applyPresenceStatus('', OnlineEnum.ONLINE, 1000)
    expect(stores.contactStore.updateContactPresence).toHaveBeenCalledTimes(1)
    expect(stores.groupStore.updateUserPresence).toHaveBeenCalledTimes(1)
  })

  /**
   * 回归守门：watch 只应关心「被跟踪用户集合」的成员变化。
   *
   * updateContactPresence 按原下标替换元素，仍会 triggerRef(contactsList)；
   * 若 watch getter 还把整表 clone + sort + join 当作键，每次好友上/下线都会
   * 做一遍 O(n log n) 的整表排序。这里用真实 shallowRef 驱动，锁定 presence
   * 字段变化不再触发批量刷新，只有成员增删才触发。
   */
  it('仅 presence 字段变化不触发批量刷新，成员集合变化才触发', async () => {
    subscribeToPresence.mockResolvedValue({ presences: [] })
    getBatchPresence.mockResolvedValue([])

    const contacts = shallowRef<Array<Record<string, unknown>>>([{ userId: ALICE }])
    const stores = createStores()
    const handler = createPresenceHandler({
      ...stores,
      // 模拟 Pinia 把 shallowRef 解包后的响应式读取
      contactStore: {
        get contactsList() {
          return contacts.value
        },
        updateContactPresence: vi.fn()
      }
    } as never)

    handler.startPresenceWatch()
    await flushPromises()
    await nextTick()
    const initialSyncs = getBatchPresence.mock.calls.length
    expect(initialSyncs).toBeGreaterThan(0)

    // 好友 presence 事件：只替换单个元素，成员集合未变
    contacts.value[0] = { userId: ALICE, activeStatus: OnlineEnum.ONLINE, lastOptTime: 1 }
    triggerRef(contacts)
    await nextTick()
    await flushPromises()
    expect(getBatchPresence.mock.calls.length).toBe(initialSyncs)

    // 成员集合变化（新增好友）才需要重新订阅并批量刷新
    contacts.value = [...contacts.value, { userId: BOB }]
    await nextTick()
    await flushPromises()
    expect(getBatchPresence.mock.calls.length).toBe(initialSyncs + 1)

    handler.cleanup()
  })
})
