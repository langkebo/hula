import { describe, expect, it } from 'vitest'
import { FRIENDS } from '../friends'

describe('FRIENDS', () => {
  it('constant endpoints', () => {
    expect(FRIENDS.LIST).toBe('/_matrix/vendor/v1/friends')
    expect(FRIENDS.REQUEST).toBe('/_matrix/vendor/v1/friends/request')
    expect(FRIENDS.SEARCH).toBe('/_matrix/vendor/v1/friends/search')
    expect(FRIENDS.INCOMING_REQUESTS).toBe('/_matrix/vendor/v1/friends/requests/incoming')
    expect(FRIENDS.OUTGOING_REQUESTS).toBe('/_matrix/vendor/v1/friends/requests/outgoing')
  })

  it('interpolates userId without encoding', () => {
    expect(FRIENDS.ACCEPT('@u:server')).toBe('/_matrix/vendor/v1/friends/request/@u:server/accept')
    expect(FRIENDS.REJECT('@u:server')).toBe('/_matrix/vendor/v1/friends/request/@u:server/reject')
    expect(FRIENDS.CANCEL('@u:server')).toBe('/_matrix/vendor/v1/friends/request/@u:server/cancel')
    expect(FRIENDS.REMOVE('@u:server')).toBe('/_matrix/vendor/v1/friends/@u:server')
    expect(FRIENDS.NOTE('@u:server')).toBe('/_matrix/vendor/v1/friends/@u:server/note')
    expect(FRIENDS.CHECK('@u:server')).toBe('/_matrix/vendor/v1/friends/check/@u:server')
    expect(FRIENDS.DM('@u:server')).toBe('/_matrix/vendor/v1/friends/dm/@u:server')
    expect(FRIENDS.STATUS('@u:server')).toBe('/_matrix/vendor/v1/friends/@u:server/status')
  })
})
