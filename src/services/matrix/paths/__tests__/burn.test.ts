import { describe, expect, it } from 'vitest'
import { BURN } from '../burn'

describe('BURN', () => {
  it('STATS constant', () => {
    expect(BURN.STATS).toBe('/user/burn/stats')
  })

  it('ROOM_BURN encodes roomId', () => {
    expect(BURN.ROOM_BURN('!r:server')).toBe('/rooms/!r%3Aserver/burn')
  })
})
