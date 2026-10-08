import { describe, expect, it } from 'vitest'
import { CRYPTO } from '../crypto'

describe('CRYPTO', () => {
  it('room keys endpoints', () => {
    expect(CRYPTO.ROOM_KEYS_RECOVER).toBe('/room_keys/recover')
    expect(CRYPTO.ROOM_KEYS_REQUEST).toBe('/room_keys/request')
  })
})
