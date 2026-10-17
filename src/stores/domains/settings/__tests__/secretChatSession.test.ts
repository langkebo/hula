import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSecretChatDbKey,
  isSecretChatUnlocked,
  lockSecretChatSession,
  onSecretChatLocked,
  resetSecretChatSessionForTest,
  startSecretChatAutoLock,
  stopSecretChatAutoLock,
  touchSecretChatSession,
  unlockSecretChatSession
} from '../secretChatSession'

describe('secretChatSession', () => {
  beforeEach(() => {
    resetSecretChatSessionForTest()
    vi.useFakeTimers()
  })

  afterEach(() => {
    resetSecretChatSessionForTest()
    vi.useRealTimers()
  })

  it('初始为锁定态', () => {
    expect(isSecretChatUnlocked()).toBe(false)
    expect(getSecretChatDbKey()).toBeNull()
  })

  it('解锁后暴露 dbKey，上锁后清零', () => {
    const key = new Uint8Array([1, 2, 3, 4])
    unlockSecretChatSession(key)

    expect(isSecretChatUnlocked()).toBe(true)
    expect(getSecretChatDbKey()).toBe(key)

    lockSecretChatSession()
    expect(isSecretChatUnlocked()).toBe(false)
    expect(getSecretChatDbKey()).toBeNull()
    // 原引用必须被就地清零，否则残留副本仍可用于解密
    expect(Array.from(key)).toEqual([0, 0, 0, 0])
  })

  it('重复解锁会先清零旧密钥，避免泄漏', () => {
    const first = new Uint8Array([9, 9])
    unlockSecretChatSession(first)
    const second = new Uint8Array([7, 7])
    unlockSecretChatSession(second)

    expect(Array.from(first)).toEqual([0, 0])
    expect(getSecretChatDbKey()).toBe(second)
  })

  it('锁定会通知监听方，注销后不再通知', () => {
    const listener = vi.fn()
    const off = onSecretChatLocked(listener)

    unlockSecretChatSession(new Uint8Array([1]))
    lockSecretChatSession('测试')
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    unlockSecretChatSession(new Uint8Array([1]))
    lockSecretChatSession('测试')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('已锁定时重复上锁不重复通知', () => {
    const listener = vi.fn()
    onSecretChatLocked(listener)
    lockSecretChatSession()
    lockSecretChatSession()
    expect(listener).not.toHaveBeenCalled()
  })

  it('空闲超时自动上锁', () => {
    unlockSecretChatSession(new Uint8Array([1]))
    startSecretChatAutoLock(() => 1) // 1 分钟

    // 巡检间隔 30s：推进 2 个间隔 + 超过 1 分钟空闲
    vi.advanceTimersByTime(30_000)
    expect(isSecretChatUnlocked()).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(isSecretChatUnlocked()).toBe(false)

    stopSecretChatAutoLock()
  })

  it('活动会刷新空闲计时', () => {
    unlockSecretChatSession(new Uint8Array([1]))
    startSecretChatAutoLock(() => 1)

    vi.advanceTimersByTime(45_000)
    touchSecretChatSession()
    vi.advanceTimersByTime(45_000)
    expect(isSecretChatUnlocked()).toBe(true)

    stopSecretChatAutoLock()
  })
})
