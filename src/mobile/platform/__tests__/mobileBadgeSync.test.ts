import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { RoomTypeEnum } from '@/enums'

const { updateGlobalUnreadCountMock } = vi.hoisted(() => ({
  updateGlobalUnreadCountMock: vi.fn()
}))

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

vi.mock('@/stores/domains/chat/sessionUnread', () => ({
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
    currentSessionRoomId: '',
    updateGlobalUnreadCount: updateGlobalUnreadCountMock
  })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({ contactsList: [] })
}))

import { startMobileBadgeSync } from '@/mobile/platform/mobileBadgeSync'
import { useSessionStore } from '@/stores/domains/chat/chat/session'

const makeSession = (roomId: string, unreadCount: number) => ({
  roomId,
  name: roomId,
  type: RoomTypeEnum.GROUP,
  unreadCount,
  activeTime: 100
})

describe('移动端图标角标同步', () => {
  let pinia: Pinia
  let stopSync: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    stopSync?.()
    stopSync = undefined
  })

  it('启动时立即按当前会话未读刷新一次角标', () => {
    const sessionStore = useSessionStore(pinia)
    sessionStore.addSession(makeSession('!group:matrix.test', 4) as never)

    stopSync = startMobileBadgeSync(pinia)

    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(1)
  })

  it('新增会话带来未读时再次刷新角标', async () => {
    stopSync = startMobileBadgeSync(pinia)
    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(1)

    const sessionStore = useSessionStore(pinia)
    sessionStore.addSession(makeSession('!group:matrix.test', 2) as never)
    await nextTick()

    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(2)
  })

  it('会话未读数变化时再次刷新角标', async () => {
    const sessionStore = useSessionStore(pinia)
    sessionStore.addSession(makeSession('!group:matrix.test', 1) as never)
    stopSync = startMobileBadgeSync(pinia)
    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(1)

    sessionStore.updateSession('!group:matrix.test', { unreadCount: 7 })
    await nextTick()

    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(2)
  })

  it('停止同步后不再刷新角标', async () => {
    stopSync = startMobileBadgeSync(pinia)
    stopSync()
    stopSync = undefined
    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(1)

    const sessionStore = useSessionStore(pinia)
    sessionStore.addSession(makeSession('!group:matrix.test', 3) as never)
    await nextTick()

    expect(updateGlobalUnreadCountMock).toHaveBeenCalledTimes(1)
  })
})
