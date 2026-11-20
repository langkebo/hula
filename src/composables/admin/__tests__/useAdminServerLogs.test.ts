import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminServerLogs } from '../useAdminServerLogs'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getServerStatus: vi.fn().mockResolvedValue(null),
    getServerHealth: vi.fn().mockResolvedValue(null),
    getServerVersion: vi.fn().mockResolvedValue(null),
    getServerStats: vi.fn().mockResolvedValue(null)
  }
}))

import { adminService } from '@/services/matrix/admin'
import {
  makeServerHealthInfo,
  makeServerStatsInfo,
  makeServerStatusInfo,
  makeServerVersionInfo
} from '@/services/matrix/admin/__tests__/fixtures/server'

describe('useAdminServerLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadPanel requests all panel resources', async () => {
    const c = useAdminServerLogs()
    await c.loadPanel()
    expect(adminService.getServerStatus).toHaveBeenCalledTimes(1)
    expect(adminService.getServerHealth).toHaveBeenCalledTimes(1)
    expect(adminService.getServerVersion).toHaveBeenCalledTimes(1)
    expect(adminService.getServerStats).toHaveBeenCalledTimes(1)
  })

  it('populates panel refs', async () => {
    const c = useAdminServerLogs()
    vi.mocked(adminService.getServerStatus).mockResolvedValueOnce(makeServerStatusInfo())
    vi.mocked(adminService.getServerHealth).mockResolvedValueOnce(makeServerHealthInfo())
    vi.mocked(adminService.getServerVersion).mockResolvedValueOnce(makeServerVersionInfo({ serverVersion: '1.0.0' }))
    vi.mocked(adminService.getServerStats).mockResolvedValueOnce(makeServerStatsInfo())
    await c.loadPanel()
    expect(c.status.value).toEqual({ status: 'online' })
    expect(c.health.value?.healthy).toBe(true)
    expect(c.version.value?.serverVersion).toBe('1.0.0')
    expect(c.stats.value?.roomCount).toBe(2)
  })

  it('loading flag toggles around loadPanel', async () => {
    const c = useAdminServerLogs()
    const p = c.loadPanel()
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
  })

  it('records per-panel errors and counts failures without dropping succeeded panels', async () => {
    const c = useAdminServerLogs()
    vi.mocked(adminService.getServerStatus).mockResolvedValueOnce(makeServerStatusInfo())
    vi.mocked(adminService.getServerHealth).mockRejectedValueOnce(new Error('HTTP 500'))
    vi.mocked(adminService.getServerVersion).mockResolvedValueOnce(makeServerVersionInfo({ serverVersion: '1.0.0' }))
    vi.mocked(adminService.getServerStats).mockRejectedValueOnce(new Error('HTTP 503'))

    await c.loadPanel()

    expect(c.errors.value).toEqual({ status: false, health: true, version: false, stats: true })
    expect(c.failedCount.value).toBe(2)
    expect(c.status.value?.status).toBe('online')
    expect(c.health.value).toBeNull()
    expect(c.stats.value).toBeNull()
  })
})
