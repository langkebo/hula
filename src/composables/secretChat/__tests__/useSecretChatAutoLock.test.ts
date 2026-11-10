import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSecretChatUnlocked,
  resetSecretChatSessionForTest,
  unlockSecretChatSession
} from '@/stores/domains/settings/secretChatSession'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useSecretChatAutoLock } from '../useSecretChatAutoLock'

/**
 * 私密聊天自动锁定接线。
 *
 * `secretChatSession` 里的巡检本身有单测，但此前**生产代码从未调用 start/touch**，
 * 所以设置页的「离开自动锁定」开关完全空转。本用例锁住接线行为：
 * 超时上锁 / 关闭开关不上锁 / 活动刷新计时 / dispose 后不再上锁。
 */
describe('useSecretChatAutoLock', () => {
  /** happy-dom 的 `visibilityState` 只读，用可配置 getter 模拟。 */
  let visibilityState: DocumentVisibilityState = 'visible'

  function setVisibilityState(state: DocumentVisibilityState) {
    visibilityState = state
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    })
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    resetSecretChatSessionForTest()
    setVisibilityState('visible')
    vi.useFakeTimers()
  })

  afterEach(() => {
    resetSecretChatSessionForTest()
    setVisibilityState('visible')
    vi.useRealTimers()
  })

  function configure(autoLock: boolean, lockTimeoutMinutes: number) {
    const setting = useSettingStore()
    setting.setSecretChatAutoLock(autoLock)
    setting.setSecretChatLockTimeout(lockTimeoutMinutes)
  }

  it('开启自动锁：空闲超时后上锁', () => {
    configure(true, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    vi.advanceTimersByTime(30_000)
    expect(isSecretChatUnlocked()).toBe(true)
    vi.advanceTimersByTime(30_000)
    expect(isSecretChatUnlocked()).toBe(false)

    dispose()
  })

  it('关闭自动锁：时间推进后仍保持解锁', () => {
    configure(false, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    vi.advanceTimersByTime(120_000)
    expect(isSecretChatUnlocked()).toBe(true)

    dispose()
  })

  it('用户活动会刷新空闲计时', () => {
    configure(true, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    vi.advanceTimersByTime(45_000)
    document.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(45_000)
    expect(isSecretChatUnlocked()).toBe(true)

    dispose()
  })

  it('键盘事件同样刷新空闲计时', () => {
    configure(true, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    vi.advanceTimersByTime(45_000)
    document.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(45_000)
    expect(isSecretChatUnlocked()).toBe(true)

    dispose()
  })

  it('页面回到可见时刷新空闲计时', () => {
    configure(true, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    vi.advanceTimersByTime(45_000)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(45_000)
    expect(isSecretChatUnlocked()).toBe(true)

    dispose()
  })

  it('后台停留超过锁定时长后回前台立即上锁', () => {
    configure(true, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    // 只推进系统时钟、不跑定时器：模拟后台 setInterval 被节流/挂起
    vi.setSystemTime(Date.now() + 120_000)
    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isSecretChatUnlocked()).toBe(false)

    dispose()
  })

  it('关闭自动锁时后台停留再回前台仍保持解锁', () => {
    configure(false, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.setSystemTime(Date.now() + 120_000)
    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isSecretChatUnlocked()).toBe(true)

    dispose()
  })

  it('dispose 后巡检不再触发上锁，也不再响应活动事件', () => {
    configure(true, 1)
    const { dispose } = useSecretChatAutoLock()
    unlockSecretChatSession(new Uint8Array(32))

    dispose()
    vi.advanceTimersByTime(180_000)
    expect(isSecretChatUnlocked()).toBe(true)
  })
})
