import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGlobalStore } from '../global'

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn()
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: vi.fn(() => ({
    sessionList: []
  }))
}))

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

vi.mock('@/utils/UnreadCountManager', () => ({
  unreadCountManager: {
    getTotalUnread: vi.fn(() => 0),
    updateBadge: vi.fn()
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
    store.currentSessionRoomId = 'room123'

    expect(store.currentSessionRoomId).toBe('room123')
  })

  it('should toggle unread ready state', () => {
    const store = useGlobalStore()
    const initial = store.unreadReady

    store.unreadReady = !initial
    expect(store.unreadReady).toBe(!initial)
  })
})
