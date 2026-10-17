import { describe, expect, it } from 'vitest'
import { ROOM } from '../room'

describe('ROOM', () => {
  it('仅保留 vendor 私有的 scanner_info 端点', () => {
    // scanner_info 属私有扩展面 ⇒ vendor/v1（后端只在 vendor/v1 注册；v1 形态零命中）
    expect(ROOM.REPORT_SCANNER_INFO('!r', '$e')).toBe('/_matrix/vendor/v1/rooms/!r/report/%24e/scanner_info')
  })

  // 2026-10-17 Batch C-0：36 个 room 路径常量生产零引用，已全部收敛到 SDK manager
  // （Timeline / State / Membership / Receipt / Pins / Aliases / Lifecycle / Tags / Typing / Room 等）。
  // 此处锁定删除结果，防止维护者误将自研路径重新引入。
  it('不再包含已收敛到 SDK manager 的自研路径常量', () => {
    for (const dead of [
      'CREATE',
      'MESSAGES',
      'STATE',
      'MEMBERS',
      'SEND_EVENT',
      'RECEIPT',
      'TYPING',
      'REDACT',
      'INVITE',
      'JOIN',
      'LEAVE',
      'CONTEXT',
      'TAGS',
      'SUMMARY_MEMBERS',
      'SUMMARY_STATE',
      'TIMESTAMP_TO_EVENT',
      'NOTIFICATIONS',
      'UNREAD_COUNT',
      'TIMELINE',
      'PINNED_EVENTS',
      'PINNED_EVENT_BY_ID',
      'CAPABILITIES',
      'PERMISSIONS',
      'ALIASES',
      'UPGRADE',
      'KNOCK',
      'JOIN_BY_ALIAS',
      'READ_MARKERS',
      'METADATA',
      'TURN_SERVER',
      'ROOM_SYNC',
      'CALL',
      'SIGN_EVENT',
      'VERIFY_EVENT',
      'MESSAGE_QUEUE',
      'ENCRYPTED_EVENTS'
    ]) {
      expect(ROOM).not.toHaveProperty(dead)
    }
  })
})
