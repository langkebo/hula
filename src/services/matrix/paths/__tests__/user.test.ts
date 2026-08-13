import { describe, expect, it } from 'vitest'
import { USER } from '../user'

describe('USER', () => {
  it('profile endpoints encode userId', () => {
    expect(USER.PROFILE('@u:server')).toBe('/profile/%40u%3Aserver')
    expect(USER.DISPLAYNAME('@u:server')).toBe('/profile/%40u%3Aserver/displayname')
    expect(USER.AVATAR('@u:server')).toBe('/profile/%40u%3Aserver/avatar_url')
  })

  it('MSC4133 extended profile endpoints', () => {
    expect(USER.EXTENDED_PROFILE('@u:server')).toBe('/uk.tcpip.msc4133/profile/%40u%3Aserver')
    expect(USER.EXTENDED_PROFILE_FIELD('@u:server', 'key name')).toBe(
      '/uk.tcpip.msc4133/profile/%40u%3Aserver/key%20name'
    )
  })

  it('presence and constants', () => {
    expect(USER.PRESENCE('@u:server')).toBe('/presence/%40u%3Aserver/status')
    expect(USER.DIRECTORY_SEARCH).toBe('/user_directory/search')
    expect(USER.DEVICES).toBe('/devices')
    expect(USER.TURN_SERVER).toBe('/voip/turnServer')
    expect(USER.PUBLIC_ROOMS).toBe('/publicRooms')
  })
})
