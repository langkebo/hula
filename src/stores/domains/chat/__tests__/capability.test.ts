import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCapabilityStore } from '../capability'

describe('useCapabilityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态为空且未加载', () => {
    const store = useCapabilityStore()
    expect(store.unstableFeatures).toEqual({})
    expect(store.capabilities).toEqual({})
    expect(store.clientConfig).toEqual({})
    expect(store.isLoaded).toBe(false)
  })

  describe('setCapabilities', () => {
    it('完整写入所有字段并标记为已加载', () => {
      const store = useCapabilityStore()
      store.setCapabilities({
        unstable_features: { 'm.lazy_load_members': true },
        capabilities: { 'm.room_versions': { default: '11' } },
        client_config: { 'm.threads': { enabled: true } }
      })
      expect(store.unstableFeatures).toEqual({ 'm.lazy_load_members': true })
      expect(store.capabilities).toEqual({ 'm.room_versions': { default: '11' } })
      expect(store.clientConfig).toEqual({ 'm.threads': { enabled: true } })
      expect(store.isLoaded).toBe(true)
    })

    it('仅写入 unstable_features 时其他字段保持空对象', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: { flag: false } })
      expect(store.unstableFeatures).toEqual({ flag: false })
      expect(store.capabilities).toEqual({})
      expect(store.clientConfig).toEqual({})
      expect(store.isLoaded).toBe(true)
    })

    it('仅写入 capabilities 时其他字段保持空对象', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { foo: 'bar' } })
      expect(store.capabilities).toEqual({ foo: 'bar' })
      expect(store.unstableFeatures).toEqual({})
      expect(store.isLoaded).toBe(true)
    })

    it('仅写入 client_config 时其他字段保持空对象', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ client_config: { baz: 1 } })
      expect(store.clientConfig).toEqual({ baz: 1 })
      expect(store.capabilities).toEqual({})
      expect(store.isLoaded).toBe(true)
    })

    it('空对象也会标记为已加载', () => {
      const store = useCapabilityStore()
      store.setCapabilities({})
      expect(store.isLoaded).toBe(true)
    })

    it('覆盖已有数据', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: { a: true }, capabilities: { x: 1 } })
      store.setCapabilities({ unstable_features: { b: false } })
      expect(store.unstableFeatures).toEqual({ b: false })
      // capabilities 未提供，保持原值
      expect(store.capabilities).toEqual({ x: 1 })
    })
  })

  describe('hasUnstable', () => {
    it('返回 true 当 unstable_features[flag] === true', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: { 'm.flag': true, 'm.off': false } })
      expect(store.hasUnstable('m.flag').value).toBe(true)
    })

    it('返回 false 当 unstable_features[flag] === false', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: { 'm.off': false } })
      expect(store.hasUnstable('m.off').value).toBe(false)
    })

    it('返回 false 当 flag 不存在', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ unstable_features: {} })
      expect(store.hasUnstable('m.missing').value).toBe(false)
    })
  })

  describe('hasFeature', () => {
    it('检测 capabilities 中的布尔特性', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { 'm.feature': true } })
      expect(store.hasFeature('m.feature').value).toBe(true)
    })

    it('检测 capabilities 中带 enabled 字段的对象特性', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { 'm.feature': { enabled: true } } })
      expect(store.hasFeature('m.feature').value).toBe(true)
    })

    it('capabilities 中带 enabled: false 的对象特性返回 false', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { 'm.feature': { enabled: false } } })
      expect(store.hasFeature('m.feature').value).toBe(false)
    })

    it('检测 client_config 中的特性', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ client_config: { 'm.cfg': true } })
      expect(store.hasFeature('m.cfg').value).toBe(true)
    })

    it('capabilities 优先于 client_config', () => {
      const store = useCapabilityStore()
      store.setCapabilities({
        capabilities: { 'm.x': true },
        client_config: { 'm.x': false }
      })
      expect(store.hasFeature('m.x').value).toBe(true)
    })

    it('capabilities 为 false 时回退到 client_config', () => {
      const store = useCapabilityStore()
      store.setCapabilities({
        capabilities: { 'm.x': false },
        client_config: { 'm.x': true }
      })
      expect(store.hasFeature('m.x').value).toBe(true)
    })

    it('两者都不存在时返回 false', () => {
      const store = useCapabilityStore()
      store.setCapabilities({})
      expect(store.hasFeature('m.missing').value).toBe(false)
    })

    it('非布尔/非 enabled 对象返回 false', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { 'm.str': 'string-value' } })
      expect(store.hasFeature('m.str').value).toBe(false)
    })

    it('null 值返回 false', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { 'm.null': null } })
      expect(store.hasFeature('m.null').value).toBe(false)
    })

    it('数字值返回 false', () => {
      const store = useCapabilityStore()
      store.setCapabilities({ capabilities: { 'm.num': 1 } })
      expect(store.hasFeature('m.num').value).toBe(false)
    })
  })
})
