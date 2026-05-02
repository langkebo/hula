import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() as MatrixClient }
}))

const convertEventToMessageTypeMock = vi.fn()
vi.mock('../../MatrixEventService', () => ({
  default: {
    convertEventToMessageType: (e: MatrixEvent) => convertEventToMessageTypeMock(e)
  }
}))

const applySlidingSyncUnreadCountsMock = vi.fn()
vi.mock('../../sync/MatrixSlidingSyncService', () => ({
  default: {
    applySlidingSyncUnreadCounts: (infos: unknown[]) => applySlidingSyncUnreadCountsMock(infos)
  }
}))

const getUnreadCountMock = vi.fn()
vi.mock('../../messaging/MatrixReceiptService', () => ({
  matrixReceiptService: {
    getUnreadCount: (id: string) => getUnreadCountMock(id)
  }
}))

const convertRoomToRoomInfoMock = vi.fn()
vi.mock('../CreationService', () => ({
  matrixRoomCreationService: {
    convertRoomToRoomInfo: (room: Room) => convertRoomToRoomInfoMock(room)
  }
}))

const { MatrixRoomRealtimeService } = await import('../RealtimeService')
const { RoomTypeEnum } = await import('@/enums')

const makeRoom = (overrides: Partial<Room> = {}): Room =>
  ({
    roomId: '!r:e',
    name: 'Room',
    getMxcAvatarUrl: () => 'mxc://a',
    getJoinedMemberCount: () => 3,
    getJoinedMembers: () => [{ userId: '@me:e' }, { userId: '@other:e' }],
    getLiveTimeline: () => ({ getEvents: () => [{ getTs: () => 999 }] }),
    ...overrides
  }) as unknown as Room

describe('MatrixRoomRealtimeService', () => {
  let service: InstanceType<typeof MatrixRoomRealtimeService>

  beforeEach(() => {
    service = new MatrixRoomRealtimeService()
    getClientMock.mockReset()
    convertEventToMessageTypeMock.mockReset()
    applySlidingSyncUnreadCountsMock.mockReset()
    getUnreadCountMock.mockReset()
    convertRoomToRoomInfoMock.mockReset()
  })

  describe('convertRoomToSession', () => {
    it('maps fields and chooses SINGLE type when 2 members', () => {
      getUnreadCountMock.mockReturnValueOnce(7)
      const room = makeRoom({ getJoinedMemberCount: () => 2 })
      expect(service.convertRoomToSession(room)).toEqual({
        roomId: '!r:e',
        name: 'Room',
        avatar: 'mxc://a',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 7,
        activeTime: 999
      })
    })

    it('chooses GROUP type when !== 2 members', () => {
      getUnreadCountMock.mockReturnValueOnce(0)
      const room = makeRoom()
      expect(service.convertRoomToSession(room).type).toBe(RoomTypeEnum.GROUP)
    })

    it('falls back to "Unknown Room" when name is empty', () => {
      getUnreadCountMock.mockReturnValueOnce(0)
      const room = makeRoom({ name: '' })
      expect(service.convertRoomToSession(room).name).toBe('Unknown Room')
    })

    it('activeTime=0 when timeline is empty', () => {
      getUnreadCountMock.mockReturnValueOnce(0)
      const room = makeRoom({
        getLiveTimeline: () => ({ getEvents: () => [] }) as unknown as ReturnType<Room['getLiveTimeline']>
      })
      expect(service.convertRoomToSession(room).activeTime).toBe(0)
    })
  })

  describe('event subscriptions', () => {
    const setupClient = () => {
      const on = vi.fn()
      const getRoom = vi.fn()
      getClientMock.mockReturnValue({ on, getRoom })
      return { on, getRoom }
    }

    it('onTimelineEvent bails out when client is null', () => {
      getClientMock.mockReturnValueOnce(null)
      expect(() => service.onTimelineEvent(() => {})).not.toThrow()
    })

    it('onTimelineEvent skips when room is undefined', () => {
      const { on } = setupClient()
      const cb = vi.fn()
      service.onTimelineEvent(cb)
      const handler = on.mock.calls[0][1]
      handler({ getType: () => 'm.room.message', getContent: () => ({}) }, undefined)
      expect(cb).not.toHaveBeenCalled()
    })

    it('onTimelineEvent converts room info; message for m.room.message', () => {
      const { on } = setupClient()
      convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
      convertEventToMessageTypeMock.mockReturnValueOnce({ id: 'm1' })
      const cb = vi.fn()
      service.onTimelineEvent(cb)
      const handler = on.mock.calls[0][1]
      const event = { getType: () => 'm.room.message', getContent: () => ({}) }
      handler(event, makeRoom())
      expect(cb).toHaveBeenCalledWith({
        roomId: '!r:e',
        eventType: 'm.room.message',
        roomInfo: { roomId: '!r:e' },
        message: { id: 'm1' }
      })
    })

    it('onTimelineEvent converts message for m.room.encrypted', () => {
      const { on } = setupClient()
      convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
      convertEventToMessageTypeMock.mockReturnValueOnce({ id: 'enc' })
      const cb = vi.fn()
      service.onTimelineEvent(cb)
      on.mock.calls[0][1]({ getType: () => 'm.room.encrypted', getContent: () => ({}) }, makeRoom())
      expect(convertEventToMessageTypeMock).toHaveBeenCalled()
      expect(cb.mock.calls[0][0].message).toEqual({ id: 'enc' })
    })

    it('onTimelineEvent leaves message null for non-message events', () => {
      const { on } = setupClient()
      convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
      const cb = vi.fn()
      service.onTimelineEvent(cb)
      on.mock.calls[0][1]({ getType: () => 'm.room.member', getContent: () => ({}) }, makeRoom())
      expect(cb.mock.calls[0][0].message).toBeNull()
      expect(convertEventToMessageTypeMock).not.toHaveBeenCalled()
    })

    it('onRoomNameChange forwards roomId + name', () => {
      const { on } = setupClient()
      const cb = vi.fn()
      service.onRoomNameChange(cb)
      on.mock.calls[0][1]({ roomId: '!r:e', name: 'N' })
      expect(cb).toHaveBeenCalledWith('!r:e', 'N')
    })

    it('onRoomAvatarChange forwards roomId + avatar, defaults to null', () => {
      const { on } = setupClient()
      const cb = vi.fn()
      service.onRoomAvatarChange(cb)
      on.mock.calls[0][1]({ roomId: '!r:e', getMxcAvatarUrl: () => undefined })
      expect(cb).toHaveBeenCalledWith('!r:e', null)
    })

    it('onRoomMemberChange looks up room via client.getRoom and delegates convertRoomToRoomInfo', () => {
      const { on, getRoom } = setupClient()
      getRoom.mockReturnValueOnce(makeRoom())
      convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
      const cb = vi.fn()
      service.onRoomMemberChange(cb)
      on.mock.calls[0][1]({ getType: () => 'm.room.member' }, { roomId: '!r:e' })
      expect(cb).toHaveBeenCalledWith('!r:e', { roomId: '!r:e' })
    })

    it('onRoomMemberChange skips when client.getRoom returns null', () => {
      const { on, getRoom } = setupClient()
      getRoom.mockReturnValueOnce(null)
      const cb = vi.fn()
      service.onRoomMemberChange(cb)
      on.mock.calls[0][1]({}, { roomId: '!missing' })
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('getRoomName / getRoomAvatarUrl', () => {
    it('returns null when client is missing', () => {
      getClientMock.mockReturnValue(null)
      expect(service.getRoomName('!r')).toBeNull()
      expect(service.getRoomAvatarUrl('!r')).toBeNull()
    })

    it('returns null when room is missing', () => {
      getClientMock.mockReturnValue({ getRoom: () => null })
      expect(service.getRoomName('!r')).toBeNull()
      expect(service.getRoomAvatarUrl('!r')).toBeNull()
    })

    it('returns name/avatar when present', () => {
      getClientMock.mockReturnValue({ getRoom: () => makeRoom() })
      expect(service.getRoomName('!r')).toBe('Room')
      expect(service.getRoomAvatarUrl('!r')).toBe('mxc://a')
    })
  })

  describe('getVisibleRoomSessions', () => {
    it('returns [] when client is missing', () => {
      getClientMock.mockReturnValueOnce(null)
      expect(service.getVisibleRoomSessions([])).toEqual([])
    })

    it('marks isFavorite=true when other member is in specialFriends', () => {
      getUnreadCountMock.mockReturnValue(0)
      const room = makeRoom({
        getJoinedMembers: () =>
          [{ userId: '@me:e' }, { userId: '@fav:e' }] as unknown as ReturnType<Room['getJoinedMembers']>
      })
      getClientMock.mockReturnValueOnce({
        getUserId: () => '@me:e',
        getVisibleRooms: () => [room]
      })
      const out = service.getVisibleRoomSessions(['@fav:e'])
      expect(out).toHaveLength(1)
      expect(out[0].isFavorite).toBe(true)
    })

    it('isFavorite=false when other member is not in specialFriends', () => {
      getUnreadCountMock.mockReturnValue(0)
      const room = makeRoom({
        getJoinedMembers: () =>
          [{ userId: '@me:e' }, { userId: '@nope:e' }] as unknown as ReturnType<Room['getJoinedMembers']>
      })
      getClientMock.mockReturnValueOnce({
        getUserId: () => '@me:e',
        getVisibleRooms: () => [room]
      })
      expect(service.getVisibleRoomSessions(['@fav:e'])[0].isFavorite).toBe(false)
    })
  })

  describe('getAllRoomInfos', () => {
    it('returns [] when client is missing', () => {
      getClientMock.mockReturnValueOnce(null)
      expect(service.getAllRoomInfos()).toEqual([])
      expect(applySlidingSyncUnreadCountsMock).not.toHaveBeenCalled()
    })

    it('converts all rooms and passes them through slidingSync', () => {
      const rooms = [makeRoom(), makeRoom({ roomId: '!r2:e' })]
      getClientMock.mockReturnValueOnce({ getRooms: () => rooms })
      convertRoomToRoomInfoMock.mockImplementation((r: Room) => ({ roomId: r.roomId }))
      const out = service.getAllRoomInfos()
      expect(out).toEqual([{ roomId: '!r:e' }, { roomId: '!r2:e' }])
      expect(applySlidingSyncUnreadCountsMock).toHaveBeenCalledWith(out)
    })
  })
})
