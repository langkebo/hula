import { describe, expect, it } from 'vitest'
import { NOTIFICATION } from '../notification'

describe('NOTIFICATION', () => {
  it('constants', () => {
    expect(NOTIFICATION.PUSH_RULES).toBe('/pushrules/')
    expect(NOTIFICATION.NOTIFICATIONS).toBe('/notifications')
    expect(NOTIFICATION.PUSHERS).toBe('/pushers')
    expect(NOTIFICATION.PUSHERS_SET).toBe('/pushers/set')
  })

  it('NOTIFICATIONS_ACK encodes id', () => {
    expect(NOTIFICATION.NOTIFICATIONS_ACK('n1')).toBe('/notifications/n1/ack')
  })
})
