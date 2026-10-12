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

describe('paths/auth · MSC4108 QR 登录', () => {
  it('QR_GENERATE_TOKEN 使用 v1 前缀', () => {
    expect(AUTH.QR_GENERATE_TOKEN).toBe(`${PREFIX_V1}/login/qr_token`)
  })

  it('MSC4108_CREATE_RENDEZVOUS 使用 unstable 前缀', () => {
    expect(AUTH.MSC4108_CREATE_RENDEZVOUS).toBe('/_matrix/client/unstable/org.matrix.msc4108/rendezvous')
  })

  it('MSC4108_RENDEZVOUS_SESSION 拼接并编码 sessionId', () => {
    expect(AUTH.MSC4108_RENDEZVOUS_SESSION('abc 123')).toBe(
      '/_matrix/client/unstable/org.matrix.msc4108/rendezvous/abc%20123'
    )
  })
})

describe('paths/room · 字符串常量', () => {
  it('CREATE 路径', () => {
    expect(ROOM.CREATE).toBe('/createRoom')
  })

  it('JOIN 编码 roomId', () => {
    expect(ROOM.JOIN('!abc:server')).toBe('/rooms/!abc%3Aserver/join')
  })

  it('LEAVE 编码 roomId', () => {
    expect(ROOM.LEAVE('!abc:server')).toBe('/rooms/!abc%3Aserver/leave')
  })

  it('INVITE 编码 roomId', () => {
    expect(ROOM.INVITE('!abc:server')).toBe('/rooms/!abc%3Aserver/invite')
  })

  it('KNOCK 编码 roomIdOrAlias（位于 /knock 路径段）', () => {
    expect(ROOM.KNOCK('!abc:server')).toBe('/knock/!abc%3Aserver')
  })

  it('JOIN_BY_ALIAS 编码 roomIdOrAlias（位于 /join 路径段）', () => {
    expect(ROOM.JOIN_BY_ALIAS('#alias:server')).toBe('/join/%23alias%3Aserver')
  })
})

describe('paths/room · 函数式路径（参数编码）', () => {
  it('MESSAGES 编码 roomId', () => {
    expect(ROOM.MESSAGES('!room:svr')).toBe('/rooms/!room%3Asvr/messages')
  })

  it('STATE 编码 roomId', () => {
    expect(ROOM.STATE('!room:svr')).toBe('/rooms/!room%3Asvr/state')
  })

  it('MEMBERS 编码 roomId', () => {
    expect(ROOM.MEMBERS('!room:svr')).toBe('/rooms/!room%3Asvr/members')
  })

  it('SEND_EVENT 同时编码 roomId / eventType / txnId', () => {
    const path = ROOM.SEND_EVENT('!r:s', 'm.room.message', 'tx1/2')
    expect(path).toBe('/rooms/!r%3As/send/m.room.message/tx1%2F2')
  })

  it('RECEIPT 编码 receiptType / eventId', () => {
    const path = ROOM.RECEIPT('!r:s', 'm.read', '$ev:1')
    expect(path).toBe('/rooms/!r%3As/receipt/m.read/%24ev%3A1')
  })

  it('TYPING 编码 userId', () => {
    expect(ROOM.TYPING('!r:s', '@u:home')).toBe('/rooms/!r%3As/typing/%40u%3Ahome')
  })

  it('REDACT 编码 eventId 与 txnId', () => {
    expect(ROOM.REDACT('!r:s', '$ev:1', 't1')).toBe('/rooms/!r%3As/redact/%24ev%3A1/t1')
  })

  it('CONTEXT 编码 eventId', () => {
    expect(ROOM.CONTEXT('!r:s', '$ev:1')).toBe('/rooms/!r%3As/context/%24ev%3A1')
  })
})

describe('paths/room · v1 前缀路径', () => {
  it('TIMESTAMP_TO_EVENT 使用 v1 前缀并编码 roomId', () => {
    expect(ROOM.TIMESTAMP_TO_EVENT('!r:s')).toBe(`${PREFIX_V1}/rooms/!r%3As/timestamp_to_event`)
  })

  it('REPORT_SCANNER_INFO 使用 vendor/v1 前缀并编码 eventId', () => {
    expect(ROOM.REPORT_SCANNER_INFO('!r:s', '$ev:1')).toBe(
      `${PREFIX_VENDOR_V1}/rooms/!r%3As/report/%24ev%3A1/scanner_info`
    )
  })
})

describe('paths/room · 其它路径', () => {
  it('NOTIFICATIONS 编码 roomId', () => {
    expect(ROOM.NOTIFICATIONS('!r:s')).toBe('/rooms/!r%3As/notifications')
  })

  it('UNREAD_COUNT 编码 roomId', () => {
    expect(ROOM.UNREAD_COUNT('!r:s')).toBe('/rooms/!r%3As/unread_count')
  })

  it('TIMELINE 编码 roomId', () => {
    expect(ROOM.TIMELINE('!r:s')).toBe('/rooms/!r%3As/timeline')
  })

  it('PINNED_EVENTS 编码 roomId', () => {
    expect(ROOM.PINNED_EVENTS('!r:s')).toBe('/rooms/!r%3As/pinned_events')
  })

  it('PINNED_EVENT_BY_ID 编码 roomId 与 eventId', () => {
    expect(ROOM.PINNED_EVENT_BY_ID('!r:s', '$ev:1')).toBe('/rooms/!r%3As/pinned_events/%24ev%3A1')
  })

  it('CAPABILITIES 编码 roomId', () => {
    expect(ROOM.CAPABILITIES('!r:s')).toBe('/rooms/!r%3As/capabilities')
  })

  it('PERMISSIONS 编码 roomId', () => {
    expect(ROOM.PERMISSIONS('!r:s')).toBe('/rooms/!r%3As/permissions')
  })

  it('ALIASES 编码 roomId', () => {
    expect(ROOM.ALIASES('!r:s')).toBe('/rooms/!r%3As/aliases')
  })

  it('UPGRADE 编码 roomId', () => {
    expect(ROOM.UPGRADE('!r:s')).toBe('/rooms/!r%3As/upgrade')
  })

  it('READ_MARKERS 编码 roomId', () => {
    expect(ROOM.READ_MARKERS('!r:s')).toBe('/rooms/!r%3As/read_markers')
  })

  it('METADATA 编码 roomId', () => {
    expect(ROOM.METADATA('!r:s')).toBe('/rooms/!r%3As/metadata')
  })

  it('TURN_SERVER 编码 roomId', () => {
    expect(ROOM.TURN_SERVER('!r:s')).toBe('/rooms/!r%3As/turn_server')
  })

  it('ROOM_SYNC 编码 roomId', () => {
    expect(ROOM.ROOM_SYNC('!r:s')).toBe('/rooms/!r%3As/sync')
  })

  it('CALL 编码 roomId 与 callId', () => {
    expect(ROOM.CALL('!r:s', 'call123')).toBe('/rooms/!r%3As/call/call123')
  })

  it('SUMMARY_MEMBERS 编码 roomId', () => {
    expect(ROOM.SUMMARY_MEMBERS('!r:s')).toBe('/rooms/!r%3As/summary/members')
  })

  it('SUMMARY_STATE 编码 roomId', () => {
    expect(ROOM.SUMMARY_STATE('!r:s')).toBe('/rooms/!r%3As/summary/state')
  })

  it('TAGS 编码 roomId 与 userId', () => {
    expect(ROOM.TAGS('!r:s', '@u:home')).toBe('/user/%40u%3Ahome/rooms/!r%3As/tags')
  })

  it('SIGN_EVENT 编码 roomId 与 eventId（FT-089: P2-8 事件签名）', () => {
    expect(ROOM.SIGN_EVENT('!r:s', '$ev:1')).toBe('/rooms/!r%3As/sign/%24ev%3A1')
  })

  it('VERIFY_EVENT 编码 roomId 与 eventId（FT-089: P2-8 事件验证）', () => {
    expect(ROOM.VERIFY_EVENT('!r:s', '$ev:1')).toBe('/rooms/!r%3As/verify/%24ev%3A1')
  })

  it('MESSAGE_QUEUE 编码 roomId（FT-089: P2-6 消息队列）', () => {
    expect(ROOM.MESSAGE_QUEUE('!r:s')).toBe('/rooms/!r%3As/message_queue')
  })

  it('ENCRYPTED_EVENTS 编码 roomId（FT-089: P2-9 加密事件列表）', () => {
    expect(ROOM.ENCRYPTED_EVENTS('!r:s')).toBe('/rooms/!r%3As/encrypted_events')
  })
})

describe('paths/voice · MSC4143 RTC transports（FT-096）', () => {
  it('RTC_TRANSPORTS 指向 unstable MSC4143 路径', () => {
    expect(VOICE.RTC_TRANSPORTS).toBe('/_matrix/client/unstable/org.matrix.msc4143/rtc/transports')
  })
})

describe('paths/notification · pushers 路径常量（FT-088）', () => {
  it('PUSH_RULES 带尾斜杠前缀', () => {
    expect(NOTIFICATION.PUSH_RULES).toBe('/pushrules/')
  })

  it('PUSHERS 指向 pushers 端点', () => {
    expect(NOTIFICATION.PUSHERS).toBe('/pushers')
  })

  it('PUSHERS_SET 指向 pushers/set 端点', () => {
    expect(NOTIFICATION.PUSHERS_SET).toBe('/pushers/set')
  })
})
