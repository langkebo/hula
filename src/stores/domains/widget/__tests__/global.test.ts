import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { MittEnum } from '@/enums'
import { useGlobalStore } from '../global'

const { chatStoreMock, emitMock, getCurrentMock } = vi.hoisted(() => ({
  chatStoreMock: {
    sessionList: [] as Array<Record<string, unknown>>,
    changeRoom: vi.fn(),
    getSession: vi.fn(),
    markSessionRead: vi.fn()
  },
  emitMock: vi.fn(),
  getCurrentMock: vi.fn(() => ({ label: 'home' }))
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: getCurrentMock
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn()
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: vi.fn(() => chatStoreMock)
}))

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: {
    on: vi.fn(),
    off: vi.fn(),
    emit: emitMock
  }
}))

vi.mock('@/utils/UnreadCountManager', () => ({
  unreadCountManager: {
    calculateTotal: vi.fn(),
    refreshBadge: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn()
  }))
}))

describe('useGlobalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getCurrentMock.mockReturnValue({ label: 'home' })
    chatStoreMock.sessionList = []
    chatStoreMock.changeRoom.mockResolvedValue(undefined)
    chatStoreMock.getSession.mockReturnValue(undefined)
    chatStoreMock.markSessionRead.mockImplementation(() => undefined)
  })

  it('should initialize with default values', () => {
    const store = useGlobalStore()
    expect(store.unReadMark.newFriendUnreadCount).toBe(0)
    expect(store.unReadMark.newGroupUnreadCount).toBe(0)
    expect(store.unReadMark.newMsgUnreadCount).toBe(0)
    expect(store.unreadReady).toBe(true)
  })

  it('should update unread counts', () => {
    const store = useGlobalStore()
    store.unReadMark.newFriendUnreadCount = 5
    store.unReadMark.newMsgUnreadCount = 10

    expect(store.unReadMark.newFriendUnreadCount).toBe(5)
    expect(store.unReadMark.newMsgUnreadCount).toBe(10)
  })

  it('should manage current session room id', () => {
    const store = useGlobalStore()
    store.updateCurrentSessionRoomId('room123')

    expect(store.currentSessionRoomId).toBe('room123')
  })

  it('should toggle unread ready state', () => {
    const store = useGlobalStore()
    const initial = store.unreadReady

    store.unreadReady = !initial
    expect(store.unreadReady).toBe(!initial)
  })

  it('should load messages and emit session change when current session changes', async () => {
    chatStoreMock.getSession.mockReturnValue({
      roomId: 'room-1',
      unreadCount: 2
    })

    const store = useGlobalStore()
    store.updateCurrentSessionRoomId('room-1')
    await nextTick()
    await Promise.resolve()

    expect(chatStoreMock.changeRoom).toHaveBeenCalledTimes(1)
    expect(chatStoreMock.markSessionRead).toHaveBeenCalledWith('room-1')
    expect(emitMock).toHaveBeenCalledWith(MittEnum.SESSION_CHANGED, {
      roomId: 'room-1',
      oldRoomId: ''
    })
  })
})
