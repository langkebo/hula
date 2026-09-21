import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import type { SessionItem } from '../chat'
import { useSessionStore } from '../chat/session'

const { sendReceiptByEventIdMock, fetchUnreadCountMock, clientMock } = vi.hoisted(() => {
  const room = {
    getLiveTimeline: () => ({ getEvents: () => [{ getId: () => '$e1' }] })
  }
  return {
    sendReceiptByEventIdMock: vi.fn().mockResolvedValue(undefined),
    fetchUnreadCountMock: vi.fn(),
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
  matrixSessionService: { getSessionList: vi.fn(async () => []) }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: { getSpecialFriends: vi.fn(async () => []) }
}))

vi.mock('@/services/matrix/notifications/MatrixRoomNotificationService', () => ({
  matrixRoomNotificationService: { fetchUnreadCount: fetchUnreadCountMock }
}))

vi.mock('../sessionUnread', () => ({
  useSessionUnreadStore: () => ({ apply: vi.fn(() => ({})), set: vi.fn() })
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
})
