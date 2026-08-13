import { describe, expect, it } from 'vitest'
import { AUTH } from '../auth'

describe('AUTH', () => {
  it('QR token endpoint', () => {
    expect(AUTH.QR_GENERATE_TOKEN).toBe('/_matrix/client/v1/login/qr_token')
  })

  it('MSC4108 rendezvous endpoints', () => {
    expect(AUTH.MSC4108_CREATE_RENDEZVOUS).toBe('/_matrix/client/unstable/org.matrix.msc4108/rendezvous')
    expect(AUTH.MSC4108_RENDEZVOUS_SESSION('sess id')).toBe(
      '/_matrix/client/unstable/org.matrix.msc4108/rendezvous/sess%20id'
    )
  })
})
