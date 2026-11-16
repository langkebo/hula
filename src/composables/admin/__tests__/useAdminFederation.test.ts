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
  },
  adminFederationService: {
    getFederationCache: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    clearFederationCache: vi.fn().mockResolvedValue(undefined),
    deleteFederationCacheEntry: vi.fn().mockResolvedValue(undefined),
    getPendingFederationServers: vi.fn().mockResolvedValue({ servers: [], total: 0, limit: 0 }),
    confirmFederation: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminFederationService, adminService } from '@/services/matrix/admin'

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

  it('loadCache populates entries', async () => {
    vi.mocked(adminFederationService.getFederationCache).mockResolvedValueOnce({
      entries: [{ key: 'k1', value: 1, expiryTs: 10 }],
      total: 1
    })
    const c = useAdminFederation()
    await c.loadCache()
    expect(c.cacheEntries.value).toEqual([{ key: 'k1', value: 1, expiryTs: 10 }])
    expect(c.cacheError.value).toBeNull()
  })

  it('loadCache records error and keeps entries empty', async () => {
    vi.mocked(adminFederationService.getFederationCache).mockRejectedValueOnce(new Error('cache-down'))
    const c = useAdminFederation()
    await c.loadCache()
    expect(c.cacheError.value).toBe('cache-down')
    expect(c.cacheEntries.value).toEqual([])
    expect(c.cacheLoading.value).toBe(false)
  })

  it('clearCache refreshes entries when successful', async () => {
    const c = useAdminFederation()
    const ok = await c.clearCache()
    expect(ok).toBe(true)
    expect(adminFederationService.clearFederationCache).toHaveBeenCalledTimes(1)
    expect(adminFederationService.getFederationCache).toHaveBeenCalledTimes(1)
  })

  it('clearCache records error when failure', async () => {
    vi.mocked(adminFederationService.clearFederationCache).mockRejectedValueOnce(new Error('clear-fail'))
    const c = useAdminFederation()
    const ok = await c.clearCache()
    expect(ok).toBe(false)
    expect(c.cacheError.value).toBe('clear-fail')
  })

  it('removeCacheEntry deletes and refreshes', async () => {
    const c = useAdminFederation()
    const ok = await c.removeCacheEntry('k1')
    expect(ok).toBe(true)
    expect(adminFederationService.deleteFederationCacheEntry).toHaveBeenCalledWith('k1')
    expect(adminFederationService.getFederationCache).toHaveBeenCalledTimes(1)
  })

  it('removeCacheEntry records error when failure', async () => {
    vi.mocked(adminFederationService.deleteFederationCacheEntry).mockRejectedValueOnce(new Error('delete-fail'))
    const c = useAdminFederation()
    const ok = await c.removeCacheEntry('k1')
    expect(ok).toBe(false)
    expect(c.cacheError.value).toBe('delete-fail')
  })

  it('loadPending populates servers', async () => {
    vi.mocked(adminFederationService.getPendingFederationServers).mockResolvedValueOnce({
      servers: [
        {
          serverName: 'p.tld',
          failureCount: 2,
          lastFailedConnectAt: 1,
          lastSuccessfulConnectAt: null,
          status: 'pending',
          updatedTs: 2
        }
      ],
      total: 1,
      limit: 20
    })
    const c = useAdminFederation()
    await c.loadPending()
    expect(c.pendingServers.value).toHaveLength(1)
    expect(c.pendingServers.value[0]?.serverName).toBe('p.tld')
  })

  it('loadPending records error', async () => {
    vi.mocked(adminFederationService.getPendingFederationServers).mockRejectedValueOnce(new Error('pending-down'))
    const c = useAdminFederation()
    await c.loadPending()
    expect(c.pendingError.value).toBe('pending-down')
    expect(c.pendingLoading.value).toBe(false)
  })

  it('confirmPending delegates and refreshes pending list', async () => {
    const c = useAdminFederation()
    const ok = await c.confirmPending('p.tld', true)
    expect(ok).toBe(true)
    expect(adminFederationService.confirmFederation).toHaveBeenCalledWith('p.tld', true)
    expect(adminFederationService.getPendingFederationServers).toHaveBeenCalledTimes(1)
  })

  it('confirmPending records error when failure', async () => {
    vi.mocked(adminFederationService.confirmFederation).mockRejectedValueOnce(new Error('confirm-fail'))
    const c = useAdminFederation()
    const ok = await c.confirmPending('p.tld', false)
    expect(ok).toBe(false)
    expect(c.pendingError.value).toBe('confirm-fail')
  })
})
