import { describe, expect, it } from 'vitest'
import { VOICE } from '../voice'

describe('VOICE', () => {
  it('PREFIX_VENDOR_V1 constants', () => {
    expect(VOICE.CONFIG).toBe('/_matrix/vendor/v1/voice/config')
    expect(VOICE.UPLOAD).toBe('/_matrix/vendor/v1/voice/upload')
    expect(VOICE.CONVERT).toBe('/_matrix/vendor/v1/voice/convert')
    expect(VOICE.OPTIMIZE).toBe('/_matrix/vendor/v1/voice/optimize')
    expect(VOICE.TRANSCRIPTION).toBe('/_matrix/vendor/v1/voice/transcription')
  })

  it('parameterized endpoints encode ids', () => {
    expect(VOICE.ROOM_LIST('!r:server')).toBe('/_matrix/vendor/v1/voice/room/!r%3Aserver')
    expect(VOICE.USER_LIST('@u:server')).toBe('/_matrix/vendor/v1/voice/user/%40u%3Aserver')
    expect(VOICE.CONTENT('m1')).toBe('/_matrix/vendor/v1/voice/m1')
  })

  it('MSC4143 RTC transports', () => {
    expect(VOICE.RTC_TRANSPORTS).toBe('/_matrix/client/unstable/org.matrix.msc4143/rtc/transports')
  })
})
