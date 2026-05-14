import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminFederation } from '../useAdminFederation'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getFederationDestinations: vi.fn().mockResolvedValue([]),
    resetFederationConnection: vi.fn().mockResolvedValue(undefined),
    reconnectFederation: vi.fn().mockResolvedValue(undefined),
    getFederationBlacklist: vi.fn().mockResolvedValue([]),
    addToFederationBlacklist: vi.fn().mockResolvedValue(true),
    removeFromFederationBlacklist: vi.fn().mockResolvedValue(true)
  }
}))

import { adminService } from '@/services/matrix/admin'

describe('useAdminFederation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadDestinations populates ref', async () => {
    vi.mocked(adminService.getFederationDestinations).mockResolvedValueOnce([
      { destination: 'a.tld' },
      { destination: 'b.tld' }
    ])
    const c = useAdminFederation()
    await c.loadDestinations()
    expect(c.destinations.value).toHaveLength(2)
  })

  it('resetFederationConnection refreshes list', async () => {
    const c = useAdminFederation()
    await c.resetFederationConnection('a.tld')
    expect(adminService.resetFederationConnection).toHaveBeenCalledWith('a.tld')
    expect(adminService.getFederationDestinations).toHaveBeenCalledTimes(1)
  })

  it('reconnectFederation refreshes list', async () => {
    const c = useAdminFederation()
    await c.reconnectFederation('a.tld')
    expect(adminService.reconnectFederation).toHaveBeenCalledWith('a.tld')
    expect(adminService.getFederationDestinations).toHaveBeenCalledTimes(1)
  })

  it('loadBlacklist normalizes entries', async () => {
    vi.mocked(adminService.getFederationBlacklist).mockResolvedValueOnce([
      { domain: 'spam.tld', reason: 'abuse', addedBy: '@a:s', addedAt: 1 }
    ])
    const c = useAdminFederation()
    await c.loadBlacklist()
    expect(c.blacklist.value).toEqual([{ domain: 'spam.tld', reason: 'abuse', addedBy: '@a:s', addedAt: 1 }])
  })

  it('addToBlacklist refreshes when successful', async () => {
    const c = useAdminFederation()
    const ok = await c.addToBlacklist('spam.tld', 'abuse')
    expect(ok).toBe(true)
    expect(adminService.addToFederationBlacklist).toHaveBeenCalledWith('spam.tld', 'abuse')
    expect(adminService.getFederationBlacklist).toHaveBeenCalledTimes(1)
  })

  it('addToBlacklist does not refresh when backend rejects', async () => {
    vi.mocked(adminService.addToFederationBlacklist).mockResolvedValueOnce(false)
    const c = useAdminFederation()
    const ok = await c.addToBlacklist('spam.tld')
    expect(ok).toBe(false)
    expect(adminService.getFederationBlacklist).not.toHaveBeenCalled()
  })

  it('removeFromBlacklist refreshes when successful', async () => {
    const c = useAdminFederation()
    await c.removeFromBlacklist('spam.tld')
    expect(adminService.removeFromFederationBlacklist).toHaveBeenCalledWith('spam.tld')
    expect(adminService.getFederationBlacklist).toHaveBeenCalledTimes(1)
  })

  it('selectDestination sets the ref', () => {
    const c = useAdminFederation()
    c.selectDestination({ destination: 'x.tld' })
    expect(c.selectedDestination.value?.destination).toBe('x.tld')
    c.selectDestination(null)
    expect(c.selectedDestination.value).toBeNull()
  })
})
