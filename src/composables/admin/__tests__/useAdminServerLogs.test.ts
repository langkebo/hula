import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAdminServerLogs } from '../useAdminServerLogs'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getServerLogs: vi.fn().mockResolvedValue([])
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminServerLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadLogs with default params', async () => {
    const c = useAdminServerLogs()
    await c.loadLogs()
    expect(adminService.getServerLogs).toHaveBeenCalledWith(undefined, 100)
  })

  it('forwards level + limit from refs', async () => {
    const c = useAdminServerLogs()
    c.level.value = 'error'
    c.limit.value = 50
    await c.loadLogs()
    expect(adminService.getServerLogs).toHaveBeenCalledWith('error', 50)
  })

  it('populates logs ref', async () => {
    vi.mocked(adminService.getServerLogs).mockResolvedValueOnce([{ msg: 'x' }])
    const c = useAdminServerLogs()
    await c.loadLogs()
    expect(c.logs.value).toHaveLength(1)
  })

  it('treats null return as empty array', async () => {
    vi.mocked(adminService.getServerLogs).mockResolvedValueOnce(null)
    const c = useAdminServerLogs()
    await c.loadLogs()
    expect(c.logs.value).toEqual([])
  })

  it('loading flag toggles around loadLogs', async () => {
    const c = useAdminServerLogs()
    const p = c.loadLogs()
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
  })
})
