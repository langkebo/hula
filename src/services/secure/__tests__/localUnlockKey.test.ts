import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearLocalUnlock,
  configureLocalUnlock,
  getLocalUnlockStorageKey,
  isLocalUnlockConfigured,
  isLocalUnlockUnlocked,
  LOCAL_UNLOCK_VERIFIER_STORAGE_KEY,
  lockLocalUnlock,
  unlockLocalUnlock
} from '../localUnlockKey'

// F-4 / B2：本地解锁密码。
//
// 最要紧的三条性质：
// 1. **storageKey 只存在于内存**，落盘的只有 verifier；
// 2. 同一密码 + 同一盐导出同一把密钥（否则重启后旧 store 打不开）；
// 3. 密钥必须 32 字节 —— initRustCrypto 不接受更短的。

const PASSWORD = 'correct horse battery staple'

describe('localUnlockKey（B2）', () => {
  beforeEach(() => {
    clearLocalUnlock()
    localStorage.clear()
  })

  it('未配置时不认为已配置，也没有 storageKey', () => {
    expect(isLocalUnlockConfigured()).toBe(false)
    expect(getLocalUnlockStorageKey()).toBeNull()
    expect(isLocalUnlockUnlocked()).toBe(false)
  })

  it('配置后派生 32 字节 storageKey 并当场解锁', async () => {
    await configureLocalUnlock(PASSWORD)

    const key = getLocalUnlockStorageKey()
    expect(isLocalUnlockConfigured()).toBe(true)
    expect(isLocalUnlockUnlocked()).toBe(true)
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key!.length).toBe(32)
  })

  it('落盘的只有 verifier，绝不含 storageKey', async () => {
    await configureLocalUnlock(PASSWORD)

    const stored = localStorage.getItem(LOCAL_UNLOCK_VERIFIER_STORAGE_KEY)
    expect(stored).toBeTruthy()
    const parts = stored!.split('$')
    expect(parts[0]).toBe('pbkdf2-sha256-64')
    expect(parts.length).toBe(4)

    const key = getLocalUnlockStorageKey()!
    const keyB64 = btoa(String.fromCharCode(...key))
    expect(stored).not.toContain(keyB64)
  })

  it('同一密码重新解锁派生出同一把密钥（重启后旧 store 仍可打开）', async () => {
    await configureLocalUnlock(PASSWORD)
    const first = getLocalUnlockStorageKey()!

    lockLocalUnlock()
    expect(isLocalUnlockUnlocked()).toBe(false)

    await expect(unlockLocalUnlock(PASSWORD)).resolves.toBe(true)
    const second = getLocalUnlockStorageKey()!

    expect(Array.from(second)).toEqual(Array.from(first))
  })

  it('密码错误时拒绝解锁，且不留下任何密钥', async () => {
    await configureLocalUnlock(PASSWORD)
    lockLocalUnlock()

    await expect(unlockLocalUnlock('wrong password')).resolves.toBe(false)
    expect(isLocalUnlockUnlocked()).toBe(false)
    expect(getLocalUnlockStorageKey()).toBeNull()
    // verifier 仍在：用户还能再试
    expect(isLocalUnlockConfigured()).toBe(true)
  })

  it('未配置时 unlock 直接失败（不能凭空虚造密钥）', async () => {
    await expect(unlockLocalUnlock(PASSWORD)).resolves.toBe(false)
    expect(getLocalUnlockStorageKey()).toBeNull()
  })

  it('lock 只清内存，配置保留；clear 才彻底移除', async () => {
    await configureLocalUnlock(PASSWORD)

    lockLocalUnlock()
    expect(isLocalUnlockConfigured()).toBe(true)
    expect(getLocalUnlockStorageKey()).toBeNull()

    clearLocalUnlock()
    expect(isLocalUnlockConfigured()).toBe(false)
    expect(localStorage.getItem(LOCAL_UNLOCK_VERIFIER_STORAGE_KEY)).toBeNull()
  })

  it('getLocalUnlockStorageKey 返回副本：改动它不会污染内部密钥', async () => {
    await configureLocalUnlock(PASSWORD)
    const copy = getLocalUnlockStorageKey()!
    copy.fill(0)

    const again = getLocalUnlockStorageKey()!
    expect(again.some((byte) => byte !== 0)).toBe(true)
  })
})
