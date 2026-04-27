import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from '@/stores/domains/chat/room'
import matrixRoomService from '@/services/matrix/room/MatrixRoomService'
import matrixEventService from '@/services/matrix/MatrixEventService'
import matrixRoomSummaryService from '@/services/matrix/room/MatrixRoomSummaryService'
import { MsgEnum, MessageStatusEnum } from '@/enums'

const { mockRoomService, mockEventService, mockRoomSummaryService, mockMatrixClientService } = vi.hoisted(() => ({
  mockRoomService: {
    getRoomSummary: vi.fn(),
    getRooms: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
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
    onTimelineEvent: vi.fn(),
    onRoomNameChange: vi.fn(),
    onRoomAvatarChange: vi.fn(),
    onRoomMemberChange: vi.fn(),
    getAllRoomInfos: vi.fn(),
    joinRoomAndGetInfo: vi.fn()
  },
  mockEventService: {
    getRoomTimeline: vi.fn(),
    paginateTimeline: vi.fn(),
    sendTextMessage: vi.fn(),
    sendImageMessage: vi.fn(),
    sendVideoMessage: vi.fn(),
    sendAudioMessage: vi.fn(),
    sendFileMessage: vi.fn(),
    redactEvent: vi.fn(),
    sendMessageReceipt: vi.fn(),
    getRoomMessages: vi.fn(),
    getMoreRoomMessages: vi.fn(),
    convertEventToMessageType: vi.fn((event: any) => ({
      fromUser: {
        uid: event.getSender?.() ?? '',
        username: event.getSender?.() ?? '',
        avatar: '',
        locPlace: ''
      },
      message: {
        id: event.getId?.() ?? '',
        roomId: event.getRoomId?.() ?? '',
        type: MsgEnum.TEXT,
        body: { content: event.getContent?.()?.body ?? '' },
        sendTime: event.getTs?.() ?? 0,
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      },
      sendTime: event.getTs?.() ?? 0
    }))
  },
  mockRoomSummaryService: {
    getRoomListSnapshot: vi.fn(),
    getAllRoomListSnapshots: vi.fn()
  },
  mockMatrixClientService: {
    getClient: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/room/MatrixRoomService', () => ({
  default: mockRoomService
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: mockEventService
}))

vi.mock('@/services/matrix/room/MatrixRoomSummaryService', () => ({
  default: mockRoomSummaryService
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: mockMatrixClientService
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: vi.fn()
}))

function createMockEvent(
  overrides: Partial<{
    id: string
    roomId: string
    type: string
    sender: string
    content: Record<string, unknown>
    ts: number
  }> = {}
) {
  const event = {
    id: overrides.id ?? '$event',
    roomId: overrides.roomId ?? '!room:id',
    type: overrides.type ?? 'm.room.message',
    sender: overrides.sender ?? '@user:server',
    content: overrides.content ?? { body: 'hello', msgtype: 'm.text' },
    ts: overrides.ts ?? 1000
  }

  return {
    getId: vi.fn(() => event.id),
    getRoomId: vi.fn(() => event.roomId),
    getType: vi.fn(() => event.type),
    getSender: vi.fn(() => event.sender),
    getContent: vi.fn(() => event.content),
    getTs: vi.fn(() => event.ts)
  }
}

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
    events: ReturnType<typeof createMockEvent>[]
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
  const events = overrides.events ?? [createMockEvent()]
  const counts = overrides.counts ?? { all: 1, highlight: 0, notification: 1 }

  return {
    roomId: overrides.roomId ?? '!room:id',
    name: overrides.name ?? 'Test Room',
    getLiveTimeline: vi.fn(() => ({
      getEvents: vi.fn(() => events)
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

      vi.mocked(matrixRoomService.getRoomSummary).mockResolvedValueOnce({
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

      vi.mocked(matrixRoomService.getRoomSummary).mockResolvedValueOnce({
        roomId: '!room:id',
        topic: null,
        memberCount: 1,
        joinedCount: 1,
        canonicalAlias: null,
        avatarUrl: null,
        isPublic: false
      } as any)

      await store.loadRoomDetails(['!room:id', '!room:id'])

      expect(matrixRoomService.getRoomSummary).toHaveBeenCalledTimes(1)
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
      expect(store.messages.get('!room:id')).toHaveLength(1)
      expect(store.messages.get('!room:id')?.[0]?.message.type).toBe(MsgEnum.IMAGE)
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
      expect(store.messages.get('!room:id')?.[0]?.message.type).toBe(MsgEnum.SYSTEM)
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
      expect(store.messages.get('!room:id')?.[0]?.message.type).toBe(MsgEnum.VOICE)
    })
  })

  describe('loadRooms', () => {
    it('should load rooms and prefer sliding sync unread counts', async () => {
      mockRoomService.getAllRoomInfos.mockReturnValue([
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

      expect(mockRoomService.getAllRoomInfos).toHaveBeenCalled()
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
      vi.mocked(matrixRoomService.createRoom).mockResolvedValue(room as any)
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

      expect(matrixRoomService.createRoom).toHaveBeenCalledWith(
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
      mockRoomService.joinRoomAndGetInfo.mockResolvedValue({
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
      vi.mocked(matrixRoomService.leaveRoom).mockResolvedValue(undefined)

      const store = useRoomStore()
      await store.joinRoom('!join:room')
      store.messages.set('!join:room', [])
      store.hasMoreMessages.set('!join:room', true)
      store.setCurrentRoom('!join:room')

      await store.leaveRoom('!join:room')

      expect(store.rooms.has('!join:room')).toBe(false)
      expect(store.messages.has('!join:room')).toBe(false)
      expect(store.hasMoreMessages.has('!join:room')).toBe(false)
      expect(store.currentRoomId).toBeNull()
    })
  })

  describe('message loading and sending', () => {
    it('should load message timeline and filter unsupported events', async () => {
      mockEventService.getRoomMessages.mockResolvedValue([
        {
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
          message: {
            id: '$m1',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { content: 'hello' },
            sendTime: 100,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 100
        },
        {
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
          message: {
            id: '$m2',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { content: 'cipher' },
            sendTime: 200,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 200
        }
      ])

      const store = useRoomStore()
      const result = await store.loadMessages('!room:id', 2)

      expect(result).toHaveLength(2)
      expect(store.messages.get('!room:id')).toHaveLength(2)
      expect(store.hasMoreMessages.get('!room:id')).toBe(true)
    })

    it('should load more messages for current room', async () => {
      mockEventService.getMoreRoomMessages.mockResolvedValue({
        messages: [
          {
            fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
            message: {
              id: '$older',
              roomId: '!room:id',
              type: MsgEnum.TEXT,
              body: { content: 'older' },
              sendTime: 10,
              messageMarks: {},
              status: MessageStatusEnum.SUCCESS
            },
            sendTime: 10
          }
        ],
        hasMore: false
      })

      const store = useRoomStore()
      store.setCurrentRoom('!room:id')
      store.messages.set('!room:id', [
        {
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
          message: {
            id: '$existing',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { body: 'existing', content: 'existing', msgtype: 'm.text' },
            sendTime: 20,
            messageMarks: {},
            status: 1 as any
          },
          sendTime: 20,
          loading: false
        }
      ])

      const result = await store.loadMoreMessages(1)

      expect(result).toHaveLength(1)
      expect(store.messages.get('!room:id')?.map((item) => item.message.id)).toEqual(['$older', '$existing'])
      expect(store.isLoadingMore).toBe(false)
    })

    it('should route sendMessage by message type', async () => {
      vi.mocked(matrixEventService.sendTextMessage).mockResolvedValue('$text')
      vi.mocked(matrixEventService.sendImageMessage).mockResolvedValue('$image')
      vi.mocked(matrixEventService.sendAudioMessage).mockResolvedValue('$audio')

      const store = useRoomStore()

      await expect(store.sendMessage('!room:id', { type: 'text', text: 'hello' })).resolves.toBe('$text')
      await expect(
        store.sendMessage('!room:id', { type: 'image', file: new File(['x'], 'a.png', { type: 'image/png' }) })
      ).resolves.toBe('$image')
      await expect(
        store.sendMessage('!room:id', { type: 'audio', file: new File(['x'], 'a.mp3', { type: 'audio/mpeg' }) })
      ).resolves.toBe('$audio')
    })

    it('should validate required file payloads when sending media', async () => {
      const store = useRoomStore()

      await expect(store.sendMessage('!room:id', { type: 'image' })).rejects.toThrow('缺少图片文件')
      await expect(store.sendMessage('!room:id', { type: 'video' })).rejects.toThrow('缺少视频文件')
      await expect(store.sendMessage('!room:id', { type: 'audio' })).rejects.toThrow('缺少音频文件')
      await expect(store.sendMessage('!room:id', { type: 'file' })).rejects.toThrow('缺少文件')
    })

    it('should redact message and mark it as recall', async () => {
      vi.mocked(matrixEventService.redactEvent).mockResolvedValue(undefined)
      const store = useRoomStore()
      store.messages.set('!room:id', [
        {
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
          message: {
            id: '$event',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { body: 'hello', content: 'hello', msgtype: 'm.text' },
            sendTime: 1,
            messageMarks: {},
            status: 1 as any
          },
          sendTime: 1,
          loading: false
        }
      ])

      await store.redactMessage('!room:id', '$event', '撤回')

      expect(matrixEventService.redactEvent).toHaveBeenCalledWith('!room:id', '$event', '撤回')
      expect(store.messages.get('!room:id')?.[0]?.message.type).toBe(MsgEnum.RECALL)
    })

    it('should mark room as read after sending receipt', async () => {
      vi.mocked(matrixEventService.sendMessageReceipt).mockResolvedValue(undefined)
      const store = useRoomStore()
      store.rooms.set('!room:id', {
        roomId: '!room:id',
        name: 'Room',
        avatarUrl: null,
        isDirect: false,
        isEncrypted: false,
        unreadCount: 9,
        highlightCount: 4,
        notificationCount: 9,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      })

      await store.markAsRead('!room:id', '$event')

      expect(store.rooms.get('!room:id')).toMatchObject({
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0
      })
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

      vi.mocked(matrixRoomService.getRoomSummary).mockResolvedValue({
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

      expect(matrixRoomService.getRoomSummary).toHaveBeenCalledTimes(1)
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
      vi.mocked(matrixRoomService.getRoomSummary).mockResolvedValue({
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

      ;(mockRoomService.onTimelineEvent as any).mockImplementation((cb: (...args: any[]) => void) => {
        callbacks.timeline = cb
      })
      ;(mockRoomService.onRoomNameChange as any).mockImplementation((cb: (...args: any[]) => void) => {
        callbacks.name = cb
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
          fromUser: { uid: '@user:server', username: '@user:server', avatar: '', locPlace: '' },
          message: {
            id: '$new',
            roomId: '!room:id',
            type: MsgEnum.TEXT,
            body: { content: 'hello' },
            sendTime: 2000,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 2000
        }
      })

      callbacks.name?.('!room:id', 'After')

      expect(store.messages.get('!room:id')).toHaveLength(1)
      expect(store.rooms.get('!room:id')).toMatchObject({
        name: 'After'
      })
    })
  })
})
