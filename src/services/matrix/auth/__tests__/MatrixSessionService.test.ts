import type { MatrixClient, Room } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'

const mockDirectMessageService = {
  getDMRooms: vi.fn(),
  getDmForUser: vi.fn(),
  createDm: vi.fn(),
  getDmRoomInfo: vi.fn()
}

const mockClient = {
  getRooms: vi.fn(),
  getRoom: vi.fn(),
  getUserId: vi.fn(),
  setRoomTag: vi.fn(),
  deleteRoomTag: vi.fn(),
  removeRoomTag: vi.fn()
}

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => mockClient as unknown as MatrixClient)
  }
}))

vi.mock('../../room/MatrixDirectMessageService', () => ({
  matrixDirectMessageService: mockDirectMessageService
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { matrixSessionService } = await import('../MatrixSessionService')

function createEvent(ts: number, body?: string) {
  return {
    getTs: vi.fn(() => ts),
    getContent: vi.fn(() => (body ? { body } : {}))
  }
}

function createRoom(options: {
  roomId?: string
  name?: string
  avatar?: string
  unreadCount?: number
  joinedMemberCount?: number
  events?: Array<ReturnType<typeof createEvent>>
  tags?: Record<string, unknown>
  notificationSettings?: Record<string, unknown> | null
  joinedMembers?: Array<{ userId: string }>
}) {
  const {
    roomId = '!room:example.com',
    name = '',
    avatar = '',
    unreadCount = 0,
    joinedMemberCount = 2,
    events = [],
    tags,
    notificationSettings = null,
    joinedMembers
  } = options

  return {
    roomId,
    name,
    getMxcAvatarUrl: vi.fn(() => avatar),
    getUnreadNotificationCount: vi.fn(() => unreadCount),
    getJoinedMemberCount: vi.fn(() => joinedMemberCount),
    getJoinedMembers: vi.fn(() => joinedMembers ?? []),
    getLiveTimeline: vi.fn(() => ({
      getEvents: vi.fn(() => events)
    })),
    getAccountData: vi.fn((eventType: string) => {
      if (eventType === 'm.tag' && tags) {
        return {
          getContent: vi.fn(() => ({ tags }))
        }
      }

      if (eventType === 'tjg.room.notification_settings' && notificationSettings) {
        return {
          getContent: vi.fn(() => notificationSettings)
        }
      }

      return null
    })
  }
}

describe('MatrixSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should build dm sessions from room timeline and notification metadata', async () => {
    const room = createRoom({
      roomId: '!dm:example.com',
      unreadCount: 3,
      avatar: 'mxc://example.com/avatar',
      events: [createEvent(1710000000000, 'hello matrix')],
      tags: {
        'm.favourite': {
          order: 0.5
        }
      },
      notificationSettings: {
        shield: true,
        muteNotification: NotificationTypeEnum.NOT_DISTURB
      }
    })

    mockDirectMessageService.getDMRooms.mockResolvedValueOnce([
      { roomId: '!dm:example.com', invitees: ['@alice:example.com'], inviter: '@alice:example.com' }
    ])
    mockClient.getRooms.mockReturnValueOnce([room] as unknown as Room[])

    const result = await matrixSessionService.getSessionList()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: '@alice:example.com',
      roomId: '!dm:example.com',
      name: '@alice:example.com',
      avatar: 'mxc://example.com/avatar',
      type: RoomTypeEnum.SINGLE,
      unreadCount: 3,
      activeTime: 1710000000000,
      top: true,
      shield: true,
      muteNotification: NotificationTypeEnum.NOT_DISTURB,
      detailId: '@alice:example.com',
      account: '@alice:example.com',
      text: 'hello matrix'
    })
  })

  it('should still build sessions when dm rooms query fails while listing sessions', async () => {
    const room = createRoom({
      roomId: '!group:example.com',
      name: 'General',
      joinedMemberCount: 3,
      events: [createEvent(1712000000000, 'latest update')]
    })

    mockDirectMessageService.getDMRooms.mockImplementationOnce(async (throwOnError?: boolean) => {
      if (throwOnError === false) {
        return []
      }
      throw new Error('DirectMessageManager 未初始化')
    })
    mockClient.getRooms.mockReturnValueOnce([room] as unknown as Room[])

    await expect(matrixSessionService.getSessionList()).resolves.toEqual([
      {
        id: '!group:example.com',
        roomId: '!group:example.com',
        name: 'General',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 0,
        activeTime: 1712000000000,
        top: false,
        shield: false,
        muteNotification: NotificationTypeEnum.RECEPTION,
        detailId: undefined,
        account: undefined,
        text: 'latest update'
      }
    ])
    expect(mockDirectMessageService.getDMRooms).toHaveBeenCalledWith(false)
  })

  it('同人 DM 去重：localpart 与完整 MXID 混存时合并为一条，未读累加、身份互补（回归守护）', async () => {
    const dmOld = createRoom({
      roomId: '!dm-old:example.com',
      unreadCount: 5,
      events: [createEvent(1000, 'old message')]
    })
    const dmNew = createRoom({
      roomId: '!dm-new:example.com',
      unreadCount: 2,
      events: [createEvent(2000, 'new message')]
    })

    // 历史脏数据场景：旧房间 m.direct 记录的是 localpart，新房间是完整 MXID
    mockDirectMessageService.getDMRooms.mockResolvedValueOnce([
      { roomId: '!dm-old:example.com', invitees: ['test1'], inviter: 'test1' },
      { roomId: '!dm-new:example.com', invitees: ['@test1:example.com'], inviter: '@test1:example.com' }
    ])
    mockClient.getRooms.mockReturnValueOnce([dmOld, dmNew] as unknown as Room[])

    const result = await matrixSessionService.getSessionList()

    expect(result).toHaveLength(1)
    // 保留更活跃的 dm-new，未读 5 + 2 累加
    expect(result[0].roomId).toBe('!dm-new:example.com')
    expect(result[0].unreadCount).toBe(7)
  })

  it('同人 DM 去重：一条有身份一条缺失身份时不误合并（缺失条按 roomId 独立保留）', async () => {
    const withIdentity = createRoom({
      roomId: '!dm-known:example.com',
      events: [createEvent(2000, 'known')]
    })
    // 无 m.direct 映射、无成员信息 → detailId undefined，去重键退化为 roomId
    const noIdentity = createRoom({
      roomId: '!dm-unknown:example.com',
      events: [createEvent(1000, 'unknown')]
    })

    mockDirectMessageService.getDMRooms.mockResolvedValueOnce([
      { roomId: '!dm-known:example.com', invitees: ['@test1:example.com'], inviter: '@test1:example.com' }
    ])
    mockClient.getRooms.mockReturnValueOnce([withIdentity, noIdentity] as unknown as Room[])

    const result = await matrixSessionService.getSessionList()

    // 服务层无法关联（身份缺失），两条都保留；由 store 层 directRoomId 回填 + UI 兜底合并
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.roomId).sort()).toEqual(['!dm-known:example.com', '!dm-unknown:example.com'])
  })

  it('死房间过滤：仅剩自己且无未读的房间不进会话列表（Empty room 刷屏根治）', async () => {
    const deadEmpty = createRoom({
      roomId: '!dead-empty:example.com',
      name: 'Empty room',
      joinedMemberCount: 1,
      events: []
    })
    const deadDm = createRoom({
      roomId: '!dead-dm:example.com',
      name: 'test1',
      joinedMemberCount: 1,
      unreadCount: 0,
      events: []
    })
    const aliveDm = createRoom({
      roomId: '!alive-dm:example.com',
      joinedMemberCount: 2,
      unreadCount: 1,
      events: [createEvent(3000, 'hi')]
    })

    mockDirectMessageService.getDMRooms.mockResolvedValueOnce([
      { roomId: '!alive-dm:example.com', invitees: ['@test1:example.com'], inviter: '@test1:example.com' }
    ])
    mockClient.getRooms.mockReturnValueOnce([deadEmpty, deadDm, aliveDm] as unknown as Room[])

    const result = await matrixSessionService.getSessionList()

    expect(result).toHaveLength(1)
    expect(result[0].roomId).toBe('!alive-dm:example.com')
  })

  it('死房间过滤：invite 状态或仍有未读的单人房间保留', async () => {
    const invited = {
      ...createRoom({ roomId: '!invited:example.com', joinedMemberCount: 1, events: [] }),
      getMyMembership: vi.fn(() => 'invite')
    }
    const unreadLeft = createRoom({
      roomId: '!unread-left:example.com',
      joinedMemberCount: 1,
      unreadCount: 3,
      events: [createEvent(100, 'pending')]
    })

    mockDirectMessageService.getDMRooms.mockResolvedValueOnce([])
    mockClient.getRooms.mockReturnValueOnce([invited, unreadLeft] as unknown as Room[])

    const result = await matrixSessionService.getSessionList()

    expect(result).toHaveLength(2)
    expect(result.map((s) => s.roomId).sort()).toEqual(['!invited:example.com', '!unread-left:example.com'])
  })

  it('should use room tag api when setting session top', async () => {
    mockClient.setRoomTag.mockResolvedValueOnce(undefined)

    await expect(matrixSessionService.setSessionTop('!room:example.com', true)).resolves.toBe(true)

    expect(mockClient.setRoomTag).toHaveBeenCalledWith('!room:example.com', 'm.favourite', { order: '0.5' })
  })

  it('should create dm detail fallback when direct room is not cached locally', async () => {
    vi.useFakeTimers()
    mockDirectMessageService.getDmForUser.mockResolvedValueOnce(null)
    mockDirectMessageService.createDm.mockResolvedValueOnce('!new:example.com')
    mockClient.getRoom.mockReturnValue(null)

    const promise = matrixSessionService.getSessionDetailWithFriends('@bob:example.com')
    await vi.advanceTimersByTimeAsync(3100)
    const result = await promise

    expect(mockDirectMessageService.getDmForUser).toHaveBeenCalledWith('@bob:example.com', false)
    expect(mockDirectMessageService.createDm).toHaveBeenCalledWith('@bob:example.com')
    expect(result).toEqual({
      roomId: '!new:example.com',
      name: '@bob:example.com',
      avatar: '',
      type: RoomTypeEnum.SINGLE,
      unreadCount: 0,
      activeTime: 0,
      top: false,
      shield: false,
      muteNotification: NotificationTypeEnum.RECEPTION,
      detailId: '@bob:example.com',
      account: '@bob:example.com',
      id: '@bob:example.com'
    })

    vi.useRealTimers()
  })

  it('should resolve an existing 1:1 room locally even when the DM manager has no mapping', async () => {
    const room = createRoom({
      roomId: '!existing:example.com',
      name: 'Bob',
      avatar: 'mxc://example.com/bob',
      unreadCount: 2,
      events: [createEvent(1713000000000, 'cached hi')],
      joinedMembers: [{ userId: '@me:example.com' }, { userId: '@bob:example.com' }]
    })
    mockClient.getRooms.mockReturnValueOnce([room] as unknown as Room[])
    mockClient.getUserId.mockReturnValue('@me:example.com')
    // manager has no mapping AND would fail to create a new room:
    mockDirectMessageService.getDmForUser.mockResolvedValueOnce(null)
    mockDirectMessageService.createDm.mockRejectedValueOnce(new Error('manager not ready'))
    mockDirectMessageService.getDmRoomInfo.mockResolvedValueOnce(null)

    const result = await matrixSessionService.getSessionDetailWithFriends('@bob:example.com')

    // local-first: createDm should NOT be called because the room was found locally
    expect(mockDirectMessageService.createDm).not.toHaveBeenCalled()
    expect(result?.roomId).toBe('!existing:example.com')
    expect(result?.detailId).toBe('@bob:example.com')
    expect(result?.type).toBe(RoomTypeEnum.SINGLE)
    expect(result?.text).toBe('cached hi')
  })

  it('should wait for the newly created dm room to appear before building session detail', async () => {
    vi.useFakeTimers()
    const room = createRoom({
      roomId: '!new:example.com',
      name: 'Bob',
      avatar: 'mxc://example.com/bob',
      unreadCount: 1,
      events: [createEvent(1711000000000, 'hi')]
    })
    mockDirectMessageService.getDmForUser.mockResolvedValueOnce(null)
    mockDirectMessageService.createDm.mockResolvedValueOnce('!new:example.com')
    mockDirectMessageService.getDmRoomInfo.mockResolvedValueOnce({
      roomId: '!new:example.com',
      invitees: ['@bob:example.com']
    })
    mockClient.getRoom.mockReturnValueOnce(null).mockReturnValueOnce(null).mockReturnValueOnce(room)

    const promise = matrixSessionService.getSessionDetailWithFriends('@bob:example.com')
    await vi.advanceTimersByTimeAsync(300)
    const result = await promise

    expect(result).toEqual({
      id: '@bob:example.com',
      roomId: '!new:example.com',
      name: 'Bob',
      avatar: 'mxc://example.com/bob',
      type: RoomTypeEnum.SINGLE,
      unreadCount: 1,
      activeTime: 1711000000000,
      top: false,
      shield: false,
      muteNotification: NotificationTypeEnum.RECEPTION,
      detailId: '@bob:example.com',
      account: '@bob:example.com',
      text: 'hi'
    })

    vi.useRealTimers()
  })
})
