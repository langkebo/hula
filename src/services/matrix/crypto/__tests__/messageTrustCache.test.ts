import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bumpTrustCacheVersion,
  clearSenderDeviceCache,
  senderDeviceCache,
  subscribeTrustTick,
  trustCacheVersion,
  trustTickVersion
} from '../messageTrustCache'

/**
 * 契约重点：
 *  1. 登出/换账号必须清空信任缓存，否则上一账号的绿锁会跨账号沿用（假安全信号）。
 *  2. 全局刷新节拍只维护一个定时器，最后一个订阅者退订时停止（避免每消息一个 setInterval）。
 */
describe('messageTrustCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    senderDeviceCache.clear()
    trustCacheVersion.value = 0
    trustTickVersion.value = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('senderDeviceCache / trustCacheVersion', () => {
    it('bumps the version explicitly', () => {
      bumpTrustCacheVersion()
      bumpTrustCacheVersion()
      expect(trustCacheVersion.value).toBe(2)
    })

    it('clears cached trust levels and bumps the version once', () => {
      senderDeviceCache.set('@alice:tjg.local:@bob:tjg.local', 'verified')
      senderDeviceCache.set('@alice:tjg.local:@carol:tjg.local', 'risk')

      clearSenderDeviceCache()

      expect(senderDeviceCache.size).toBe(0)
      expect(trustCacheVersion.value).toBe(1)
    })

    it('does not bump the version when the cache is already empty', () => {
      clearSenderDeviceCache()
      expect(trustCacheVersion.value).toBe(0)
    })
  })

  describe('subscribeTrustTick', () => {
    it('shares one timer across subscribers and stops it after the last unsubscribe', () => {
      const first = subscribeTrustTick()
      const second = subscribeTrustTick()

      vi.advanceTimersByTime(30_000)
      expect(trustTickVersion.value).toBe(1)

      first()
      vi.advanceTimersByTime(30_000)
      // 仍有订阅者，节拍继续
      expect(trustTickVersion.value).toBe(2)

      second()
      vi.advanceTimersByTime(30_000)
      // 最后一个订阅者退订后定时器必须停止，否则会常驻空转
      expect(trustTickVersion.value).toBe(2)
    })

    it('treats unsubscribe as idempotent', () => {
      const unsubscribe = subscribeTrustTick()

      unsubscribe()
      unsubscribe()

      vi.advanceTimersByTime(30_000)
      expect(trustTickVersion.value).toBe(0)

      // 幂等退订不能把订阅计数减成负数，导致后续订阅无法启动定时器
      const resubscribe = subscribeTrustTick()
      vi.advanceTimersByTime(30_000)
      expect(trustTickVersion.value).toBe(1)
      resubscribe()
    })

    it('restarts the timer when a new subscriber arrives after full teardown', () => {
      const first = subscribeTrustTick()
      first()

      const second = subscribeTrustTick()
      vi.advanceTimersByTime(30_000)
      expect(trustTickVersion.value).toBe(1)
      second()
    })
  })
})
