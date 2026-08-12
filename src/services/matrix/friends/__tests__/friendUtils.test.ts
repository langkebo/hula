import { describe, expect, it } from 'vitest'
import type { Friend, FriendRequest } from '@/services/matrix/sdk'
import type { SynapseFriendInfo, SynapseFriendRequest } from '../../extensions/SynapseFriendExtensionService'
import {
  getFriendUserId,
  getRequestUserId,
  normalizeFriend,
  normalizeSynapseFriendRequest,
  toFriendRequest,
  toUserId
} from '../friendUtils'

describe('getFriendUserId', () => {
  it('returns user_id from friend object', () => {
    const friend = { user_id: '@alice:matrix.org' } as Friend
    expect(getFriendUserId(friend)).toBe('@alice:matrix.org')
  })

  it('returns empty string when user_id is undefined', () => {
    const friend = { user_id: undefined } as unknown as Friend
    expect(getFriendUserId(friend)).toBe('')
  })
})

describe('getRequestUserId', () => {
  it('returns user_id from request object', () => {
    const request = { user_id: '@bob:matrix.org' } as FriendRequest
    expect(getRequestUserId(request)).toBe('@bob:matrix.org')
  })

  it('returns empty string when user_id is undefined', () => {
    const request = { user_id: undefined } as unknown as FriendRequest
    expect(getRequestUserId(request)).toBe('')
  })
})

describe('normalizeSynapseFriendRequest', () => {
  const baseRequest: SynapseFriendRequest = {
    request_id: 1,
    requester: '@alice:matrix.org',
    recipient: '@bob:matrix.org',
    message: 'Hi!',
    status: 'pending',
    created_ts: 1700000000
  }

  it('uses requester as user_id for incoming requests', () => {
    const result = normalizeSynapseFriendRequest(baseRequest, 'incoming')
    expect(result.user_id).toBe('@alice:matrix.org')
    expect(result.direction).toBe('incoming')
  })

  it('uses recipient as user_id for outgoing requests', () => {
    const result = normalizeSynapseFriendRequest(baseRequest, 'outgoing')
    expect(result.user_id).toBe('@bob:matrix.org')
    expect(result.direction).toBe('outgoing')
  })

  it('defaults to incoming direction', () => {
    const result = normalizeSynapseFriendRequest(baseRequest)
    expect(result.direction).toBe('incoming')
    expect(result.user_id).toBe('@alice:matrix.org')
  })

  it('maps declined status to rejected', () => {
    const declined: SynapseFriendRequest = { ...baseRequest, status: 'declined' }
    const result = normalizeSynapseFriendRequest(declined)
    expect(result.status).toBe('rejected')
  })

  it('preserves accepted status', () => {
    const accepted: SynapseFriendRequest = { ...baseRequest, status: 'accepted' }
    const result = normalizeSynapseFriendRequest(accepted)
    expect(result.status).toBe('accepted')
  })

  it('preserves pending status', () => {
    const result = normalizeSynapseFriendRequest(baseRequest)
    expect(result.status).toBe('pending')
  })

  it('preserves message and timestamp', () => {
    const result = normalizeSynapseFriendRequest(baseRequest)
    expect(result.message).toBe('Hi!')
    expect(result.timestamp).toBe(1700000000)
  })
})

describe('normalizeFriend', () => {
  it('normalizes a SynapseFriendInfo with displayname fallback', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@alice:matrix.org',
      displayname: 'Alice Display',
      avatar_url: 'mxc://matrix.org/abc',
      since: 1700000000,
      online: true
    }
    const result = normalizeFriend(apiFriend)
    expect(result.user_id).toBe('@alice:matrix.org')
    expect(result.display_name).toBe('Alice Display')
    expect(result.avatar_url).toBe('mxc://matrix.org/abc')
    expect(result.since).toBe(1700000000)
    expect(result.online).toBe(true)
  })

  it('falls back to username when display_name and displayname are absent', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@bob:matrix.org',
      username: 'bob_user',
      since: 0
    }
    const result = normalizeFriend(apiFriend)
    expect(result.display_name).toBe('bob_user')
  })

  it('prefers display_name over displayname and username', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@charlie:matrix.org',
      display_name: 'Charlie',
      displayname: 'Charlie D',
      username: 'charlie_u',
      since: 0
    }
    const result = normalizeFriend(apiFriend)
    expect(result.display_name).toBe('Charlie')
  })

  it('falls back to last_active_ts when since is absent', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@dave:matrix.org',
      since: undefined as unknown as number,
      last_active_ts: 1700001234
    }
    const result = normalizeFriend(apiFriend)
    expect(result.since).toBe(1700001234)
  })

  it('includes presence and username when present', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@eve:matrix.org',
      since: 0,
      presence: 'online',
      username: 'eve_user'
    }
    const result = normalizeFriend(apiFriend as unknown as Friend)
    expect(result.presence).toBe('online')
    expect(result.username).toBe('eve_user')
  })

  it('does not include online field when absent', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@frank:matrix.org',
      since: 0
    }
    const result = normalizeFriend(apiFriend as unknown as Friend)
    expect(result.online).toBeUndefined()
  })

  it('preserves note, status, and dm_room_id', () => {
    const apiFriend: SynapseFriendInfo = {
      user_id: '@grace:matrix.org',
      since: 0,
      note: 'close friend',
      status: 'favorite',
      dm_room_id: '!room:matrix.org'
    }
    const result = normalizeFriend(apiFriend)
    expect(result.note).toBe('close friend')
    expect(result.status).toBe('favorite')
    expect(result.dm_room_id).toBe('!room:matrix.org')
  })
})

describe('toUserId', () => {
  it('returns string values as-is', () => {
    expect(toUserId('@alice:matrix.org')).toBe('@alice:matrix.org')
    expect(toUserId('plain-string')).toBe('plain-string')
  })

  it('returns null for non-string values', () => {
    expect(toUserId(123)).toBeNull()
    expect(toUserId(null)).toBeNull()
    expect(toUserId(undefined)).toBeNull()
    expect(toUserId({ user_id: 'x' })).toBeNull()
    expect(toUserId([])).toBeNull()
  })
})

describe('toFriendRequest', () => {
  it('returns object values cast to FriendRequest', () => {
    const obj = { user_id: '@alice:matrix.org', status: 'pending' }
    const result = toFriendRequest(obj)
    expect(result).toEqual(obj)
  })

  it('returns null for null', () => {
    expect(toFriendRequest(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(toFriendRequest(undefined)).toBeNull()
  })

  it('returns null for primitive values', () => {
    expect(toFriendRequest('string')).toBeNull()
    expect(toFriendRequest(42)).toBeNull()
    expect(toFriendRequest(true)).toBeNull()
  })
})
