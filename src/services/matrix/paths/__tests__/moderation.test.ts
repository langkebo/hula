import { describe, expect, it } from 'vitest'
import { MODERATION } from '../moderation'

describe('MODERATION', () => {
  it('REPORT_EVENT_SCORE uses v1 prefix when version v1', () => {
    expect(MODERATION.REPORT_EVENT_SCORE('v1', '!r:server', '$e')).toBe(
      '/_matrix/client/v1/rooms/!r%3Aserver/report/%24e/score'
    )
  })

  it('REPORT_EVENT_SCORE uses v3 prefix when version v3', () => {
    expect(MODERATION.REPORT_EVENT_SCORE('v3', '!r:server', '$e')).toBe(
      '/_matrix/client/v3/rooms/!r%3Aserver/report/%24e/score'
    )
  })

  it('REPORT_ROOM builds MSC4260 v3 endpoint', () => {
    expect(MODERATION.REPORT_ROOM('!r:server')).toBe('/_matrix/client/v3/rooms/!r%3Aserver/report')
  })
})
