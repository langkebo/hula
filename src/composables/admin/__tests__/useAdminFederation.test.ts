import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminFederation } from '../useAdminFederation'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getFederationDestinations: vi.fn().mockResolvedValue([]),
    resetFederationConnection: vi.fn().mockResolvedValue(undefined),
    reconnectFederation: vi.fn().mockResolvedValue(undefined)
  },
  matrixFederationBlacklistService: {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true)
  }
}))

import { adminService, matrixFederationBlacklistService } from '@/services/matrix'

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
    vi.mocked(matrixFederationBlacklistService.list).mockResolvedValueOnce([
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
    expect(matrixFederationBlacklistService.add).toHaveBeenCalledWith({ domain: 'spam.tld', reason: 'abuse' })
    expect(matrixFederationBlacklistService.list).toHaveBeenCalledTimes(1)
  })

  it('addToBlacklist does not refresh when backend rejects', async () => {
    vi.mocked(matrixFederationBlacklistService.add).mockResolvedValueOnce(false)
    const c = useAdminFederation()
    const ok = await c.addToBlacklist('spam.tld')
    expect(ok).toBe(false)
    expect(matrixFederationBlacklistService.list).not.toHaveBeenCalled()
  })

  it('removeFromBlacklist refreshes when successful', async () => {
    const c = useAdminFederation()
    await c.removeFromBlacklist('spam.tld')
    expect(matrixFederationBlacklistService.remove).toHaveBeenCalledWith('spam.tld')
    expect(matrixFederationBlacklistService.list).toHaveBeenCalledTimes(1)
  })

  it('selectDestination sets the ref', () => {
    const c = useAdminFederation()
    c.selectDestination({ destination: 'x.tld' })
    expect(c.selectedDestination.value?.destination).toBe('x.tld')
    c.selectDestination(null)
    expect(c.selectedDestination.value).toBeNull()
  })
})
