import { describe, expect, it } from 'vitest'
import { AUTH } from '../auth'

describe('AUTH', () => {
  it('QR token endpoint', () => {
    expect(AUTH.QR_GENERATE_TOKEN).toBe('/_matrix/client/v1/login/qr_token')
  })

  // 2026-10-17 Batch C-0：MSC4108 rendezvous 由 SDK `MSC4108RendezvousSession` 内部实现，
  // Tjg 侧两个路径常量生产零引用，已删除。此处锁定删除结果。
  it('不再包含由 SDK 内部实现的 MSC4108 路径常量', () => {
    for (const dead of ['MSC4108_CREATE_RENDEZVOUS', 'MSC4108_RENDEZVOUS_SESSION']) {
      expect(AUTH).not.toHaveProperty(dead)
    }
  })
})
