import { describe, expect, it } from 'vitest'
import { GUEST } from '../guest'

describe('GUEST', () => {
  it('constants', () => {
    expect(GUEST.REGISTER).toBe('/register/guest')
    expect(GUEST.LOGIN).toBe('/login')
    expect(GUEST.INFO).toBe('/account/guest')
  })
})
