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

  // 2026-10-17 Batch C-0：getRtcTransports 实测已改调 SDK VoiceManager，
  // 路径常量生产零引用，已删除。此处锁定删除结果。
  it('不再包含已迁移到 VoiceManager 的 MSC4143 路径常量', () => {
    expect(VOICE).not.toHaveProperty('RTC_TRANSPORTS')
  })
})
