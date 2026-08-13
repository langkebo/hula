import { describe, expect, it } from 'vitest'
import { ACCOUNT_DATA } from '../accountData'

describe('ACCOUNT_DATA', () => {
  it('ROOM_ACCOUNT_DATA encodes all segments', () => {
    expect(ACCOUNT_DATA.ROOM_ACCOUNT_DATA('@u:server', '!r:server', 'm.tag')).toBe(
      '/user/%40u%3Aserver/rooms/!r%3Aserver/account_data/m.tag'
    )
  })

  it('USER_ACCOUNT_DATA encodes userId and type', () => {
    expect(ACCOUNT_DATA.USER_ACCOUNT_DATA('@u:server', 'm.room.a')).toBe('/user/%40u%3Aserver/account_data/m.room.a')
  })
})
