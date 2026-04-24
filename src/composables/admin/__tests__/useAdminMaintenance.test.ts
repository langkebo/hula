import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAdminMaintenance } from '../useAdminMaintenance'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getBackups: vi.fn().mockResolvedValue([]),
    getExperimentalFeatures: vi.fn().mockResolvedValue({}),
    getMediaStats: vi.fn().mockResolvedValue(null),
    purgeMediaCache: vi.fn().mockResolvedValue({ deleted: 0 }),
    setExperimentalFeature: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadAll fans out to backups/features/stats in parallel', async () => {
    vi.mocked(adminService.getBackups).mockResolvedValueOnce([{ id: 'b1' }])
    vi.mocked(adminService.getExperimentalFeatures).mockResolvedValueOnce({ foo: true })
    vi.mocked(adminService.getMediaStats).mockResolvedValueOnce({ total: 10 })

    const c = useAdminMaintenance()
    await c.loadAll()

    expect(c.backups.value).toHaveLength(1)
    expect(c.experimentalFeatures.value.foo).toBe(true)
    expect(c.mediaStats.value).toEqual({ total: 10 })
    expect(adminService.getBackups).toHaveBeenCalledTimes(1)
    expect(adminService.getExperimentalFeatures).toHaveBeenCalledTimes(1)
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
    expect(adminService.getExperimentalFeatures).toHaveBeenCalledTimes(1)
  })

  it('featureMutating flag toggles around setExperimentalFeature', async () => {
    const c = useAdminMaintenance()
    const p = c.setExperimentalFeature('flag_x', false)
    expect(c.featureMutating.value).toBe(true)
    await p
    expect(c.featureMutating.value).toBe(false)
  })
})
