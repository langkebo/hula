import { describe, expect, it } from 'vitest'
import { ROOM } from '../room'

describe('ROOM', () => {
  it('CREATE constant', () => {
    expect(ROOM.CREATE).toBe('/createRoom')
  })

  it('single-param room endpoints encode roomId', () => {
    expect(ROOM.MESSAGES('!r:server')).toBe('/rooms/!r%3Aserver/messages')
    expect(ROOM.STATE('!r:server')).toBe('/rooms/!r%3Aserver/state')
    expect(ROOM.MEMBERS('!r:server')).toBe('/rooms/!r%3Aserver/members')
    expect(ROOM.INVITE('!r:server')).toBe('/rooms/!r%3Aserver/invite')
    expect(ROOM.JOIN('!r:server')).toBe('/rooms/!r%3Aserver/join')
    expect(ROOM.LEAVE('!r:server')).toBe('/rooms/!r%3Aserver/leave')
    expect(ROOM.ANTI_SCREENSHOT('!r:server')).toBe('/rooms/!r%3Aserver/anti_screenshot')
    expect(ROOM.SUMMARY_MEMBERS('!r:server')).toBe('/rooms/!r%3Aserver/summary/members')
    expect(ROOM.SUMMARY_STATE('!r:server')).toBe('/rooms/!r%3Aserver/summary/state')
    expect(ROOM.NOTIFICATIONS('!r:server')).toBe('/rooms/!r%3Aserver/notifications')
    expect(ROOM.UNREAD_COUNT('!r:server')).toBe('/rooms/!r%3Aserver/unread_count')
    expect(ROOM.TIMELINE('!r:server')).toBe('/rooms/!r%3Aserver/timeline')
    expect(ROOM.PERMISSIONS('!r:server')).toBe('/rooms/!r%3Aserver/permissions')
    expect(ROOM.METADATA('!r:server')).toBe('/rooms/!r%3Aserver/metadata')
    expect(ROOM.TURN_SERVER('!r:server')).toBe('/rooms/!r%3Aserver/turn_server')
    expect(ROOM.ROOM_SYNC('!r:server')).toBe('/rooms/!r%3Aserver/sync')
    expect(ROOM.VAULT_DATA('!r:server')).toBe('/rooms/!r%3Aserver/vault_data')
    expect(ROOM.MESSAGE_QUEUE('!r:server')).toBe('/rooms/!r%3Aserver/message_queue')
    expect(ROOM.ENCRYPTED_EVENTS('!r:server')).toBe('/rooms/!r%3Aserver/encrypted_events')
  })

  it('multi-param endpoints encode each segment', () => {
    expect(ROOM.SEND_EVENT('!r', 'm.room.message', 't1')).toBe('/rooms/!r/send/m.room.message/t1')
    expect(ROOM.RECEIPT('!r', 'm.read', '$e')).toBe('/rooms/!r/receipt/m.read/%24e')
    expect(ROOM.TYPING('!r', '@u:server')).toBe('/rooms/!r/typing/%40u%3Aserver')
    expect(ROOM.REDACT('!r', '$e', 't1')).toBe('/rooms/!r/redact/%24e/t1')
    expect(ROOM.CONTEXT('!r', '$e')).toBe('/rooms/!r/context/%24e')
    expect(ROOM.TAGS('!r', '@u')).toBe('/user/%40u/rooms/!r/tags')
    expect(ROOM.CALL('!r', 'c1')).toBe('/rooms/!r/call/c1')
    expect(ROOM.SIGN_EVENT('!r', '$e')).toBe('/rooms/!r/sign/%24e')
    expect(ROOM.VERIFY_EVENT('!r', '$e')).toBe('/rooms/!r/verify/%24e')
  })

  it('PREFIX_V1 endpoints', () => {
    expect(ROOM.TIMESTAMP_TO_EVENT('!r')).toBe('/_matrix/client/v1/rooms/!r/timestamp_to_event')
    expect(ROOM.REPORT_SCANNER_INFO('!r', '$e')).toBe('/_matrix/client/v1/rooms/!r/report/%24e/scanner_info')
  })

  it('no-rooms-prefix endpoints', () => {
    expect(ROOM.KNOCK('#alias:server')).toBe('/knock/%23alias%3Aserver')
    expect(ROOM.JOIN_BY_ALIAS('#alias:server')).toBe('/join/%23alias%3Aserver')
  })
})
