import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from '@/stores/room'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/BaseManager', () => {
  return {
    BaseManager: class {
      protected handleError<T>(error: unknown, _operation: string, defaultValue: T, throwOnError: boolean): T {
        if (throwOnError) throw error
        return defaultValue
      }
      protected normalizeError(error: unknown, _operation: string) {
        return error
      }
    }
  }
})

vi.mock('@/services/matrix', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null),
    isLoggedIn: vi.fn(() => false)
  },
  matrixRoomService: {
    getRooms: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn()
  },
  matrixEventService: {
    getRoomTimeline: vi.fn(),
    sendTextMessage: vi.fn()
  }
}))

vi.mock('@/stores/matrix', () => ({
  useMatrixStore: vi.fn(() => ({
    getClient: vi.fn(() => null),
    isLoggedIn: false
  }))
}))

describe('RoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have empty rooms map initially', () => {
      const store = useRoomStore()
      expect(store.rooms.size).toBe(0)
    })

    it('should have null currentRoomId initially', () => {
      const store = useRoomStore()
      expect(store.currentRoomId).toBeNull()
    })

    it('should have empty messages map initially', () => {
      const store = useRoomStore()
      expect(store.messages.size).toBe(0)
    })

    it('should not be loading initially', () => {
      const store = useRoomStore()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('roomList', () => {
    it('should return empty array when no rooms', () => {
      const store = useRoomStore()
      expect(store.roomList).toEqual([])
    })
  })

  describe('currentRoom', () => {
    it('should return null when no current room', () => {
      const store = useRoomStore()
      expect(store.currentRoom).toBeNull()
    })
  })

  describe('currentMessages', () => {
    it('should return empty array when no current room', () => {
      const store = useRoomStore()
      expect(store.currentMessages).toEqual([])
    })
  })

  describe('directRooms', () => {
    it('should return empty array when no rooms', () => {
      const store = useRoomStore()
      expect(store.directRooms).toEqual([])
    })
  })

  describe('groupRooms', () => {
    it('should return empty array when no rooms', () => {
      const store = useRoomStore()
      expect(store.groupRooms).toEqual([])
    })
  })

  describe('setCurrentRoom', () => {
    it('should set current room id', () => {
      const store = useRoomStore()
      store.setCurrentRoom('!room:id')

      expect(store.currentRoomId).toBe('!room:id')
    })

    it('should set current room id to null', () => {
      const store = useRoomStore()
      store.setCurrentRoom('!room:id')
      store.setCurrentRoom(null)

      expect(store.currentRoomId).toBeNull()
    })
  })
})
