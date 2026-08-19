import { describe, expect, it } from 'vitest'
import type { MatrixClient, Room } from '../../sdk'
import { findDmCounterpart, isDirectMessageRoom, isDirectMessageRoomFromRoom } from '../roomTypeUtils'

function mockClient(opts: {
  directMap?: Record<string, { room_id: string }[]> | null
  room?: Room | null
}): MatrixClient {
  return {
    getAccountData: (() =>
      opts.directMap === undefined
        ? undefined
        : { getContent: () => opts.directMap }) as unknown as MatrixClient['getAccountData'],
    getRoom: (() => opts.room ?? null) as unknown as MatrixClient['getRoom']
  } as unknown as MatrixClient
}

function mockRoom(opts: { roomId?: string; dmInviter?: string | undefined }): Room {
  return {
    roomId: opts.roomId ?? '!test:matrix.org',
    getDMInviter: (() => opts.dmInviter) as unknown as Room['getDMInviter']
  } as Room
}

describe('isDirectMessageRoom', () => {
  it('returns false when client is null', () => {
    expect(isDirectMessageRoom(null, '!room:matrix.org')).toBe(false)
  })

  it('returns false when client is undefined', () => {
    expect(isDirectMessageRoom(undefined, '!room:matrix.org')).toBe(false)
  })

  it('returns false when roomId is empty', () => {
    const client = mockClient({})
    expect(isDirectMessageRoom(client, '')).toBe(false)
  })

  it('returns true when room is listed in m.direct account data', () => {
    const client = mockClient({
      directMap: {
        '@alice:matrix.org': [{ room_id: '!dm-room:matrix.org' }],
        '@bob:matrix.org': [{ room_id: '!other:matrix.org' }]
      }
    })
    expect(isDirectMessageRoom(client, '!dm-room:matrix.org')).toBe(true)
  })

  it('returns false when room is not in m.direct account data', () => {
    const client = mockClient({
      directMap: {
        '@alice:matrix.org': [{ room_id: '!other:matrix.org' }]
      }
    })
    expect(isDirectMessageRoom(client, '!not-dm:matrix.org')).toBe(false)
  })

  it('returns true when room getDMInviter returns a value', () => {
    const room = mockRoom({ dmInviter: '@someone:matrix.org' })
    const client = mockClient({ directMap: {}, room })
    expect(isDirectMessageRoom(client, '!test:matrix.org')).toBe(true)
  })

  it('returns false when m.direct is empty and room has no DM inviter', () => {
    const room = mockRoom({ dmInviter: undefined })
    const client = mockClient({ directMap: {}, room })
    expect(isDirectMessageRoom(client, '!test:matrix.org')).toBe(false)
  })

  it('returns false when m.direct is absent and room is not found', () => {
    const client = mockClient({ directMap: null, room: null })
    expect(isDirectMessageRoom(client, '!missing:matrix.org')).toBe(false)
  })

  it('handles malformed m.direct data gracefully', () => {
    const client = mockClient({ directMap: null })
    expect(isDirectMessageRoom(client, '!room:matrix.org')).toBe(false)
  })
})

describe('isDirectMessageRoomFromRoom', () => {
  it('returns false when client is null', () => {
    const room = mockRoom({})
    expect(isDirectMessageRoomFromRoom(null, room)).toBe(false)
  })

  it('returns false when client is undefined', () => {
    const room = mockRoom({})
    expect(isDirectMessageRoomFromRoom(undefined, room)).toBe(false)
  })

  it('returns true when room.roomId is in m.direct account data', () => {
    const room = mockRoom({ roomId: '!dm-room:matrix.org' })
    const client = mockClient({
      directMap: {
        '@alice:matrix.org': [{ room_id: '!dm-room:matrix.org' }]
      }
    })
    expect(isDirectMessageRoomFromRoom(client, room)).toBe(true)
  })

  it('returns true when room getDMInviter returns a value', () => {
    const room = mockRoom({
      roomId: '!test:matrix.org',
      dmInviter: '@inviter:matrix.org'
    })
    const client = mockClient({ directMap: {} })
    expect(isDirectMessageRoomFromRoom(client, room)).toBe(true)
  })

  it('returns false when room is not in m.direct and no DM inviter', () => {
    const room = mockRoom({
      roomId: '!normal:matrix.org',
      dmInviter: undefined
    })
    const client = mockClient({ directMap: {} })
    expect(isDirectMessageRoomFromRoom(client, room)).toBe(false)
  })
})

describe('findDmCounterpart', () => {
  const member = (userId: string, membership = 'join') => ({ userId, membership })

  const roomWithMembers = (members: Array<{ userId: string; membership?: string }>): Room =>
    ({
      getMembers: () => members
    }) as unknown as Room

  it('returns the other joined member excluding self', () => {
    const room = roomWithMembers([member('@me:example.org'), member('@bob:example.org')])
    expect(findDmCounterpart(room, '@me:example.org')).toBe('@bob:example.org')
  })

  it('prefers joined member over invited member', () => {
    const room = roomWithMembers([
      member('@me:example.org'),
      member('@invited:example.org', 'invite'),
      member('@joined:example.org', 'join')
    ])
    expect(findDmCounterpart(room, '@me:example.org')).toBe('@joined:example.org')
  })

  it('falls back to invited member when counterpart has not joined yet (新建 DM)', () => {
    const room = roomWithMembers([member('@me:example.org'), member('@bob:example.org', 'invite')])
    expect(findDmCounterpart(room, '@me:example.org')).toBe('@bob:example.org')
  })

  it('falls back to any non-self member when membership state is incomplete', () => {
    const room = roomWithMembers([{ userId: '@me:example.org' }, { userId: '@bob:example.org' }])
    expect(findDmCounterpart(room, '@me:example.org')).toBe('@bob:example.org')
  })

  it('returns undefined when only self is in the room', () => {
    const room = roomWithMembers([member('@me:example.org')])
    expect(findDmCounterpart(room, '@me:example.org')).toBeUndefined()
  })

  it('returns undefined when room or members are unavailable', () => {
    expect(findDmCounterpart(null, '@me:example.org')).toBeUndefined()
    expect(findDmCounterpart(undefined, '@me:example.org')).toBeUndefined()
    const emptyRoom = {} as Room
    expect(findDmCounterpart(emptyRoom, '@me:example.org')).toBeUndefined()
  })

  it('falls back to getJoinedMembers/getMembersWithMembership when getMembers is unavailable', () => {
    const room = {
      getJoinedMembers: () => [member('@me:example.org')],
      getMembersWithMembership: (membership: string) =>
        membership === 'invite' ? [member('@bob:example.org', 'invite')] : []
    } as unknown as Room
    expect(findDmCounterpart(room, '@me:example.org')).toBe('@bob:example.org')
  })
})
