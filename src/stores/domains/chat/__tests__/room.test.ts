import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import matrixRoomSummaryService from '@/services/matrix/room/MatrixRoomSummaryService'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
import { useRoomStore } from '@/stores/domains/chat/room'

const {
  mockReadFacade,
  mockActionFacade,
  mockCreationService,
  mockRealtimeService,
  mockRoomSummaryService,
  mockMatrixClientService,
  mockChatStore
} = vi.hoisted(() => ({
  mockReadFacade: {
    getRoomSummary: vi.fn()
  },
  mockActionFacade: {
    createRoom: vi.fn(),
    leaveRoom: vi.fn()
  },
  mockCreationService: {
    convertRoomToRoomInfo: vi.fn((room: any) => {
      const timeline = room.getLiveTimeline?.()?.getEvents?.() ?? []
      const lastEvent = timeline[timeline.length - 1]
      let lastMessage: string | null = null
      let lastMessageTime: number | null = null
      if (lastEvent) {
        lastMessageTime = lastEvent.getTs?.() ?? null
        const content = lastEvent.getContent?.() ?? {}
        if (content.msgtype === 'm.text' || content.msgtype === 'm.notice') lastMessage = content.body
        else if (content.msgtype === 'm.image') lastMessage = '[图片]'
        else if (content.msgtype === 'm.video') lastMessage = '[视频]'
        else if (content.msgtype === 'm.audio') lastMessage = '[音频]'
        else if (content.msgtype === 'm.file') lastMessage = '[文件]'
        else if (lastEvent.getType?.() === 'm.room.member')
          lastMessage = content.membership === 'join' ? '加入了房间' : '离开了房间'
      }
      const client = mockMatrixClientService.getClient()
      const isEncrypted = client?.isRoomEncrypted?.(room.roomId) ?? false
      return {
        roomId: room.roomId ?? '!room:id',
        name: room.name ?? 'Test Room',
        avatarUrl: room.getMxcAvatarUrl?.() ?? null,
        isDirect: (room.getJoinedMembers?.()?.length ?? 0) <= 2,
        isEncrypted,
        unreadCount: room.getUnreadNotificationCount?.() ?? 0,
        highlightCount: room.getUnreadNotificationCount?.('highlight') ?? 0,
        notificationCount: room.getUnreadNotificationCount?.('notification') ?? 0,
        lastMessage,
        lastMessageTime,
        members: (room.getJoinedMembers?.() ?? []).map((m: any) => ({
          userId: m.userId,
          name: m.name || m.userId,
          avatarUrl: m.getMxcAvatarUrl?.() ?? undefined,
          powerLevel: m.powerLevel
        }))
      }
    }),
    joinRoomAndGetInfo: vi.fn()
  },
  mockRealtimeService: {
    getAllRoomInfos: vi.fn(),
    onTimelineEvent: vi.fn(),
    onRoomNameChange: vi.fn(),
    onRoomAvatarChange: vi.fn(),
    onRoomMemberChange: vi.fn()
  },
  mockRoomSummaryService: {
    getRoomListSnapshot: vi.fn(),
    getAllRoomListSnapshots: vi.fn()
  },
  mockMatrixClientService: {
    getClient: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  mockChatStore: {
    pushMsg: vi.fn(),
    updateMsg: vi.fn(),
    checkMsgExist: vi.fn(),
    clearRoomMessages: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/room/ReadFacade', () => ({
  matrixRoomReadFacade: mockReadFacade
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: mockActionFacade
}))

vi.mock('@/services/matrix/room/CreationService', () => ({
  matrixRoomCreationService: mockCreationService
}))

vi.mock('@/services/matrix/room/RealtimeService', () => ({
  matrixRoomRealtimeService: mockRealtimeService
}))

vi.mock('@/services/matrix/room/MatrixRoomSummaryService', () => ({
  default: mockRoomSummaryService
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: mockMatrixClientService
}))

vi.mock('@/services/matrix/room/TagsService', () => ({
  matrixRoomTagsService: {
    getTags: vi.fn(),
    setTag: vi.fn(),
    removeTag: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: vi.fn()
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => mockChatStore
}))

function createMockRoom(
  overrides: Partial<{
    roomId: string
    name: string
    avatarUrl: string | null
    members: Array<{
      userId: string
      name?: string
      powerLevel?: number
      getMxcAvatarUrl?: () => string | undefined
    }>
    counts: { all: number; highlight: number; notification: number }
    isSpace: boolean
    dmInviter?: string
  }> = {}
) {
  const members = overrides.members ?? [
    {
      userId: '@user:server',
      name: 'User',
      powerLevel: 50,
      getMxcAvatarUrl: () => 'mxc://avatar/user'
    }
  ]
  const counts = overrides.counts ?? { all: 1, highlight: 0, notification: 1 }

  return {
    roomId: overrides.roomId ?? '!room:id',
    name: overrides.name ?? 'Test Room',
    getLiveTimeline: vi.fn(() => ({
      getEvents: vi.fn(() => [])
    })),
    getMxcAvatarUrl: vi.fn(() => overrides.avatarUrl ?? 'mxc://room/avatar'),
    getJoinedMembers: vi.fn(() => members),
    getUnreadNotificationCount: vi.fn((kind?: string) => {
      if (kind === 'highlight') return counts.highlight
      if (kind === 'notification') return counts.notification
      return counts.all
    }),
    isSpaceRoom: vi.fn(() => overrides.isSpace ?? false),
    getDMInviter: vi.fn(() => overrides.dmInviter),
    getRoomId: vi.fn(() => overrides.roomId ?? '!room:id')
  }
}

describe('RoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockMatrixClientService.getClient.mockReturnValue(null)
    mockRoomSummaryService.getRoomListSnapshot.mockReturnValue(null)
    mockRoomSummaryService.getAllRoomListSnapshots.mockReturnValue([])
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

  describe('loadRoomDetails', () => {
    it('should hydrate room detail back to room info when batch loading', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      vi.mocked(matrixRoomReadFacade.getRoomSummary).mockResolvedValueOnce({
        roomId: '!room:id',
        topic: 'Topic',
        memberCount: 3,
        joinedCount: 2,
        canonicalAlias: '#room:example.com',
        avatarUrl: 'mxc://avatar',
        isPublic: true
      } as any)

      await store.loadRoomDetails(['!room:id'])

      expect(store.rooms.get('!room:id')?.detail).toEqual({
        roomId: '!room:id',
        topic: 'Topic',
        memberCount: 3,
        joinedCount: 2,
        ownerId: null,
        joinRule: null,
        canonicalAlias: '#room:example.com',
        avatarUrl: 'mxc://avatar',
        createdTs: null,
        isPublic: true
      })
    })

    it('should de-duplicate duplicated room ids in batch loading', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      vi.mocked(matrixRoomReadFacade.getRoomSummary).mockResolvedValueOnce({
        roomId: '!room:id',
        topic: null,
        memberCount: 1,
        joinedCount: 1,
        canonicalAlias: null,
        avatarUrl: null,
        isPublic: false
      } as any)

      await store.loadRoomDetails(['!room:id', '!room:id'])

      expect(matrixRoomReadFacade.getRoomSummary).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleIncrementalUpdate', () => {
    it('should sync room summary fields into room info and detail', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Old Name',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: [],
        detail: {
          roomId: '!room:id',
          topic: null,
          memberCount: 3,
          joinedCount: 1,
          ownerId: null,
          joinRule: null,
          canonicalAlias: null,
          avatarUrl: null,
          createdTs: null,
          isPublic: true
        }
      })

      await store.handleIncrementalUpdate('!room:id', {
        notification_count: 5,
        highlight_count: 2,
        summary: {
          name: 'New Name',
          avatar_url: 'mxc://avatar',
          joined_member_count: 8
        }
      })

      expect(store.rooms.get('!room:id')).toMatchObject({
        name: 'New Name',
        avatarUrl: 'mxc://avatar',
        unreadCount: 5,
        highlightCount: 2,
        notificationCount: 5,
        detail: {
          joinedCount: 8
        }
      })
    })

    it('should use the same preview mapping for sliding sync timeline events', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      await store.handleIncrementalUpdate('!room:id', {
        timeline: [
          {
            event_id: '$1',
            type: 'm.room.message',
            sender: '@u:server',
            content: {
              msgtype: 'm.image',
              body: 'photo.jpg'
            },
            origin_server_ts: 123
          }
        ]
      })

      expect(store.rooms.get('!room:id')).toMatchObject({
        lastMessage: '[图片]',
        lastMessageTime: 123
      })
      expect(mockChatStore.pushMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ type: MsgEnum.IMAGE })
        })
      )
    })

    it('should render member events with room preview text', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      await store.handleIncrementalUpdate('!room:id', {
        timeline: [
          {
            event_id: '$2',
            type: 'm.room.member',
            sender: '@u:server',
            content: {
              membership: 'join'
            },
            origin_server_ts: 456
          }
        ]
      })

      expect(store.rooms.get('!room:id')).toMatchObject({
        lastMessage: '加入了房间',
        lastMessageTime: 456
      })
      expect(mockChatStore.pushMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ type: MsgEnum.SYSTEM })
        })
      )
    })

    it('should map voice events to voice messages and audio preview text', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      await store.handleIncrementalUpdate('!room:id', {
        timeline: [
          {
            event_id: '$3',
            type: 'm.room.message',
            sender: '@u:server',
            content: {
              msgtype: 'm.voice',
              body: 'voice.ogg'
            },
            origin_server_ts: 789
          }
        ]
      })

      expect(store.rooms.get('!room:id')).toMatchObject({
        lastMessage: '[音频]',
        lastMessageTime: 789
      })
      expect(mockChatStore.pushMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ type: MsgEnum.VOICE })
        })
      )
    })
  })

  describe('loadRooms', () => {
    it('should load rooms and prefer sliding sync unread counts', async () => {
      mockRealtimeService.getAllRoomInfos.mockReturnValue([
        {
          roomId: '!room:1',
          name: 'Alpha',
          avatarUrl: 'mxc://room/avatar',
          isDirect: false,
          isEncrypted: true,
          unreadCount: 7,
          highlightCount: 3,
          notificationCount: 7,
          lastMessage: null,
          lastMessageTime: null,
          members: []
        }
      ])
      mockMatrixClientService.getClient.mockReturnValue({} as any)

      const store = useRoomStore()
      await store.loadRooms()

      expect(mockRealtimeService.getAllRoomInfos).toHaveBeenCalled()
      expect(store.rooms.get('!room:1')).toMatchObject({
        roomId: '!room:1',
        name: 'Alpha',
        isEncrypted: true,
        unreadCount: 7,
        highlightCount: 3,
        notificationCount: 7
      })
      expect(store.isLoading).toBe(false)
    })

    it('should throw when client is not initialized', async () => {
      const store = useRoomStore()

      await expect(store.loadRooms()).rejects.toThrow('客户端未初始化')
    })
  })

  describe('room actions', () => {
    it('should create room and store room info', async () => {
      const room = createMockRoom({ roomId: '!new:room', name: 'New Room' })
      vi.mocked(matrixRoomActionFacade.createRoom).mockResolvedValue(room as any)
      vi.mocked(matrixRoomSummaryService.getRoomListSnapshot).mockReturnValue({
        roomId: '!new:room',
        name: 'New Room',
        avatarUrl: 'mxc://room/avatar',
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: 'hello',
        lastMessageTime: 1000,
        members: []
      } as any)

      const store = useRoomStore()
      const result = await store.createRoom({ name: 'New Room', isEncrypted: true })

      expect(matrixRoomActionFacade.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Room',
          initial_state: [
            {
              type: 'm.room.encryption',
              state_key: '',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      )
      expect(result.roomId).toBe('!new:room')
      expect(store.rooms.get('!new:room')?.name).toBe('New Room')
    })

    it('should join and leave room', async () => {
      mockCreationService.joinRoomAndGetInfo.mockResolvedValue({
        roomId: '!join:room',
        name: 'Join Room',
        avatarUrl: 'mxc://room/avatar',
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: 'hello',
        lastMessageTime: 1000,
        members: []
      })
      vi.mocked(matrixRoomActionFacade.leaveRoom).mockResolvedValue(undefined)

      const store = useRoomStore()
      await store.joinRoom('!join:room')
      store.setCurrentRoom('!join:room')

      await store.leaveRoom('!join:room')

      expect(store.rooms.has('!join:room')).toBe(false)
      expect(mockChatStore.clearRoomMessages).toHaveBeenCalledWith('!join:room')
      expect(store.currentRoomId).toBeNull()
    })
  })

  describe('cache and listeners', () => {
    it('should cache room detail requests', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      vi.mocked(matrixRoomReadFacade.getRoomSummary).mockResolvedValue({
        roomId: '!room:id',
        topic: 'Topic',
        memberCount: 2,
        joinedCount: 2,
        canonicalAlias: null,
        avatarUrl: null,
        isPublic: false
      } as any)

      const first = store.loadRoomDetail('!room:id')
      const second = store.loadRoomDetail('!room:id')
      const [detail1, detail2] = await Promise.all([first, second])

      expect(matrixRoomReadFacade.getRoomSummary).toHaveBeenCalledTimes(1)
      expect(detail1).toEqual(detail2)
      expect(store.getCacheStats().size).toBe(1)
    })

    it('should clear cache and expose stats', async () => {
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })
      vi.mocked(matrixRoomReadFacade.getRoomSummary).mockResolvedValue({
        roomId: '!room:id',
        topic: null,
        memberCount: 1,
        joinedCount: 1,
        canonicalAlias: null,
        avatarUrl: null,
        isPublic: false
      } as any)

      await store.loadRoomDetail('!room:id')
      expect(store.getCacheStats()).toEqual({ size: 1, keys: ['!room:id'] })

      store.clearRoomDetailCache('!room:id')
      expect(store.getCacheStats()).toEqual({ size: 0, keys: [] })
    })

    it('should react to room event listeners', () => {
      const callbacks: Record<string, (...args: any[]) => void> = {}
      const matrixClientCallbacks: Record<string, (...args: any[]) => void> = {}

      ;(mockRealtimeService.onTimelineEvent as any).mockImplementation((cb: (...args: any[]) => void) => {
        callbacks.timeline = cb
      })
      ;(mockRealtimeService.onRoomNameChange as any).mockImplementation((cb: (...args: any[]) => void) => {
        callbacks.name = cb
      })
      ;(mockMatrixClientService.on as any).mockImplementation((event: string, cb: (...args: any[]) => void) => {
        matrixClientCallbacks[event] = cb
      })

      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Before',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      store.setupEventListeners()

      callbacks.timeline?.({
        roomId: '!room:id',
        eventType: 'm.room.message',
        roomInfo: {
          roomId: '!room:id',
          name: 'Before',
          avatarUrl: null,
          isDirect: false,
          isEncrypted: false,
          unreadCount: 0,
          highlightCount: 0,
          notificationCount: 0,
          lastMessage: 'hello',
          lastMessageTime: 2000,
          members: []
        },
        message: {
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '' },
          message: {
            id: '$new',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { content: 'hello' },
            sendTime: 2000,
            messageMarks: {},
            status: 1
          },
          sendTime: 2000
        }
      })

      callbacks.name?.('!room:id', 'After')

      expect(mockChatStore.pushMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ id: '$new' })
        })
      )
      expect(store.rooms.get('!room:id')).toMatchObject({
        name: 'After'
      })

      mockChatStore.checkMsgExist.mockReturnValue(true)
      mockCreationService.convertRoomToRoomInfo.mockReturnValueOnce({
        roomId: '!room:id',
        name: 'After',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: true,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: 'decrypted hello',
        lastMessageTime: 3000,
        members: []
      })

      matrixClientCallbacks['eventDecrypted']?.({
        event: {
          getId: () => '$new',
          getRoomId: () => '!room:id',
          getSender: () => '@user:server',
          getTs: () => 3000,
          getType: () => 'm.room.encrypted',
          getContent: () => ({ body: 'decrypted hello' })
        },
        room: {
          roomId: '!room:id',
          getMember: () => null
        }
      })

      expect(mockChatStore.updateMsg).toHaveBeenCalledWith({
        msgId: '$new',
        roomId: '!room:id',
        status: 'success',
        body: expect.objectContaining({ body: 'decrypted hello' })
      })
    })

    it('should update existing encrypted placeholder when the same event arrives as decrypted room message', () => {
      const callbacks: Record<string, (...args: any[]) => void> = {}

      ;(mockRealtimeService.onTimelineEvent as any).mockImplementation((cb: (...args: any[]) => void) => {
        callbacks.timeline = cb
      })

      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Before',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: true,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      store.setupEventListeners()
      mockChatStore.checkMsgExist.mockReturnValue(true)

      callbacks.timeline?.({
        roomId: '!room:id',
        eventType: 'm.room.message',
        roomInfo: {
          roomId: '!room:id',
          name: 'Before',
          avatarUrl: null,
          isDirect: false,
          isEncrypted: true,
          unreadCount: 0,
          highlightCount: 0,
          notificationCount: 0,
          lastMessage: 'hello decrypted',
          lastMessageTime: 2000,
          members: []
        },
        message: {
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '' },
          message: {
            id: '$same',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { body: 'hello decrypted' },
            sendTime: 2000,
            messageMarks: {},
            status: 'success'
          },
          sendTime: 2000
        }
      })

      expect(mockChatStore.updateMsg).toHaveBeenCalledWith({
        msgId: '$same',
        roomId: '!room:id',
        status: 'success',
        body: { body: 'hello decrypted' }
      })
      expect(mockChatStore.pushMsg).not.toHaveBeenCalled()
    })
  })

  describe('tagsByRoom slice', () => {
    let tagsServiceMock: typeof import('@/services/matrix/room/TagsService').matrixRoomTagsService

    beforeEach(async () => {
      tagsServiceMock = (await import('@/services/matrix/room/TagsService')).matrixRoomTagsService
      vi.mocked(tagsServiceMock.getTags).mockReset()
      vi.mocked(tagsServiceMock.setTag).mockReset()
      vi.mocked(tagsServiceMock.removeTag).mockReset()
    })

    it('starts with empty tagsByRoom map', () => {
      const store = useRoomStore()
      expect(store.tagsByRoom).toEqual({})
      expect(store.getTagsForRoom('!a:s')).toEqual({})
      expect(store.hasTag('!a:s', 'm.favourite')).toBe(false)
    })

    it('refreshRoomTags pulls and stores tags', async () => {
      vi.mocked(tagsServiceMock.getTags).mockResolvedValueOnce({ 'm.favourite': { order: 0 } })
      const store = useRoomStore()

      const tags = await store.refreshRoomTags('!r:s')

      expect(tags).toEqual({ 'm.favourite': { order: 0 } })
      expect(store.hasTag('!r:s', 'm.favourite')).toBe(true)
    })

    it('addRoomTag updates optimistically and persists', async () => {
      vi.mocked(tagsServiceMock.setTag).mockResolvedValueOnce(undefined)
      const store = useRoomStore()

      await store.addRoomTag('!r:s', 'm.favourite', 0)

      expect(store.getTagsForRoom('!r:s')).toEqual({ 'm.favourite': { order: 0 } })
      expect(tagsServiceMock.setTag).toHaveBeenCalledWith('!r:s', 'm.favourite', 0)
    })

    it('addRoomTag rolls back on failure', async () => {
      vi.mocked(tagsServiceMock.setTag).mockRejectedValueOnce(new Error('boom'))
      const store = useRoomStore()

      await expect(store.addRoomTag('!r:s', 'm.favourite')).rejects.toThrow('boom')
      expect(store.hasTag('!r:s', 'm.favourite')).toBe(false)
    })

    it('removeRoomTag deletes only the requested tag', async () => {
      vi.mocked(tagsServiceMock.setTag).mockResolvedValue(undefined)
      vi.mocked(tagsServiceMock.removeTag).mockResolvedValueOnce(undefined)
      const store = useRoomStore()

      await store.addRoomTag('!r:s', 'm.favourite')
      await store.addRoomTag('!r:s', 'm.lowpriority')
      await store.removeRoomTag('!r:s', 'm.favourite')

      expect(store.hasTag('!r:s', 'm.favourite')).toBe(false)
      expect(store.hasTag('!r:s', 'm.lowpriority')).toBe(true)
    })

    it('removeRoomTag rolls back on failure', async () => {
      vi.mocked(tagsServiceMock.setTag).mockResolvedValueOnce(undefined)
      vi.mocked(tagsServiceMock.removeTag).mockRejectedValueOnce(new Error('boom'))
      const store = useRoomStore()
      await store.addRoomTag('!r:s', 'm.favourite')

      await expect(store.removeRoomTag('!r:s', 'm.favourite')).rejects.toThrow('boom')
      expect(store.hasTag('!r:s', 'm.favourite')).toBe(true)
    })
  })
})
