import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const convertEventToMessageTypeMock = vi.fn()
const convertEventToMessageMock = vi.fn()
vi.mock('../../MatrixEventService', () => ({
  default: {
    convertEventToMessageType: (e: MatrixEvent) => convertEventToMessageTypeMock(e),
    convertEventToMessage: (e: MatrixEvent, room: Room) => convertEventToMessageMock(e, room)
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
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    service = new MatrixRoomRealtimeService()
    convertEventToMessageTypeMock.mockReset()
    convertEventToMessageMock.mockReset()
    applySlidingSyncUnreadCountsMock.mockReset()
    getUnreadCountMock.mockReset()
    convertRoomToRoomInfoMock.mockReset()
  })

  describe('convertRoomToSession', () => {
    const mockClient = () => ({ getUserId: () => '@me:e', getAccountData: () => undefined }) as never

    it('maps fields, chooses SINGLE type when 2 members, fills detailId with counterpart', () => {
      getUnreadCountMock.mockReturnValueOnce(7)
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient())
      const room = makeRoom({ getJoinedMemberCount: () => 2 })
      expect(service.convertRoomToSession(room)).toEqual({
        roomId: '!r:e',
        name: 'Room',
        avatar: 'mxc://a',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 7,
        activeTime: 999,
        detailId: '@other:e',
        account: '@other:e'
      })
    })

    it('SINGLE 房间用「除自己外的另一名成员」填充 detailId（供下游 counterpart 去重）', () => {
      getUnreadCountMock.mockReturnValueOnce(0)
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient())
      const room = makeRoom({
        getJoinedMemberCount: () => 2,
        getJoinedMembers: () => [{ userId: '@me:e' }, { userId: '@test1:matrix.test' }] as never
      })
      const session = service.convertRoomToSession(room)
      expect(session.type).toBe(RoomTypeEnum.SINGLE)
      expect(session.detailId).toBe('@test1:matrix.test')
      expect(session.account).toBe('@test1:matrix.test')
    })

    it('chooses GROUP type when !== 2 members (no detailId)', () => {
      getUnreadCountMock.mockReturnValueOnce(0)
      const room = makeRoom()
      const session = service.convertRoomToSession(room)
      expect(session.type).toBe(RoomTypeEnum.GROUP)
      expect(session.detailId).toBeUndefined()
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
      vi.mocked(matrixClientService.getClient).mockReturnValue({ on, getRoom } as never)
      return { on, getRoom }
    }

    it('onTimelineEvent bails out when client is null', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
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
      convertEventToMessageMock.mockReturnValueOnce({ id: 'm1' })
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
      expect(convertEventToMessageMock).toHaveBeenCalled()
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

    it.each(['m.beacon_info', 'org.matrix.msc3672.beacon_info'])(
      'onTimelineEvent dispatches %s through convertEventToMessage',
      (eventType) => {
        const { on } = setupClient()
        convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
        convertEventToMessageMock.mockReturnValueOnce({ id: 'beacon' })
        const cb = vi.fn()
        service.onTimelineEvent(cb)
        on.mock.calls[0][1]({ getType: () => eventType, getContent: () => ({}) }, makeRoom())
        expect(convertEventToMessageMock).toHaveBeenCalled()
        expect(convertEventToMessageTypeMock).not.toHaveBeenCalled()
        expect(cb.mock.calls[0][0].message).toEqual({ id: 'beacon' })
      }
    )

    it.each(['m.beacon', 'org.matrix.msc3672.beacon'])(
      'onTimelineEvent leaves message null for %s (position updates are not independent bubbles)',
      (eventType) => {
        const { on } = setupClient()
        convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
        const cb = vi.fn()
        service.onTimelineEvent(cb)
        on.mock.calls[0][1]({ getType: () => eventType, getContent: () => ({}) }, makeRoom())
        expect(convertEventToMessageMock).not.toHaveBeenCalled()
        expect(convertEventToMessageTypeMock).not.toHaveBeenCalled()
        expect(cb.mock.calls[0][0].message).toBeNull()
      }
    )

    it('onTimelineEvent leaves message null for non-message events', () => {
      const { on } = setupClient()
      convertRoomToRoomInfoMock.mockReturnValueOnce({ roomId: '!r:e' })
      const cb = vi.fn()
      service.onTimelineEvent(cb)
      on.mock.calls[0][1]({ getType: () => 'm.room.member', getContent: () => ({}) }, makeRoom())
      expect(cb.mock.calls[0][0].message).toBeNull()
      expect(convertEventToMessageTypeMock).not.toHaveBeenCalled()
    })

    it('onTimelineEvent retries encrypted events and re-emits once they become decrypted messages', () => {
      vi.useFakeTimers()
      try {
        const { on } = setupClient()
        const room = makeRoom()
        let eventType = 'm.room.encrypted'
        const event = {
          getType: () => eventType,
          getContent: () => ({ body: eventType === 'm.room.message' ? 'hello' : undefined })
        }

        convertRoomToRoomInfoMock.mockReturnValue({ roomId: '!r:e' })
        convertEventToMessageTypeMock.mockReturnValueOnce({ id: 'enc' })
        convertEventToMessageMock.mockReturnValueOnce({ id: 'dec' })

        const cb = vi.fn()
        service.onTimelineEvent(cb)
        on.mock.calls[0][1](event, room)

        expect(cb).toHaveBeenCalledTimes(1)
        expect(cb.mock.calls[0][0]).toMatchObject({
          eventType: 'm.room.encrypted',
          message: { id: 'enc' }
        })

        eventType = 'm.room.message'
        vi.advanceTimersByTime(250)

        expect(cb).toHaveBeenCalledTimes(2)
        expect(cb.mock.calls[1][0]).toMatchObject({
          eventType: 'm.room.message',
          message: { id: 'dec' }
        })
        expect(convertEventToMessageMock).toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it.each(['m.beacon_info', 'org.matrix.msc3672.beacon_info'])(
      'onTimelineEvent re-emits a decrypted %s event through convertEventToMessage',
      (eventType) => {
        vi.useFakeTimers()
        try {
          const { on } = setupClient()
          const room = makeRoom()
          let type = 'm.room.encrypted'
          const event = {
            getType: () => type,
            getContent: () => ({})
          }

          convertRoomToRoomInfoMock.mockReturnValue({ roomId: '!r:e' })
          convertEventToMessageTypeMock.mockReturnValueOnce({ id: 'enc' })
          convertEventToMessageMock.mockReturnValueOnce({ id: 'beacon' })

          const cb = vi.fn()
          service.onTimelineEvent(cb)
          on.mock.calls[0][1](event, room)

          expect(cb).toHaveBeenCalledTimes(1)
          expect(cb.mock.calls[0][0]).toMatchObject({
            eventType: 'm.room.encrypted',
            message: { id: 'enc' }
          })

          type = eventType
          vi.advanceTimersByTime(250)

          expect(cb).toHaveBeenCalledTimes(2)
          expect(cb.mock.calls[1][0]).toMatchObject({
            eventType,
            message: { id: 'beacon' }
          })
          expect(convertEventToMessageMock).toHaveBeenCalledWith(event, room)
        } finally {
          vi.useRealTimers()
        }
      }
    )

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
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      expect(service.getRoomName('!r')).toBeNull()
      expect(service.getRoomAvatarUrl('!r')).toBeNull()
    })

    it('returns null when room is missing', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      expect(service.getRoomName('!r')).toBeNull()
      expect(service.getRoomAvatarUrl('!r')).toBeNull()
    })

    it('returns name/avatar when present', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => makeRoom() } as never)
      expect(service.getRoomName('!r')).toBe('Room')
      expect(service.getRoomAvatarUrl('!r')).toBe('mxc://a')
    })
  })

  describe('getVisibleRoomSessions', () => {
    it('returns [] when client is missing', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      expect(service.getVisibleRoomSessions([])).toEqual([])
    })

    it('marks isFavorite=true when other member is in specialFriends', () => {
      getUnreadCountMock.mockReturnValue(0)
      const room = makeRoom({
        getJoinedMembers: () =>
          [{ userId: '@me:e' }, { userId: '@fav:e' }] as unknown as ReturnType<Room['getJoinedMembers']>
      })
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
        getUserId: () => '@me:e',
        getVisibleRooms: () => [room]
      } as never)
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
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
        getUserId: () => '@me:e',
        getVisibleRooms: () => [room]
      } as never)
      expect(service.getVisibleRoomSessions(['@fav:e'])[0].isFavorite).toBe(false)
    })
  })

  describe('getAllRoomInfos', () => {
    it('returns [] when client is missing', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      expect(service.getAllRoomInfos()).toEqual([])
      expect(applySlidingSyncUnreadCountsMock).not.toHaveBeenCalled()
    })

    it('converts all rooms and passes them through slidingSync', () => {
      const rooms = [makeRoom(), makeRoom({ roomId: '!r2:e' })]
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ getRooms: () => rooms } as never)
      convertRoomToRoomInfoMock.mockImplementation((r: Room) => ({ roomId: r.roomId }))
      const out = service.getAllRoomInfos()
      expect(out).toEqual([{ roomId: '!r:e' }, { roomId: '!r2:e' }])
      expect(applySlidingSyncUnreadCountsMock).toHaveBeenCalledWith(out)
    })
  })
})
