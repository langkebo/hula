import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useTrustGatePolicy } from '../useTrustGatePolicy'

// F-1：信任门禁策略（视觉降级，非安全边界）。
// 默认关闭 —— 策略上线不应改变既有会话观感。

const setStrict = (strict: boolean) => {
  const store = useSettingStore()
  store.chat.trustGateStrict = strict
}

describe('useTrustGatePolicy', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认非严格：所有信任级都不模糊（不改变既有观感）', () => {
    const { strict, shouldMask } = useTrustGatePolicy()

    expect(strict.value).toBe(false)
    expect(shouldMask('verified')).toBe(false)
    expect(shouldMask('unverified')).toBe(false)
    expect(shouldMask('risk')).toBe(false)
    expect(shouldMask('plain')).toBe(false)
  })

  it('严格模式：只有 unverified / risk 模糊', () => {
    setStrict(true)
    const { shouldMask } = useTrustGatePolicy()

    expect(shouldMask('verified')).toBe(false)
    expect(shouldMask('plain')).toBe(false)
    expect(shouldMask('unverified')).toBe(true)
    expect(shouldMask('risk')).toBe(true)
  })

  it('严格模式：risk 才出「加密房里是明文」警示条', () => {
    setStrict(true)
    const { shouldWarnPlaintextInEncryptedRoom } = useTrustGatePolicy()

    expect(shouldWarnPlaintextInEncryptedRoom('risk')).toBe(true)
    expect(shouldWarnPlaintextInEncryptedRoom('unverified')).toBe(false)
    expect(shouldWarnPlaintextInEncryptedRoom('verified')).toBe(false)
  })

  it('非严格模式下即使 risk 也不加警示条（红锁已足够）', () => {
    const { shouldWarnPlaintextInEncryptedRoom } = useTrustGatePolicy()
    expect(shouldWarnPlaintextInEncryptedRoom('risk')).toBe(false)
  })

  it('visibilityFor 与 shouldMask 保持一致', () => {
    setStrict(true)
    const { visibilityFor } = useTrustGatePolicy()

    expect(visibilityFor('unverified')).toBe('masked')
    expect(visibilityFor('risk')).toBe('masked')
    expect(visibilityFor('verified')).toBe('open')
  })
})
