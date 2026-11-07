import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_GLASS_INTENSITY, resolveBlurToken, useGlassEffectStore } from '../glassEffect'

describe('resolveBlurToken', () => {
  it('按强度映射到 soft / medium / strong 三档 token', () => {
    expect(resolveBlurToken(0)).toBe('--tjg-glass-blur-soft')
    expect(resolveBlurToken(0.49)).toBe('--tjg-glass-blur-soft')
    expect(resolveBlurToken(0.5)).toBe('--tjg-glass-blur-medium')
    expect(resolveBlurToken(0.84)).toBe('--tjg-glass-blur-medium')
    expect(resolveBlurToken(0.85)).toBe('--tjg-glass-blur-strong')
    expect(resolveBlurToken(1)).toBe('--tjg-glass-blur-strong')
  })

  it('越界值夹取到 [0, 1]，非法值回落到默认强度', () => {
    expect(resolveBlurToken(-1)).toBe('--tjg-glass-blur-soft')
    expect(resolveBlurToken(2)).toBe('--tjg-glass-blur-strong')
    expect(resolveBlurToken(Number.NaN)).toBe(resolveBlurToken(DEFAULT_GLASS_INTENSITY))
  })
})

describe('useGlassEffectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认偏好为 auto / 0.8 / 关闭折射 / high 档', () => {
    const store = useGlassEffectStore()

    expect(store.mode).toBe('auto')
    expect(store.intensity).toBe(DEFAULT_GLASS_INTENSITY)
    expect(store.advancedRefraction).toBe(false)
    expect(store.tier).toBe('high')
  })

  it('allowBackdrop 在关闭玻璃或 low 档时为 false', () => {
    const store = useGlassEffectStore()
    expect(store.allowBackdrop).toBe(true)

    store.mode = 'off'
    expect(store.allowBackdrop).toBe(false)

    store.mode = 'on'
    store.syncTier('low')
    expect(store.allowBackdrop).toBe(false)

    store.syncTier('medium')
    expect(store.allowBackdrop).toBe(true)
  })

  it('allowAdvancedRefraction 需要同时满足开启、high 档与 auto 模式', () => {
    const store = useGlassEffectStore()
    expect(store.allowAdvancedRefraction).toBe(false)

    store.advancedRefraction = true
    expect(store.allowAdvancedRefraction).toBe(true)

    store.mode = 'on'
    expect(store.allowAdvancedRefraction).toBe(false)

    store.mode = 'auto'
    store.syncTier('medium')
    expect(store.allowAdvancedRefraction).toBe(false)

    store.syncTier('high')
    expect(store.allowAdvancedRefraction).toBe(true)
  })

  it('blurToken 随强度变化', () => {
    const store = useGlassEffectStore()

    store.intensity = 0.3
    expect(store.blurToken).toBe('--tjg-glass-blur-soft')

    store.intensity = 0.7
    expect(store.blurToken).toBe('--tjg-glass-blur-medium')

    store.intensity = 0.95
    expect(store.blurToken).toBe('--tjg-glass-blur-strong')
  })

  it('reset 恢复用户偏好但不重置运行期档位', () => {
    const store = useGlassEffectStore()
    store.mode = 'off'
    store.intensity = 0.2
    store.advancedRefraction = true
    store.syncTier('low')

    store.reset()

    expect(store.mode).toBe('auto')
    expect(store.intensity).toBe(DEFAULT_GLASS_INTENSITY)
    expect(store.advancedRefraction).toBe(false)
    expect(store.tier).toBe('low')
  })
})
