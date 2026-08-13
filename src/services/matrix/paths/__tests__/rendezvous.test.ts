import { describe, expect, it } from 'vitest'
import { RENDEZVOUS } from '../rendezvous'

describe('RENDEZVOUS', () => {
  it('BASE constant', () => {
    expect(RENDEZVOUS.BASE).toBe('/_matrix/client/v1/rendezvous')
  })

  it('SESSION interpolates id without encoding', () => {
    expect(RENDEZVOUS.SESSION('a/b')).toBe('/_matrix/client/v1/rendezvous/a/b')
  })

  it('MESSAGES interpolates id without encoding', () => {
    expect(RENDEZVOUS.MESSAGES('a/b')).toBe('/_matrix/client/v1/rendezvous/a/b/messages')
  })
})
