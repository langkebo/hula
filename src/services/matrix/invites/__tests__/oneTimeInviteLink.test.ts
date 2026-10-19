import { describe, expect, it } from 'vitest'
import { extractInviteToken, formatInviteRemaining, isInviteExpired, remainingInviteMs } from '../oneTimeInviteLink'

// F-5：一次性邀请链接解析。
//
// 最要紧的一条：后端返回的 deep_link 指向 **POST-only** 的 claim 接口，
// 直接点开不会生效。所以 UI 必须能从"粘贴的一坨文本"里取出 token。

// 32B base64url（无填充）= 43 字符
const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW'

describe('extractInviteToken', () => {
  it('纯 token 原样返回', () => {
    expect(extractInviteToken(TOKEN)).toBe(TOKEN)
  })

  it('从后端 deep_link 里取出 token', () => {
    const link = `https://hs.example/_matrix/vendor/v1/invites/claim?token=${TOKEN}`
    expect(extractInviteToken(link)).toBe(TOKEN)
  })

  it('允许多余的 query 参数与前后空白', () => {
    const link = `  https://hs.example/claim?foo=1&token=${TOKEN}&bar=2  `
    expect(extractInviteToken(link)).toBe(TOKEN)
  })

  it('无 scheme 的分享文本也能解析', () => {
    expect(extractInviteToken(`hs.example/claim?token=${TOKEN}`)).toBe(TOKEN)
  })

  it('空串 / 无关文本 / 过短 token 返回 null', () => {
    expect(extractInviteToken('')).toBeNull()
    expect(extractInviteToken('   ')).toBeNull()
    expect(extractInviteToken('看看这个 https://example.com/abc')).toBeNull()
    expect(extractInviteToken('?token=short')).toBeNull()
  })
})

describe('有效期辅助', () => {
  const NOW = 1_700_000_000_000

  it('过期判定以传入的 now 为准', () => {
    expect(isInviteExpired(NOW - 1, NOW)).toBe(true)
    expect(isInviteExpired(NOW, NOW)).toBe(true)
    expect(isInviteExpired(NOW + 1, NOW)).toBe(false)
  })

  it('非法时间戳视为已过期（不能让 NaN 显示成"无限有效"）', () => {
    expect(isInviteExpired(Number.NaN, NOW)).toBe(true)
    expect(remainingInviteMs(Number.NaN, NOW)).toBe(0)
  })

  it('剩余时间不为负', () => {
    expect(remainingInviteMs(NOW - 5_000, NOW)).toBe(0)
    expect(remainingInviteMs(NOW + 90_000, NOW)).toBe(90_000)
  })

  it('格式化：不足 1 分按 1 分显示，避免"剩余 0 分"却还能用', () => {
    expect(formatInviteRemaining(10_000)).toEqual({ hours: 0, minutes: 1 })
    expect(formatInviteRemaining(90 * 60_000)).toEqual({ hours: 1, minutes: 30 })
    expect(formatInviteRemaining(24 * 3600_000)).toEqual({ hours: 24, minutes: 0 })
  })
})
