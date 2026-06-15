import { type MatrixClient, NotificationCountType, type Room, type RoomMember } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixRoomSummaryService, type RoomSummary } from '../MatrixRoomSummaryService'

vi.mock('../../MatrixClientService', () => {
  const mockService = {
    getClient: vi.fn()
  }
  return {
    default: mockService,
    matrixClientService: mockService
  }
})

vi.mock('../MatrixRoomStoreAdapter', () => {
  type SlidingSyncCounts = {
    notificationCount?: number
    highlightCount?: number
  }

  type SnapshotLike = {
    unreadCount: number
    highlightCount: number
    notificationCount: number
  }

  const adapter = {
    convertRoomToRoomInfo: vi.fn((room: Room, isEncrypted: boolean) => {
      const timeline = room.getLiveTimeline().getEvents()
      const lastEvent = timeline[timeline.length - 1]

      let lastMessage: string | null = null
      let lastMessageTime: number | null = null

      if (lastEvent) {
        lastMessageTime = lastEvent.getTs()
        const content = lastEvent.getContent()
        const eventType = lastEvent.getType()
        if (content.msgtype === 'm.text' && typeof content.body === 'string') lastMessage = content.body
        else if (eventType === 'm.room.member')
          lastMessage = content.membership === 'join' ? '加入了房间' : '离开了房间'
      }

      return {
        roomId: room.roomId,
        name: room.name || room.roomId,
        avatarUrl: typeof room.getMxcAvatarUrl === 'function' ? room.getMxcAvatarUrl() : null,
        isDirect: !room.isSpaceRoom() && room.getJoinedMembers().length <= 2,
        isEncrypted,
        unreadCount: room.getUnreadNotificationCount?.(NotificationCountType.Total) || 0,
        highlightCount: room.getUnreadNotificationCount?.(NotificationCountType.Highlight) || 0,
        notificationCount: room.getUnreadNotificationCount?.(NotificationCountType.Total) || 0,
        lastMessage,
        lastMessageTime,
        members: room.getJoinedMembers().map((m: RoomMember) => ({
          userId: m.userId,
          name: m.name || m.userId,
          avatarUrl: typeof m.getMxcAvatarUrl === 'function' ? (m.getMxcAvatarUrl() ?? undefined) : undefined,
          powerLevel: m.powerLevel
        }))
      }
    }),
    applySlidingSyncUnreadCounts: vi.fn((snapshot: SnapshotLike, counts?: SlidingSyncCounts) => {
      if (!counts) return snapshot
      if (counts.notificationCount !== undefined) {
        snapshot.unreadCount = counts.notificationCount
        snapshot.notificationCount = counts.notificationCount
      }
      if (counts.highlightCount !== undefined) {
        snapshot.highlightCount = counts.highlightCount
      }
      return snapshot
    })
  }
  return { matrixRoomStoreAdapter: adapter, default: adapter }
})

type MatrixRoomSummaryServiceInstance = {
  getRoomSummary: (roomId: string) => Promise<RoomSummary | null>
}

type MatrixRoomSummaryServiceConstructor = new () => MatrixRoomSummaryServiceInstance

describe('MatrixRoomSummaryService', () => {
  let mockClient: Partial<MatrixClient>
  let mockRoom: Room

  beforeEach(() => {
    const mockTimeline = {
      getEvents: vi.fn(() => [])
    } as unknown as ReturnType<Room['getLiveTimeline']>

    const mockCurrentState = {
      getStateEvents: vi.fn((_: string, stateKey?: string) => (typeof stateKey === 'string' ? null : []))
    } as unknown as Room['currentState']

    mockRoom = {
      roomId: '!room123:example.com',
      name: 'Test Room',
      getMxcAvatarUrl: vi.fn(() => 'mxc://example.com/avatar'),
      getMembers: vi.fn(() => []),
      getJoinedMembers: vi.fn(() => []),
      isSpaceRoom: vi.fn(() => false),
      getLiveTimeline: vi.fn(() => mockTimeline),
      getUnreadNotificationCount: vi.fn(() => 5) as unknown as Room['getUnreadNotificationCount'],
      currentState: mockCurrentState
    } as unknown as Room

    mockClient = {
      getRoom: vi.fn(() => mockRoom),
      getRooms: vi.fn(() => [mockRoom]),
      isRoomEncrypted: vi.fn(() => false)
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    matrixRoomSummaryService.initialize(mockClient as MatrixClient)
  })

  describe('getRoomSummary', () => {
    it('应该在未调用 initialize 时回退到 matrixClientService', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)

      const service = new (matrixRoomSummaryService.constructor as MatrixRoomSummaryServiceConstructor)()
      const summary = await service.getRoomSummary('!room123:example.com')

      expect(matrixClientService.getClient).toHaveBeenCalled()
      expect(summary?.roomId).toBe('!room123:example.com')
    })

    it('应该返回房间摘要', async () => {
      const summary = await matrixRoomSummaryService.getRoomSummary('!room123:example.com')

      expect(summary).not.toBeNull()
      expect(summary?.roomId).toBe('!room123:example.com')
      expect(summary?.name).toBe('Test Room')
      expect(summary?.avatarUrl).toBe('mxc://example.com/avatar')
      expect(summary?.isSpace).toBe(false)
      expect(summary?.unreadCount).toBe(5)
    })

    it('应该在房间不存在时返回 null', async () => {
      mockClient.getRoom = vi.fn(() => null)

      const summary = await matrixRoomSummaryService.getRoomSummary('!nonexistent:example.com')

      expect(summary).toBeNull()
    })

    it('应该处理错误并返回 null', async () => {
      mockClient.getRoom = vi.fn(() => {
        throw new Error('Failed to get room')
      })

      const summary = await matrixRoomSummaryService.getRoomSummary('!room123:example.com')

      expect(summary).toBeNull()
    })
  })

  describe('getRoomSummaries', () => {
    it('应该返回多个房间摘要', async () => {
      const roomIds = ['!room1:example.com', '!room2:example.com']

      const summaries = await matrixRoomSummaryService.getRoomSummaries(roomIds)

      expect(summaries).toHaveLength(2)
      expect(summaries[0].roomId).toBe('!room123:example.com')
    })

    it('应该跳过不存在的房间', async () => {
      mockClient.getRoom = vi.fn((roomId) => {
        if (roomId === '!room1:example.com') return mockRoom
        return null
      })

      const summaries = await matrixRoomSummaryService.getRoomSummaries([
        '!room1:example.com',
        '!nonexistent:example.com'
      ])

      expect(summaries).toHaveLength(1)
    })
  })

  describe('getAllRoomSummaries', () => {
    it('应该返回所有房间摘要', async () => {
      const summaries = await matrixRoomSummaryService.getAllRoomSummaries()

      expect(summaries).toHaveLength(1)
      expect(summaries[0].roomId).toBe('!room123:example.com')
    })

    it('应该处理错误并返回空数组', async () => {
      mockClient.getRooms = vi.fn(() => {
        throw new Error('Failed')
      })

      const summaries = await matrixRoomSummaryService.getAllRoomSummaries()

      expect(summaries).toEqual([])
    })
  })

  describe('getRoomListSnapshot', () => {
    it('应该返回房间列表快照并优先使用 sliding sync 未读数', () => {
      const mockEvent = {
        getType: vi.fn(() => 'm.room.message'),
        getContent: vi.fn(() => ({ body: 'latest', msgtype: 'm.text' })),
        getTs: vi.fn(() => 123456)
      }

      mockRoom.getLiveTimeline = vi.fn(
        () =>
          ({
            getEvents: vi.fn(() => [mockEvent])
          }) as unknown as ReturnType<Room['getLiveTimeline']>
      )
      mockRoom.getJoinedMembers = vi.fn(
        () =>
          [
            {
              userId: '@user:example.com',
              name: 'Test User',
              powerLevel: 50,
              getMxcAvatarUrl: vi.fn(() => 'mxc://example.com/member')
            }
          ] as unknown as ReturnType<Room['getJoinedMembers']>
      )
      mockRoom.getUnreadNotificationCount = vi.fn((kind?: string) => {
        if (kind === 'highlight') return 2
        return 9
      }) as unknown as Room['getUnreadNotificationCount']
      vi.mocked(mockClient.isRoomEncrypted!).mockReturnValue(true)

      const snapshot = matrixRoomSummaryService.getRoomListSnapshot('!room123:example.com')

      expect(snapshot).toEqual({
        roomId: '!room123:example.com',
        name: 'Test Room',
        avatarUrl: 'mxc://example.com/avatar',
        isDirect: true,
        isEncrypted: true,
        unreadCount: 9,
        highlightCount: 2,
        notificationCount: 9,
        lastMessage: 'latest',
        lastMessageTime: 123456,
        members: [
          {
            userId: '@user:example.com',
            name: 'Test User',
            avatarUrl: 'mxc://example.com/member',
            powerLevel: 50
          }
        ]
      })
    })

    it('应该在没有 sliding sync 时保留本地未读数并正确处理 space 房间', () => {
      const memberEvent = {
        getType: vi.fn(() => 'm.room.member'),
        getContent: vi.fn(() => ({ membership: 'join' })),
        getTs: vi.fn(() => 999)
      }

      mockRoom.getLiveTimeline = vi.fn(
        () =>
          ({
            getEvents: vi.fn(() => [memberEvent])
          }) as unknown as ReturnType<Room['getLiveTimeline']>
      )
      mockRoom.isSpaceRoom = vi.fn(() => true)
      mockRoom.getJoinedMembers = vi.fn(
        () =>
          [
            {
              userId: '@user:example.com',
              name: '',
              powerLevel: 0,
              getMxcAvatarUrl: vi.fn(() => undefined)
            }
          ] as unknown as ReturnType<Room['getJoinedMembers']>
      )
      mockRoom.getUnreadNotificationCount = vi.fn((kind?: string) => {
        if (kind === 'highlight') return 4
        if (kind === 'notification') return 7
        return 6
      }) as unknown as Room['getUnreadNotificationCount']

      const snapshot = matrixRoomSummaryService.getRoomListSnapshot('!room123:example.com')

      expect(snapshot).toEqual({
        roomId: '!room123:example.com',
        name: 'Test Room',
        avatarUrl: 'mxc://example.com/avatar',
        isDirect: false,
        isEncrypted: false,
        unreadCount: 6,
        highlightCount: 4,
        notificationCount: 6,
        lastMessage: '加入了房间',
        lastMessageTime: 999,
        members: [
          {
            userId: '@user:example.com',
            name: '@user:example.com',
            avatarUrl: undefined,
            powerLevel: 0
          }
        ]
      })
    })

    it('应该在房间不存在时返回 null', () => {
      mockClient.getRoom = vi.fn(() => null)

      expect(matrixRoomSummaryService.getRoomListSnapshot('!missing:example.com')).toBeNull()
    })
  })

  describe('getAllRoomListSnapshots', () => {
    it('应该返回全部房间列表快照', () => {
      const snapshots = matrixRoomSummaryService.getAllRoomListSnapshots()

      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].roomId).toBe('!room123:example.com')
    })

    it('应该处理错误并返回空数组', () => {
      mockClient.getRooms = vi.fn(() => {
        throw new Error('Failed list snapshots')
      })

      expect(matrixRoomSummaryService.getAllRoomListSnapshots()).toEqual([])
    })
  })

  describe('getRoomStats', () => {
    it('应该返回房间统计信息', async () => {
      const mockEvent = {
        getSender: vi.fn(() => '@user:example.com'),
        getTs: vi.fn(() => Date.now())
      }

      const mockTimeline = {
        getEvents: vi.fn(() => [mockEvent, mockEvent])
      }

      mockRoom.getLiveTimeline = vi.fn(() => mockTimeline as unknown as ReturnType<Room['getLiveTimeline']>)
      mockRoom.getJoinedMembers = vi.fn(() => [{}, {}] as unknown as ReturnType<Room['getJoinedMembers']>)
      mockRoom.currentState = {
        getStateEvents: vi.fn(() => ({
          getTs: vi.fn(() => Date.now() - 86400000)
        }))
      } as unknown as Room['currentState']

      const stats = await matrixRoomSummaryService.getRoomStats('!room123:example.com')

      expect(stats).not.toBeNull()
      expect(stats?.roomId).toBe('!room123:example.com')
      expect(stats?.totalMessages).toBe(2)
      expect(stats?.totalMembers).toBe(2)
    })

    it('应该在房间不存在时返回 null', async () => {
      mockClient.getRoom = vi.fn(() => null)

      const stats = await matrixRoomSummaryService.getRoomStats('!nonexistent:example.com')

      expect(stats).toBeNull()
    })
  })

  describe('getRoomMembers', () => {
    it('应该返回房间成员摘要', async () => {
      const mockMember: Partial<RoomMember> = {
        userId: '@user:example.com',
        name: 'Test User',
        membership: 'join',
        getMxcAvatarUrl: vi.fn(() => 'mxc://example.com/avatar')
      }

      mockRoom.getMembers = vi.fn(() => [mockMember as RoomMember])

      const members = await matrixRoomSummaryService.getRoomMembers('!room123:example.com')

      expect(members).toHaveLength(1)
      expect(members[0].userId).toBe('@user:example.com')
      expect(members[0].displayName).toBe('Test User')
      expect(members[0].membership).toBe('join')
    })

    it('应该在房间不存在时返回空数组', async () => {
      mockClient.getRoom = vi.fn(() => null)

      const members = await matrixRoomSummaryService.getRoomMembers('!nonexistent:example.com')

      expect(members).toEqual([])
    })
  })
})
