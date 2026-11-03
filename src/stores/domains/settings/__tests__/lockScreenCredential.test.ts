import { describe, expect, it } from 'vitest'
import { createLockScreenVerifier, setLockScreenPassword, verifyLockScreenVerifier } from '../lockScreenCredential'

describe('lockScreenCredential', () => {
  it('设置密码写入 verifier 并开启锁屏', async () => {
    const state = { enable: false, passwordHash: '' }
    await setLockScreenPassword(state, 'pass-123456')

    expect(state.enable).toBe(true)
    expect(state.passwordHash.startsWith('lock-screen:')).toBe(true)
    await expect(verifyLockScreenVerifier('pass-123456', state.passwordHash)).resolves.toBe(true)
  })

  it('创建的凭据带 lock-screen 前缀且不包含明文密码', async () => {
    const encoded = await createLockScreenVerifier('pass-123456')
    expect(encoded.startsWith('lock-screen:')).toBe(true)
    expect(encoded).not.toContain('pass-123456')
  })

  it('正确密码校验通过，错误密码失败', async () => {
    const encoded = await createLockScreenVerifier('pass-123456')
    await expect(verifyLockScreenVerifier('pass-123456', encoded)).resolves.toBe(true)
    await expect(verifyLockScreenVerifier('wrong', encoded)).resolves.toBe(false)
  })

  it('空串、缺失前缀、损坏载荷一律失败且不抛异常', async () => {
    await expect(verifyLockScreenVerifier('x', '')).resolves.toBe(false)
    await expect(verifyLockScreenVerifier('x', 'pbkdf2-sha256$1$a$b')).resolves.toBe(false)
    await expect(verifyLockScreenVerifier('x', 'lock-screen:broken')).resolves.toBe(false)
  })
})
