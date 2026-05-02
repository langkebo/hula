import type { ICreateRoomOpts, MatrixClient, Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const createRoomMock = vi.fn()
const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: {
    createRoom: (opts: ICreateRoomOpts) => createRoomMock(opts),
    getClient: () => getClientMock() as MatrixClient
  }
}))

const joinRoomMock = vi.fn()
vi.mock('../MembershipService', () => ({
  matrixRoomMembershipService: {
    joinRoom: (roomId: string) => joinRoomMock(roomId)
  }
}))

const enqueueMock = vi.fn()
vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: (type: string, status: string, data: unknown) => enqueueMock(type, status, data)
  }
}))

const { MatrixRoomCreationService } = await import('../CreationService')
const { Preset, Visibility, NotificationCountType } = await import('matrix-js-sdk')

type CreateOptsWithState = ICreateRoomOpts & {
  initial_state: Array<{ type: string; state_key: string; content: Record<string, unknown> }>
}

type RoomWithSyncData = Room & {
  syncData?: {
    unread_notifications?: {
      notification_count?: number
      highlight_count?: number
    }
  }
}

const makeRoom = (overrides: unknown = {}): Room =>
  ({
    roomId: '!r:e',
    name: 'RoomName',
    getLiveTimeline: () => ({ getEvents: () => [] }),
    getMxcAvatarUrl: () => 'mxc://a/b',
    getJoinedMembers: () => [
      {
        userId: '@u1:e',
        name: 'U1',
        getMxcAvatarUrl: () => 'mxc://u1',
        powerLevel: 0
      },
      {
        userId: '@u2:e',
        name: 'U2',
        getMxcAvatarUrl: () => null,
        powerLevel: 50
      }
    ],
    getUnreadNotificationCount: vi.fn(),
    ...(overrides as Record<string, unknown>)
  }) as unknown as Room

function hasStateEventType(value: unknown, type: string): boolean {
  return typeof value === 'object' && value !== null && 'type' in value && (value as { type?: string }).type === type
}

describe('MatrixRoomCreationService', () => {
  let service: InstanceType<typeof MatrixRoomCreationService>

  beforeEach(() => {
    service = new MatrixRoomCreationService()
    createRoomMock.mockReset()
    getClientMock.mockReset()
    joinRoomMock.mockReset()
  })

  describe('createRoom', () => {
    it('delegates to matrixClientService.createRoom', async () => {
      const room = makeRoom()
      createRoomMock.mockResolvedValueOnce(room)
      expect(await service.createRoom({ name: 'R' })).toBe(room)
      expect(createRoomMock).toHaveBeenCalledWith({ name: 'R' })
    })

    it('re-throws on failure', async () => {
      createRoomMock.mockRejectedValueOnce(new Error('boom'))
      await expect(service.createRoom({ name: 'R' })).rejects.toThrow('boom')
    })

    it('enqueues creation when offline', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      const result = await service.createRoom({ name: 'R' })
      expect(enqueueMock).toHaveBeenCalledWith(
        'creation',
        'pending',
        expect.objectContaining({ options: { name: 'R' } })
      )
      expect(result.roomId).toContain('!pending-')
      vi.stubGlobal('navigator', { onLine: true })
    })
  })

  describe('createGroupRoom', () => {
    it('uses Public visibility + PublicChat preset when isPublic=true', async () => {
      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', isPublic: true, alias: 'g' })
      expect(createRoomMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'G',
          visibility: Visibility.Public,
          preset: Preset.PublicChat,
          room_alias_name: 'g',
          initial_state: []
        })
      )
    })

    it('uses Private visibility + PrivateChat preset by default; empty alias → undefined', async () => {
      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', alias: '' })
      const opts = createRoomMock.mock.calls[0][0]
      expect(opts.visibility).toBe(Visibility.Private)
      expect(opts.preset).toBe(Preset.PrivateChat)
      expect(opts.room_alias_name).toBeUndefined()
    })

    it('pushes m.room.avatar into initial_state when avatarUrl is provided', async () => {
      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', avatarUrl: 'mxc://x/y' })
      const opts = createRoomMock.mock.calls[0][0]
      expect(opts.initial_state).toContainEqual({
        type: 'm.room.avatar',
        state_key: '',
        content: { url: 'mxc://x/y' }
      })
    })

    it('pushes m.room.encryption only when isEncrypted && !isPublic', async () => {
      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', isEncrypted: true, isPublic: true })
      const publicOpts = createRoomMock.mock.calls[0][0] as CreateOptsWithState
      expect(publicOpts.initial_state.find((entry) => hasStateEventType(entry, 'm.room.encryption'))).toBeUndefined()

      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', isEncrypted: true })
      const privateOpts = createRoomMock.mock.calls[1][0]
      expect(privateOpts.initial_state).toContainEqual({
        type: 'm.room.encryption',
        state_key: '',
        content: { algorithm: 'm.megolm.v1.aes-sha2' }
      })
    })

    it('pushes m.room.history_visibility only when non-"shared"', async () => {
      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', historyVisibility: 'shared' })
      const sharedOpts = createRoomMock.mock.calls[0][0] as CreateOptsWithState
      expect(
        sharedOpts.initial_state.find((entry) => hasStateEventType(entry, 'm.room.history_visibility'))
      ).toBeUndefined()

      createRoomMock.mockResolvedValueOnce(makeRoom())
      await service.createGroupRoom({ name: 'G', historyVisibility: 'world_readable' })
      const wrOpts = createRoomMock.mock.calls[1][0]
      expect(wrOpts.initial_state).toContainEqual({
        type: 'm.room.history_visibility',
        state_key: '',
        content: { history_visibility: 'world_readable' }
      })
    })
  })

  describe('convertRoomToRoomInfo', () => {
    beforeEach(() => {
      getClientMock.mockReturnValue({ isRoomEncrypted: () => false })
    })

    it('maps basic fields and derives isDirect from member count when no DMInviter', () => {
      const room = makeRoom()
      const info = service.convertRoomToRoomInfo(room)
      expect(info.roomId).toBe('!r:e')
      expect(info.name).toBe('RoomName')
      expect(info.avatarUrl).toBe('mxc://a/b')
      expect(info.isDirect).toBe(true)
      expect(info.isEncrypted).toBe(false)
      expect(info.members).toHaveLength(2)
      expect(info.members[0]).toEqual({
        userId: '@u1:e',
        name: 'U1',
        avatarUrl: 'mxc://u1',
        powerLevel: 0
      })
      expect(info.members[1].avatarUrl).toBeUndefined()
    })

    it('falls back to roomId when room.name is empty', () => {
      const room = makeRoom({ name: '' })
      expect(service.convertRoomToRoomInfo(room).name).toBe('!r:e')
    })

    it('extracts lastMessage/lastMessageTime for m.text events', () => {
      const room = makeRoom({
        getLiveTimeline: () => ({
          getEvents: () => [
            {
              getTs: () => 123,
              getContent: () => ({ msgtype: 'm.text', body: 'hello' }),
              getType: () => 'm.room.message'
            }
          ]
        })
      })
      const info = service.convertRoomToRoomInfo(room)
      expect(info.lastMessage).toBe('hello')
      expect(info.lastMessageTime).toBe(123)
    })

    it('maps media msgtypes to [图片]/[视频]/[音频]/[文件]', () => {
      const cases: Array<[string, string]> = [
        ['m.image', '[图片]'],
        ['m.video', '[视频]'],
        ['m.audio', '[音频]'],
        ['m.file', '[文件]']
      ]
      for (const [msgtype, expected] of cases) {
        const room = makeRoom({
          getLiveTimeline: () => ({
            getEvents: () => [
              {
                getTs: () => 1,
                getContent: () => ({ msgtype }),
                getType: () => 'm.room.message'
              }
            ]
          })
        })
        expect(service.convertRoomToRoomInfo(room).lastMessage).toBe(expected)
      }
    })

    it('maps m.room.member join/leave to 加入/离开', () => {
      const join = makeRoom({
        getLiveTimeline: () => ({
          getEvents: () => [
            { getTs: () => 1, getContent: () => ({ membership: 'join' }), getType: () => 'm.room.member' }
          ]
        })
      })
      expect(service.convertRoomToRoomInfo(join).lastMessage).toBe('加入了房间')

      const leave = makeRoom({
        getLiveTimeline: () => ({
          getEvents: () => [
            { getTs: () => 1, getContent: () => ({ membership: 'leave' }), getType: () => 'm.room.member' }
          ]
        })
      })
      expect(service.convertRoomToRoomInfo(leave).lastMessage).toBe('离开了房间')
    })

    it('prefers syncData.unread_notifications counts when present', () => {
      const room = makeRoom() as RoomWithSyncData
      room.syncData = { unread_notifications: { notification_count: 5, highlight_count: 2 } }
      const info = service.convertRoomToRoomInfo(room)
      expect(info.unreadCount).toBe(5)
      expect(info.highlightCount).toBe(2)
      expect(info.notificationCount).toBe(5)
    })

    it('falls back to room.getUnreadNotificationCount when syncData missing', () => {
      const room = makeRoom()
      room.getUnreadNotificationCount = vi.fn((type?: unknown) => {
        if (type === NotificationCountType.Highlight) return 3
        if (type === NotificationCountType.Total) return 7
        return 4
      })
      const info = service.convertRoomToRoomInfo(room)
      expect(info.unreadCount).toBe(4)
      expect(info.highlightCount).toBe(3)
      expect(info.notificationCount).toBe(7)
    })

    it('honors isSpaceRoom=true by forcing isDirect=false', () => {
      const room = makeRoom({ isSpaceRoom: () => true })
      expect(service.convertRoomToRoomInfo(room).isDirect).toBe(false)
    })

    it('honors getDMInviter presence by forcing isDirect=true', () => {
      const room = makeRoom({
        getDMInviter: () => '@inviter:e',
        getJoinedMembers: () => [
          { userId: '@u:e', name: 'U', getMxcAvatarUrl: () => null, powerLevel: 0 },
          { userId: '@v:e', name: 'V', getMxcAvatarUrl: () => null, powerLevel: 0 },
          { userId: '@w:e', name: 'W', getMxcAvatarUrl: () => null, powerLevel: 0 }
        ]
      })
      expect(service.convertRoomToRoomInfo(room).isDirect).toBe(true)
    })

    it('returns isEncrypted=true when client.isRoomEncrypted returns true', () => {
      getClientMock.mockReturnValue({ isRoomEncrypted: () => true })
      expect(service.convertRoomToRoomInfo(makeRoom()).isEncrypted).toBe(true)
    })
  })

  describe('joinRoomAndGetInfo', () => {
    it('joins the room via MembershipService then converts to RoomInfo', async () => {
      getClientMock.mockReturnValue({ isRoomEncrypted: () => false })
      const room = makeRoom()
      joinRoomMock.mockResolvedValueOnce(room)
      const info = await service.joinRoomAndGetInfo('!r:e')
      expect(joinRoomMock).toHaveBeenCalledWith('!r:e')
      expect(info.roomId).toBe('!r:e')
      expect(info.name).toBe('RoomName')
    })

    it('re-throws when joinRoom rejects', async () => {
      joinRoomMock.mockRejectedValueOnce(new Error('no'))
      await expect(service.joinRoomAndGetInfo('!r')).rejects.toThrow('no')
    })
  })
})
