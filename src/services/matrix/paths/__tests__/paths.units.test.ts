import { describe, expect, it } from 'vitest'

import { AUTH } from '../auth'
import { NOTIFICATION } from '../notification'
import { PREFIX_V1, PREFIX_V3, PREFIX_VENDOR_V1 } from '../prefixes'
import { ROOM } from '../room'
import { VOICE } from '../voice'
import { WELL_KNOWN } from '../wellKnown'

describe('paths/prefixes', () => {
  it('PREFIX_V1 = /_matrix/client/v1', () => {
    expect(PREFIX_V1).toBe('/_matrix/client/v1')
  })

  it('PREFIX_V3 = /_matrix/client/v3', () => {
    expect(PREFIX_V3).toBe('/_matrix/client/v3')
  })
})

describe('paths/wellKnown', () => {
  it('CLIENT 指向 matrix client 发现端点', () => {
    expect(WELL_KNOWN.CLIENT).toBe('/.well-known/matrix/client')
  })

  it('OIDC_DISCOVERY 指向 openid-configuration', () => {
    expect(WELL_KNOWN.OIDC_DISCOVERY).toBe('/.well-known/openid-configuration')
  })
})

describe('paths/auth · QR 登录', () => {
  it('QR_GENERATE_TOKEN 使用 v1 前缀', () => {
    expect(AUTH.QR_GENERATE_TOKEN).toBe(`${PREFIX_V1}/login/qr_token`)
  })
})

// 2026-10-17 Batch C-0：room 路径常量由 37 键裁到 1 键 —— 其余端点已全部收敛到
// SDK manager（Timeline / State / Membership / Receipt / Pins / Aliases / Lifecycle /
// Tags / Typing / Room 等），生产零引用。
describe('paths/room · 仅存 vendor 私有端点', () => {
  it('REPORT_SCANNER_INFO 使用 vendor/v1 前缀并编码 eventId', () => {
    expect(ROOM.REPORT_SCANNER_INFO('!r:s', '$ev:1')).toBe(
      `${PREFIX_VENDOR_V1}/rooms/!r%3As/report/%24ev%3A1/scanner_info`
    )
  })
})

// 2026-10-17 Batch C-0：VOICE.RTC_TRANSPORTS 已删（getRtcTransports 改调 SDK VoiceManager），
// NOTIFICATION 的 PUSH_RULES / PUSHERS / PUSHERS_SET 已删（全部走 SDK PushManager）。
describe('paths/voice · 生产在用的 vendor/v1 端点', () => {
  it('CONFIG / UPLOAD 使用 vendor/v1 前缀', () => {
    expect(VOICE.CONFIG).toBe(`${PREFIX_VENDOR_V1}/voice/config`)
    expect(VOICE.UPLOAD).toBe(`${PREFIX_VENDOR_V1}/voice/upload`)
  })

  it('ROOM_LIST / USER_LIST / CONTENT 编码对应 id', () => {
    expect(VOICE.ROOM_LIST('!r:s')).toBe(`${PREFIX_VENDOR_V1}/voice/room/!r%3As`)
    expect(VOICE.USER_LIST('@u:s')).toBe(`${PREFIX_VENDOR_V1}/voice/user/%40u%3As`)
    expect(VOICE.CONTENT('m1')).toBe(`${PREFIX_VENDOR_V1}/voice/m1`)
  })
})

describe('paths/notification · 仅存 ack 端点', () => {
  it('NOTIFICATIONS_ACK 编码 notificationId', () => {
    expect(NOTIFICATION.NOTIFICATIONS_ACK('n1')).toBe('/notifications/n1/ack')
  })
})
