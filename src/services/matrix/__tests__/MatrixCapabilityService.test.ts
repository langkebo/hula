import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn(() => null) }
}))

vi.mock('../user/MatrixAccountService', () => ({
  matrixAccountService: { getCapabilities: vi.fn().mockResolvedValue({}) }
}))

import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { CapabilityUnavailableError, matrixCapabilityService } from '../MatrixCapabilityService'

describe('MatrixCapabilityService §16.5.3 gates', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('canUseSlidingSync reflects msc3575 flags', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(false)

    store.setCapabilities({ unstable_features: { 'org.matrix.msc3575': true } })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)

    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3575': false, 'org.matrix.simplified_msc3575': true }
    })
    expect(matrixCapabilityService.canUseSlidingSync()).toBe(true)
  })

  it('canUseE2EE defaults true and honors explicit disable', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseE2EE()).toBe(true)

    store.setCapabilities({ capabilities: { 'm.room.encryption': { enabled: false } } })
    expect(matrixCapabilityService.canUseE2EE()).toBe(false)
  })

  it('canUseVoip checks feature and msc3401', () => {
    const store = useCapabilityStore()
    expect(matrixCapabilityService.canUseVoip()).toBe(false)

    store.setCapabilities({ capabilities: { 'm.voip': true } })
    expect(matrixCapabilityService.canUseVoip()).toBe(true)
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
  })

  it('hasCapability resolves symbolic names', () => {
    const store = useCapabilityStore()
    store.setCapabilities({
      unstable_features: { 'org.matrix.msc3575': true },
      capabilities: { 'io.hula.admin': true }
    })
    expect(matrixCapabilityService.hasCapability('sliding-sync')).toBe(true)
    expect(matrixCapabilityService.hasCapability('admin-api')).toBe(true)
    expect(matrixCapabilityService.hasCapability('voip')).toBe(false)
    expect(matrixCapabilityService.hasCapability('friend-list')).toBe(false)
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
    store.setCapabilities({ capabilities: { 'm.voip': true } })
    expect(() => matrixCapabilityService.requireCapability('voip')).not.toThrow()
  })
})
