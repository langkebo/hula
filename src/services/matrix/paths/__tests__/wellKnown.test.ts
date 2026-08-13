import { describe, expect, it } from 'vitest'
import { WELL_KNOWN } from '../wellKnown'

describe('WELL_KNOWN', () => {
  it('constants', () => {
    expect(WELL_KNOWN.CLIENT).toBe('/.well-known/matrix/client')
    expect(WELL_KNOWN.OIDC_DISCOVERY).toBe('/.well-known/openid-configuration')
  })
})
