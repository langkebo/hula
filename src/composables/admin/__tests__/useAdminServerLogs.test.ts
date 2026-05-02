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
    vi.mocked(adminService.getServerStatus).mockResolvedValueOnce({ status: 'online', uptime: 100 })
    vi.mocked(adminService.getServerHealth).mockResolvedValueOnce({ healthy: true, checks: { db: { status: 'ok' } } })
    vi.mocked(adminService.getServerVersion).mockResolvedValueOnce({ serverVersion: '1.0.0', pythonVersion: 'Rust' })
    vi.mocked(adminService.getServerStats).mockResolvedValueOnce({
      userCount: 1,
      roomCount: 2,
      dailyActiveUsers: 3,
      monthlyActiveUsers: 4,
      messageCount: 5,
      startServerTime: 6
    })
    await c.loadPanel()
    expect(c.status.value).toEqual({ status: 'online', uptime: 100 })
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
})
