import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient, Room } from '@/types/matrix-js-sdk'
import matrixClientService from '../../MatrixClientService'
import { matrixReadStateService } from '../MatrixReadStateService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixReadStateService', () => {
  let mockReceiptManager: {
    getReceipt: ReturnType<typeof vi.fn>
  }

  let mockRoom: {
    getLiveTimeline: ReturnType<typeof vi.fn>
    getMember: ReturnType<typeof vi.fn>
    getEventReadUpTo: ReturnType<typeof vi.fn>
    getUnreadNotificationCount: ReturnType<typeof vi.fn>
  }

  let mockClient: {
    getReadReceiptsManager: ReturnType<typeof vi.fn>
    getRoom: ReturnType<typeof vi.fn>
    getUserId: ReturnType<typeof vi.fn>
    getRooms: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)

    mockReceiptManager = {
      getReceipt: vi.fn(() => [])
    }

    mockRoom = {
      getLiveTimeline: vi.fn(() => ({
        getEvents: vi.fn(() => [])
      })),
      getMember: vi.fn((userId: string) => ({
        name: userId.split(':')[0].replace('@', ''),
        getMxcAvatarUrl: vi.fn(() => `mxc://matrix.org/avatar/${userId}`)
      })),
      getEventReadUpTo: vi.fn(() => null),
      getUnreadNotificationCount: vi.fn(() => 0)
    }

    mockClient = {
      getReadReceiptsManager: vi.fn(() => mockReceiptManager),
      getRoom: vi.fn(() => mockRoom),
      getUserId: vi.fn(() => '@me:matrix.org'),
      getRooms: vi.fn(() => [])
    }
  })

  it('使用 SDK 回执数据并补全成员展示信息', () => {
    mockReceiptManager.getReceipt.mockReturnValue([
      {
        userId: '@user1:matrix.org',
        eventId: '$event',
        ts: 123456
      }
    ])
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const receipts = matrixReadStateService.getReadReceipts('!room:id', '$event')

    expect(receipts).toEqual([
      {
        userId: '@user1:matrix.org',
        eventId: '$event',
        timestamp: 123456,
        avatarUrl: 'mxc://matrix.org/avatar/@user1:matrix.org',
        displayName: 'user1'
      }
    ])
  })

  it('获取阅读者时排除自己', () => {
    mockReceiptManager.getReceipt.mockReturnValue([
      { userId: '@me:matrix.org', eventId: '$event', ts: 1 },
      { userId: '@user1:matrix.org', eventId: '$event', ts: 2 }
    ])
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const readers = matrixReadStateService.getEventReaders('!room:id', '$event')

    expect(readers).toEqual(['@user1:matrix.org'])
  })

  it('未找到房间时未读数为 0', () => {
    mockClient.getRoom.mockReturnValue(null)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    expect(matrixReadStateService.getUnreadCount('!room:id')).toBe(0)
  })

  it('优先使用 SDK room.getUnreadNotificationCount', () => {
    const room = {
      getUnreadNotificationCount: vi.fn(() => 5)
    }
    mockClient.getRoom.mockReturnValue(room as unknown as Room)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    expect(matrixReadStateService.getUnreadCount('!room:id')).toBe(5)
  })

  it('客户端未初始化时安全降级为 0 / [] / false', () => {
    expect(matrixReadStateService.getReadReceipts('!room:id', '$event')).toEqual([])
    expect(matrixReadStateService.getEventReaders('!room:id', '$event')).toEqual([])
    expect(matrixReadStateService.getUnreadCount('!room:id')).toBe(0)
    expect(matrixReadStateService.hasUnread('!room:id')).toBe(false)
    expect(matrixReadStateService.getRoomsWithUnread()).toEqual([])
  })

  it('hasUnread 与 getRoomsWithUnread 按 Highlight/Total 汇总未读房间', () => {
    const unreadRoom = {
      roomId: '!unread:id',
      getUnreadNotificationCount: vi.fn((type: string) => (type === 'total' ? 2 : 0))
    }
    const readRoom = {
      roomId: '!read:id',
      getUnreadNotificationCount: vi.fn(() => 0)
    }
    mockClient.getRoom.mockImplementation((roomId: string) => (roomId === '!unread:id' ? unreadRoom : readRoom))
    mockClient.getRooms.mockReturnValue([unreadRoom, readRoom])
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    expect(matrixReadStateService.hasUnread('!unread:id')).toBe(true)
    expect(matrixReadStateService.hasUnread('!read:id')).toBe(false)
    expect(matrixReadStateService.getRoomsWithUnread()).toEqual(['!unread:id'])
  })
})
