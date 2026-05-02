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
}) {
  const {
    roomId = '!room:example.com',
    name = '',
    avatar = '',
    unreadCount = 0,
    joinedMemberCount = 2,
    events = [],
    tags,
    notificationSettings = null
  } = options

  return {
    roomId,
    name,
    getMxcAvatarUrl: vi.fn(() => avatar),
    getUnreadNotificationCount: vi.fn(() => unreadCount),
    getJoinedMemberCount: vi.fn(() => joinedMemberCount),
    getLiveTimeline: vi.fn(() => ({
      getEvents: vi.fn(() => events)
    })),
    getAccountData: vi.fn((eventType: string) => {
      if (eventType === 'm.tag' && tags) {
        return {
          getContent: vi.fn(() => ({ tags }))
        }
      }

      if (eventType === 'hula.room.notification_settings' && notificationSettings) {
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

  it('should return empty array when dm rooms query fails while listing sessions', async () => {
    mockDirectMessageService.getDMRooms.mockRejectedValueOnce(new Error('DirectMessageManager 未初始化'))

    await expect(matrixSessionService.getSessionList()).resolves.toEqual([])
  })

  it('should use room tag api when setting session top', async () => {
    mockClient.setRoomTag.mockResolvedValueOnce(undefined)

    await expect(matrixSessionService.setSessionTop('!room:example.com', true)).resolves.toBe(true)

    expect(mockClient.setRoomTag).toHaveBeenCalledWith('!room:example.com', 'm.favourite', { order: '0.5' })
  })

  it('should create dm detail fallback when direct room is not cached locally', async () => {
    mockDirectMessageService.getDmForUser.mockResolvedValueOnce(null)
    mockDirectMessageService.createDm.mockResolvedValueOnce('!new:example.com')
    mockClient.getRoom.mockReturnValueOnce(null)

    const result = await matrixSessionService.getSessionDetailWithFriends('@bob:example.com')

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
  })
})
