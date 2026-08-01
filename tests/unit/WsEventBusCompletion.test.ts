import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MittEnum } from '@/enums'

// ===== 受控 mitt：emit 转发给已注册的 on 监听器 =====
const { mittHandlers } = vi.hoisted(() => ({ mittHandlers: new Map<string, Array<(...args: unknown[]) => void>>() }))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!mittHandlers.has(event)) mittHandlers.set(event, [])
      mittHandlers.get(event)!.push(handler)
    }),
    emit: vi.fn((event: string, data?: unknown) => {
      mittHandlers.get(event)?.forEach((h) => h(data))
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const arr = mittHandlers.get(event)
      if (arr) {
        const idx = arr.indexOf(handler)
        if (idx >= 0) arr.splice(idx, 1)
      }
    })
  }
}))

// ===== 带 _emit 辅助的 Mock Manager =====
function createMockManager() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event)!.push(handler)
    }),
    off: vi.fn(),
    _emit(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((h) => h(...args))
    }
  }
}

const friendMgr = createMockManager()
const burnMgr = createMockManager()
const widgetMgr = createMockManager()

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => ({
      getFriendManager: () => friendMgr,
      getBurnAfterReadManager: () => burnMgr,
      getWidgetManager: () => widgetMgr
    }),
    waitForClientReady: vi.fn().mockResolvedValue(undefined)
  }
}))

// ===== Store mocks（用于 store 联动测试）=====
const contactStoreMock = {
  getApplyPage: vi.fn().mockResolvedValue(undefined),
  getContactList: vi.fn().mockResolvedValue(undefined),
  getApplyUnReadCount: vi.fn().mockResolvedValue(undefined),
  contactsList: [] as unknown[],
  updateContactPresence: vi.fn()
}
const globalStoreMock = {
  refreshUnreadBadge: vi.fn(),
  currentSession: null,
  currentSessionRoomId: '',
  updateCurrentSessionRoomId: vi.fn(),
  setUnreadCounts: vi.fn()
}
const chatStoreMock = {
  deleteMsg: vi.fn(),
  updateRecallMsg: vi.fn().mockResolvedValue(undefined),
  syncLoading: false,
  sessionList: [] as unknown[],
  getSession: vi.fn(),
  fetchCurrentRoomRemoteOnce: vi.fn().mockResolvedValue(undefined),
  markSessionRead: vi.fn(),
  updateMarkCount: vi.fn().mockResolvedValue(undefined)
}
const sessionStoreMock = {
  removeSession: vi.fn(),
  addSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn(),
  sessionList: [{ roomId: 'test-room' }] as unknown[],
  markSessionRead: vi.fn(),
  clearCurrentSessionUnread: vi.fn(),
  updateTotalUnreadCount: vi.fn(),
  requestUnreadCountUpdate: vi.fn(),
  clearUnreadCount: vi.fn(),
  getGroupSessions: vi.fn(),
  resetSessionSelection: vi.fn()
}
const groupStoreMock = {
  allUserInfo: [] as unknown[],
  updateOnlineNum: vi.fn(),
  updateUserItem: vi.fn(),
  updateUserPresence: vi.fn(),
  addUserItem: vi.fn(),
  removeUserItem: vi.fn(),
  removeAllUsers: vi.fn(),
  addGroupDetail: vi.fn(),
  updateGroupNumber: vi.fn(),
  getGroupUserList: vi.fn().mockResolvedValue(undefined),
  getUserInfo: vi.fn().mockReturnValue(null)
}
const userStoreMock = {
  userInfo: { uid: 'test-uid', activeStatus: 1, lastOptTime: 0, client: 'test' }
}
const settingStoreMock = { toggleLogin: vi.fn() }

vi.mock('@/stores/domains/chat/contacts', () => ({ useContactStore: () => contactStoreMock }))
vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => chatStoreMock }))
vi.mock('@/stores/domains/chat/chat/session', () => ({ useSessionStore: () => sessionStoreMock }))
vi.mock('@/stores/domains/chat/group', () => ({ useGroupStore: () => groupStoreMock }))
vi.mock('@/stores/domains/settings/setting', () => ({ useSettingStore: () => settingStoreMock }))
vi.mock('@/stores/domains/user/user', () => ({ useUserStore: () => userStoreMock }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalStoreMock }))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: vi.fn() }))
vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({ createRtcCallWindow: vi.fn(), sendWindowPayload: vi.fn() })
}))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: () => false }))
vi.mock('@/utils/PlatformConstants', () => ({ isMobile: () => false }))
vi.mock('@/utils/presenceStatus', () => ({
  buildPresenceStorePatch: vi.fn().mockReturnValue({ activeStatus: 1, lastOptTime: 0 }),
  collectTrackedPresenceUserIds: vi.fn().mockReturnValue([])
}))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

import { subscribeManagerEvents, useWsEventHandler } from '@/composables/app/useWsEventHandler'
import { useMitt } from '@/composables/common/useMitt'

describe('WsEventHandler widget subscription + store linkage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mittHandlers.clear()
  })

  it('subscribeManagerEvents subscribes to WidgetManager', async () => {
    await subscribeManagerEvents()
    expect(widgetMgr.on).toHaveBeenCalled()
    // 应订阅 widget_created / widget_updated / widget_deleted 三个事件
    const events = widgetMgr.on.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(events).toContain('WidgetCreated')
    expect(events).toContain('WidgetUpdated')
    expect(events).toContain('WidgetDeleted')
  })

  it('emits mitt event on friend RequestReceived', async () => {
    await subscribeManagerEvents()
    const request = { user_id: '@alice:server', reason: 'hi' }
    friendMgr._emit('RequestReceived', request)
    expect(useMitt.emit).toHaveBeenCalledWith(MittEnum.FRIEND_REQUEST_RECEIVED, request)
  })

  it('emits mitt event on burn MessageBurned', async () => {
    await subscribeManagerEvents()
    burnMgr._emit('MessageBurned', '$event123', 1700000000000)
    expect(useMitt.emit).toHaveBeenCalledWith(MittEnum.BURN_MESSAGE_BURNED, {
      eventId: '$event123',
      burnedAt: 1700000000000
    })
  })

  it('emits mitt event on widget WidgetUpdated', async () => {
    await subscribeManagerEvents()
    const widget = { widget_id: 'w1', name: 'updated' }
    widgetMgr._emit('WidgetUpdated', widget)
    expect(useMitt.emit).toHaveBeenCalledWith(MittEnum.WIDGET_UPDATED, widget)
  })

  it('store linkage: friend request triggers contactStore.getApplyPage + refreshUnreadBadge', async () => {
    const { registerHandlers } = useWsEventHandler()
    registerHandlers()

    // 通过受控 mitt 触发 FRIEND_REQUEST_RECEIVED store 联动
    useMitt.emit(MittEnum.FRIEND_REQUEST_RECEIVED, { user_id: '@bob:server' })
    await Promise.resolve()

    expect(contactStoreMock.getApplyPage).toHaveBeenCalledWith('friend', true)
    expect(globalStoreMock.refreshUnreadBadge).toHaveBeenCalled()
  })

  it('store linkage: friend accepted triggers contactStore.getContactList', async () => {
    const { registerHandlers } = useWsEventHandler()
    registerHandlers()

    useMitt.emit(MittEnum.FRIEND_REQUEST_ACCEPTED, '@alice:server')
    await Promise.resolve()

    expect(contactStoreMock.getContactList).toHaveBeenCalledWith(true)
  })

  it('store linkage: burn completed triggers chatStore.deleteMsg', async () => {
    const { registerHandlers } = useWsEventHandler()
    registerHandlers()

    useMitt.emit(MittEnum.BURN_MESSAGE_BURNED, { eventId: '$burned-event', burnedAt: 1700000000000 })
    await Promise.resolve()

    expect(chatStoreMock.deleteMsg).toHaveBeenCalledWith('$burned-event')
  })

  it('subscribeManagerEvents returns unsubscribe that cleans up', async () => {
    const unsub = await subscribeManagerEvents()
    expect(typeof unsub).toBe('function')
    unsub()
    expect(widgetMgr.off).toHaveBeenCalled()
    expect(friendMgr.off).toHaveBeenCalled()
    expect(burnMgr.off).toHaveBeenCalled()
  })
})
