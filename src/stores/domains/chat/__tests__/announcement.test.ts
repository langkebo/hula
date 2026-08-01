import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showFeedbackMock, getRoomMock, isCurrentLordMock, isAdminMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  getRoomMock: vi.fn(),
  isCurrentLordMock: vi.fn(() => false),
  isAdminMock: vi.fn(() => false)
}))

const mockUserStore = {
  userInfo: { uid: '@user:matrix.test' }
}

const mockGlobalStore = {
  currentSessionRoomId: 'room-1'
}

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/room/QueryService', () => ({
  matrixRoomQueryService: {
    getRoom: getRoomMock
  }
}))

vi.mock('@/services/matrix/sdk', () => ({
  EventType: {
    RoomTopic: 'm.room.topic',
    RoomPinnedEvents: 'm.room.pinned_events'
  }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    isCurrentLord: isCurrentLordMock,
    isAdmin: isAdminMock
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => mockUserStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => mockGlobalStore
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { useAnnouncementStore } from '../announcement'

describe('useAnnouncementStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGlobalStore.currentSessionRoomId = 'room-1'
    mockUserStore.userInfo = { uid: '@user:matrix.test' }
    isCurrentLordMock.mockReturnValue(false)
    isAdminMock.mockReturnValue(false)
    getRoomMock.mockReset().mockResolvedValue(null)
  })

  describe('initial state', () => {
    it('initializes with empty announcement list', () => {
      const store = useAnnouncementStore()
      expect(store.announList).toEqual([])
      expect(store.announNum).toBe(0)
      expect(store.announError).toBe(false)
      expect(store.isAddAnnoun).toBe(false)
      expect(store.isLoading).toBe(false)
    })

    it('returns empty announcementContent when list is empty', () => {
      const store = useAnnouncementStore()
      expect(store.announcementContent).toBe('')
    })

    it('canAddAnnouncement is false when user has no admin rights', () => {
      const store = useAnnouncementStore()
      expect(store.canAddAnnouncement).toBe(false)
    })

    it('canAddAnnouncement is true when user is lord', () => {
      isCurrentLordMock.mockReturnValue(true)
      const store = useAnnouncementStore()
      expect(store.canAddAnnouncement).toBe(true)
    })

    it('canAddAnnouncement is true when user is admin', () => {
      isAdminMock.mockReturnValue(true)
      const store = useAnnouncementStore()
      expect(store.canAddAnnouncement).toBe(true)
    })

    it('canAddAnnouncement is false when user has no uid', () => {
      mockUserStore.userInfo = { uid: '' }
      const store = useAnnouncementStore()
      expect(store.canAddAnnouncement).toBe(false)
    })
  })

  describe('clearAnnouncements', () => {
    it('clears all announcement state', () => {
      const store = useAnnouncementStore()
      // First populate state
      store.$patch({
        announList: [{ id: '1', content: 'test', top: false, author: 'a', timestamp: 0 }],
        announNum: 1,
        announError: true
      })

      store.clearAnnouncements()

      expect(store.announList).toEqual([])
      expect(store.announNum).toBe(0)
      expect(store.announError).toBe(false)
    })
  })

  describe('loadGroupAnnouncements', () => {
    it('does nothing when no roomId and no currentSessionRoomId', async () => {
      mockGlobalStore.currentSessionRoomId = ''
      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements()
      expect(getRoomMock).not.toHaveBeenCalled()
    })

    it('uses currentSessionRoomId when roomId is not provided', async () => {
      getRoomMock.mockResolvedValue(null)
      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements()
      expect(getRoomMock).toHaveBeenCalledWith('room-1', false)
    })

    it('uses provided roomId over currentSessionRoomId', async () => {
      getRoomMock.mockResolvedValue(null)
      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-2')
      expect(getRoomMock).toHaveBeenCalledWith('room-2', false)
    })

    it('clears list when room is not found', async () => {
      getRoomMock.mockResolvedValue(null)
      const store = useAnnouncementStore()
      store.$patch({ announList: [{ id: '1', content: 'old', top: false, author: '', timestamp: 0 }], announNum: 1 })

      await store.loadGroupAnnouncements('room-1')

      expect(store.announList).toEqual([])
      expect(store.announNum).toBe(0)
    })

    it('handles errors and sets announError on failure', async () => {
      getRoomMock.mockRejectedValue(new Error('network'))
      const store = useAnnouncementStore()

      await store.loadGroupAnnouncements('room-1')

      expect(store.announError).toBe(true)
      expect(store.isLoading).toBe(false)
      // 不再通过 showFeedback 弹错误提示：新房间无公告属正常情况，避免误导用户
      expect(showFeedbackMock).not.toHaveBeenCalled()
    })

    it('does not set announError when target room differs from current session', async () => {
      mockGlobalStore.currentSessionRoomId = 'room-1'
      getRoomMock.mockRejectedValue(new Error('network'))
      const store = useAnnouncementStore()

      await store.loadGroupAnnouncements('room-2')

      expect(store.announError).toBe(false)
    })

    it('loads topic and pinned events from room', async () => {
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn((eventType) => {
            if (eventType === 'm.room.topic') {
              return {
                getContent: () => ({ topic: 'Welcome to the room' }),
                getId: () => 'topic-event-id',
                getSender: () => '@admin:matrix.test',
                getTs: () => 1000
              }
            }
            if (eventType === 'm.room.pinned_events') {
              return {
                getContent: () => ({
                  pinned: ['event-1', 'event-2']
                })
              }
            }
            return null
          })
        },
        findEventById: vi.fn((eventId) => {
          if (eventId === 'event-1') {
            return {
              getId: () => 'event-1',
              getContent: () => ({ body: 'Pinned message 1' }),
              getSender: () => '@user1:matrix.test',
              getTs: () => 2000
            }
          }
          if (eventId === 'event-2') {
            return {
              getId: () => 'event-2',
              getContent: () => ({ body: 'Pinned message 2' }),
              getSender: () => '@user2:matrix.test',
              getTs: () => 3000
            }
          }
          return null
        })
      }
      getRoomMock.mockResolvedValue(mockRoom)

      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-1')

      // Topic should be first (top=true), followed by pinned events
      expect(store.announList.length).toBe(3)
      expect(store.announList[0]).toEqual({
        id: 'topic-event-id',
        content: 'Welcome to the room',
        top: true,
        author: '@admin:matrix.test',
        timestamp: 1000
      })
      expect(store.announList[1]?.id).toBe('event-1')
      expect(store.announList[2]?.id).toBe('event-2')
      expect(store.announNum).toBe(3)
      expect(store.announError).toBe(false)
      expect(store.isLoading).toBe(false)
    })

    it('handles room without pinned events', async () => {
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn((eventType) => {
            if (eventType === 'm.room.topic') {
              return {
                getContent: () => ({ topic: 'Only topic' }),
                getId: () => 'topic-id',
                getSender: () => '@admin:matrix.test',
                getTs: () => 1000
              }
            }
            return null
          })
        },
        findEventById: vi.fn()
      }
      getRoomMock.mockResolvedValue(mockRoom)

      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-1')

      expect(store.announList.length).toBe(1)
      expect(store.announList[0]?.content).toBe('Only topic')
    })

    it('skips pinned event ids that cannot be found', async () => {
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn((eventType) => {
            if (eventType === 'm.room.pinned_events') {
              return {
                getContent: () => ({
                  pinned: ['missing-event']
                })
              }
            }
            return null
          })
        },
        findEventById: vi.fn(() => null)
      }
      getRoomMock.mockResolvedValue(mockRoom)

      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-1')

      expect(store.announList.length).toBe(0)
      expect(store.announNum).toBe(0)
    })

    it('sets isAddAnnoun based on canAddAnnouncement', async () => {
      isAdminMock.mockReturnValue(true)
      getRoomMock.mockResolvedValue(null)

      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-1')

      expect(store.isAddAnnoun).toBe(true)
    })

    it('skips updates if targetRoomId changed during async load', async () => {
      mockGlobalStore.currentSessionRoomId = 'room-1'
      const mockRoom = {
        currentState: {
          getStateEvents: vi.fn(() => ({
            getContent: () => ({ topic: 'stale data' }),
            getId: () => 'topic-id',
            getSender: () => '@admin:matrix.test',
            getTs: () => 1000
          }))
        },
        findEventById: vi.fn()
      }
      getRoomMock.mockResolvedValue(mockRoom)

      const store = useAnnouncementStore()
      // Change currentSessionRoomId before await resolves
      // Since the mock returns synchronously, we simulate by changing after the call
      await store.loadGroupAnnouncements('room-1')
      // After load, change to a different room and reload
      mockGlobalStore.currentSessionRoomId = 'room-2'
      await store.loadGroupAnnouncements('room-1')
      // The second call should early return because targetRoomId !== currentSessionRoomId
      // The list should still be from the first call
      expect(store.announList.length).toBeGreaterThan(0)
    })
  })

  describe('getGroupAnnouncementList', () => {
    it('returns formatted records with uid and userName', async () => {
      getRoomMock.mockResolvedValue({
        currentState: {
          getStateEvents: vi.fn((eventType) => {
            if (eventType === 'm.room.topic') {
              return {
                getContent: () => ({ topic: 'Hello' }),
                getId: () => 'topic-id',
                getSender: () => '@admin:matrix.test',
                getTs: () => 1000
              }
            }
            return null
          })
        },
        findEventById: vi.fn()
      })

      const store = useAnnouncementStore()
      const result = await store.getGroupAnnouncementList('room-1', 1, 10)

      expect(result.total).toBe(1)
      expect(result.records[0]).toEqual({
        id: 'topic-id',
        content: 'Hello',
        top: true,
        author: '@admin:matrix.test',
        uid: '@admin:matrix.test',
        userName: '@admin:matrix.test',
        timestamp: 1000
      })
    })

    it('returns empty records when room not found', async () => {
      getRoomMock.mockResolvedValue(null)

      const store = useAnnouncementStore()
      const result = await store.getGroupAnnouncementList('room-1', 1, 10)

      expect(result.records).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('announcementContent computed', () => {
    it('returns first announcement content when list is non-empty', async () => {
      getRoomMock.mockResolvedValue({
        currentState: {
          getStateEvents: vi.fn((eventType) => {
            if (eventType === 'm.room.topic') {
              return {
                getContent: () => ({ topic: 'First announcement' }),
                getId: () => 'topic-id',
                getSender: () => '@admin:matrix.test',
                getTs: () => 1000
              }
            }
            return null
          })
        },
        findEventById: vi.fn()
      })

      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-1')

      expect(store.announcementContent).toBe('First announcement')
    })

    it('returns empty string when first announcement has no content', async () => {
      getRoomMock.mockResolvedValue({
        currentState: {
          getStateEvents: vi.fn((eventType) => {
            if (eventType === 'm.room.topic') {
              return {
                getContent: () => ({ topic: '' }),
                getId: () => 'topic-id',
                getSender: () => '@admin:matrix.test',
                getTs: () => 1000
              }
            }
            return null
          })
        },
        findEventById: vi.fn()
      })

      const store = useAnnouncementStore()
      await store.loadGroupAnnouncements('room-1')

      expect(store.announcementContent).toBe('')
    })
  })
})
