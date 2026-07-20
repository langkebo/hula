import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../user/MatrixAccountService', () => ({
  matrixAccountService: { getCapabilities: vi.fn().mockResolvedValue({}) }
}))

import { useCapabilityStore } from '@/stores/domains/chat/capability'
import {
  CapabilityUnavailableError,
  matrixCapabilityService,
  registerCapabilityStoreResolver
} from '../MatrixCapabilityService'

describe('MatrixCapabilityService §16.5.3 gates', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Register the store resolver so the service can access the store
    // (resets the cached store instance from previous tests)
    registerCapabilityStoreResolver(() => useCapabilityStore())
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('canUseSlidingSync reflects synapse-rust feature flags and compatibility aliases', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(false)

    store.setCapabilities({ unstable_features: { 'org.matrix.msc3886.sliding_sync': true } })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)

    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3575': false, 'org.matrix.simplified_msc3575': true }
    })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)

    store.setCapabilities({
      unstable_features: {},
      capabilities: { 'io.hula.sliding_sync': { enabled: true } }
    })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)
  })

  it('canUseE2EE defaults true and honors explicit disable', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseE2EE()).toBe(true)

    store.setCapabilities({ capabilities: { 'm.room.encryption': { enabled: false } } })
    expect(matrixCapabilityService.canUseE2EE()).toBe(false)
  })

  it('canUseVoip checks synapse-rust voice aliases', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseVoip()).toBe(false)

    store.setCapabilities({ capabilities: { 'm.voice': { enabled: true } } })
    expect(matrixCapabilityService.canUseVoip()).toBe(true)

    store.setCapabilities({ capabilities: { 'm.voice': { enabled: false }, 'io.hula.voice_extended': true } })
    expect(matrixCapabilityService.canUseVoip()).toBe(true)

    store.setCapabilities({
      capabilities: { 'm.voice': { enabled: false }, 'io.hula.voice_extended': { enabled: false } }
    })
    expect(matrixCapabilityService.canUseVoip()).toBe(false)
  })

  it('canUseFriendList / canUseAdminApi recognize hula extensions', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseFriendList()).toBe(false)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)

    store.setCapabilities({
      capabilities: { 'io.hula.friends': true, 'io.hula.admin': true }
    })
    expect(matrixCapabilityService.canUseFriendList()).toBe(true)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(true)

    store.setCapabilities({
      capabilities: { 'io.hula.friends': { enabled: false }, 'io.hula.admin': { enabled: false } }
    })
    expect(matrixCapabilityService.canUseFriendList()).toBe(false)
    expect(matrixCapabilityService.canUseAdminApi()).toBe(false)
  })

  it('hasCapability resolves symbolic names', () => {
    const store = useCapabilityStore()
    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3886.sliding_sync': true },
      capabilities: { 'io.hula.admin': true }
    })
    expect(matrixCapabilityService.hasCapability('sliding-sync')).toBe(true)
    expect(matrixCapabilityService.hasCapability('admin-api')).toBe(true)
    expect(matrixCapabilityService.hasCapability('voip')).toBe(false)
    expect(matrixCapabilityService.hasCapability('friend-list')).toBe(false)
  })

  it('canUseThreads recognizes the backend m.thread capability and MSC3983 flags', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseThreads()).toBe(false)

    store.setCapabilities({ capabilities: { 'm.thread': { enabled: true } } })
    expect(matrixCapabilityService.canUseThreads()).toBe(true)

    store.setCapabilities({
      capabilities: { 'm.thread': { enabled: false } },
      unstable_features: { 'org.matrix.msc3983': true }
    })
    expect(matrixCapabilityService.canUseThreads()).toBe(true)
  })

  it('requireCapability throws CapabilityUnavailableError when missing', () => {
    expect(() => matrixCapabilityService.requireCapability('voip')).toThrow(CapabilityUnavailableError)
    try {
      matrixCapabilityService.requireCapability('voip')
    } catch (err) {
      expect(err).toBeInstanceOf(CapabilityUnavailableError)
      if (err instanceof CapabilityUnavailableError) {
        expect(err.capability).toBe('voip')
        expect(err.code).toBe('CAPABILITY_UNAVAILABLE')
      }
    }
  })

  it('requireCapability is a no-op when capability is present', () => {
    const store = useCapabilityStore()
    store.setCapabilities({ capabilities: { 'm.voice': { enabled: true } } })
    expect(() => matrixCapabilityService.requireCapability('voip')).not.toThrow()
  })
})
