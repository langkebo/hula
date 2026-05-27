import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminMaintenance } from '../useAdminMaintenance'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getBackups: vi.fn().mockResolvedValue([]),
    listFeatureFlagsDetailed: vi.fn().mockResolvedValue([]),
    getMediaStats: vi.fn().mockResolvedValue(null),
    purgeMediaCache: vi.fn().mockResolvedValue({ deleted: 0 }),
    setExperimentalFeature: vi.fn().mockResolvedValue(undefined),
    getFeatureFlagDetail: vi.fn().mockResolvedValue(null),
    saveFeatureFlag: vi.fn().mockResolvedValue({
      flagKey: 'flag_x',
      enabled: true,
      status: 'enabled',
      description: '',
      targetScope: 'global',
      rolloutPercent: 100,
      expiresAt: null,
      reason: '',
      createdBy: '@admin:server',
      createdTs: 1,
      updatedTs: 2,
      targets: []
    }),
    deleteFeatureFlag: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix/admin'

describe('useAdminMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadAll fans out to backups/features/stats in parallel', async () => {
    vi.mocked(adminService.getBackups).mockResolvedValueOnce([{ id: 'b1' }])
    vi.mocked(adminService.listFeatureFlagsDetailed).mockResolvedValueOnce([
      {
        flagKey: 'foo',
        enabled: true,
        status: 'enabled',
        description: 'test',
        targetScope: 'global',
        rolloutPercent: 100,
        expiresAt: null,
        reason: 'test',
        createdBy: '@admin:server',
        createdTs: 1,
        updatedTs: 2,
        targets: []
      }
    ])
    vi.mocked(adminService.getMediaStats).mockResolvedValueOnce({ total: 10 })

    const c = useAdminMaintenance()
    await c.loadAll()

    expect(c.backups.value).toHaveLength(1)
    expect(c.featureFlags.value).toHaveLength(1)
    expect(c.experimentalFeatures.value.foo).toEqual(
      expect.objectContaining({ enabled: true, status: 'enabled', targetScope: 'global' })
    )
    expect(c.mediaStats.value).toEqual({ total: 10 })
    expect(adminService.getBackups).toHaveBeenCalledTimes(1)
    expect(adminService.listFeatureFlagsDetailed).toHaveBeenCalledTimes(1)
    expect(adminService.getMediaStats).toHaveBeenCalledTimes(1)
  })

  it('purgeMediaCache reloads media stats on success', async () => {
    vi.mocked(adminService.purgeMediaCache).mockResolvedValueOnce({ deleted: 7 })
    const c = useAdminMaintenance()
    const r = await c.purgeMediaCache(1234)
    expect(r.deleted).toBe(7)
    expect(adminService.purgeMediaCache).toHaveBeenCalledWith(1234)
    expect(adminService.getMediaStats).toHaveBeenCalledTimes(1)
  })

  it('purging flag toggles around purgeMediaCache', async () => {
    const c = useAdminMaintenance()
    const p = c.purgeMediaCache()
    expect(c.purging.value).toBe(true)
    await p
    expect(c.purging.value).toBe(false)
  })

  it('setExperimentalFeature delegates and reloads feature list', async () => {
    const c = useAdminMaintenance()
    await c.setExperimentalFeature('flag_x', true)
    expect(adminService.setExperimentalFeature).toHaveBeenCalledWith('flag_x', true)
    expect(adminService.listFeatureFlagsDetailed).toHaveBeenCalledTimes(1)
  })

  it('featureMutating flag toggles around setExperimentalFeature', async () => {
    const c = useAdminMaintenance()
    const p = c.setExperimentalFeature('flag_x', false)
    expect(c.featureMutating.value).toBe(true)
    await p
    expect(c.featureMutating.value).toBe(false)
  })

  it('saveFeatureFlag delegates and reloads feature list', async () => {
    const c = useAdminMaintenance()
    const result = await c.saveFeatureFlag({
      flagKey: 'flag_x',
      targetScope: 'global',
      rolloutPercent: 100
    })

    expect(adminService.saveFeatureFlag).toHaveBeenCalledWith({
      flagKey: 'flag_x',
      targetScope: 'global',
      rolloutPercent: 100
    })
    expect(adminService.listFeatureFlagsDetailed).toHaveBeenCalledTimes(1)
    expect(result.flagKey).toBe('flag_x')
  })

  it('deleteFeatureFlag delegates and reloads feature list', async () => {
    const c = useAdminMaintenance()
    await c.deleteFeatureFlag('flag_x')

    expect(adminService.deleteFeatureFlag).toHaveBeenCalledWith('flag_x')
    expect(adminService.listFeatureFlagsDetailed).toHaveBeenCalledTimes(1)
  })
})
