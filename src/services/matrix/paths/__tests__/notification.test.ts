import { describe, expect, it } from 'vitest'
import { NOTIFICATION } from '../notification'

describe('NOTIFICATION', () => {
  it('NOTIFICATIONS_ACK encodes id', () => {
    expect(NOTIFICATION.NOTIFICATIONS_ACK('n1')).toBe('/notifications/n1/ack')
  })

  // 2026-10-17 Batch C-0：推送规则与 Pusher 全部走 SDK PushManager，
  // 4 个自研路径常量生产零引用，已删除。此处锁定删除结果。
  it('不再包含已收敛到 PushManager 的推送路径常量', () => {
    for (const dead of ['PUSH_RULES', 'NOTIFICATIONS', 'PUSHERS', 'PUSHERS_SET']) {
      expect(NOTIFICATION).not.toHaveProperty(dead)
    }
  })
})
