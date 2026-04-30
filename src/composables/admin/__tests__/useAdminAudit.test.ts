import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminAudit } from '../useAdminAudit'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getAuditLog: vi.fn().mockResolvedValue({ logs: [] }),
    getAuditEvent: vi.fn().mockResolvedValue(null)
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadLogs populates logs with default limit', async () => {
    vi.mocked(adminService.getAuditLog).mockResolvedValueOnce({
      logs: [
        { id: '1', type: 'admin', user_id: '@a:s', timestamp: 1 },
        { id: '2', type: 'auth', user_id: '@b:s', timestamp: 2 }
      ]
    })
    const c = useAdminAudit()
    await c.loadLogs()
    expect(c.logs.value).toHaveLength(2)
    expect(adminService.getAuditLog).toHaveBeenCalledWith(50, undefined, undefined, undefined)
  })

  it('loadLogs forwards filters', async () => {
    const c = useAdminAudit()
    await c.loadLogs({ userId: '@u:s', type: 'login', limit: 25, from: '100' })
    expect(adminService.getAuditLog).toHaveBeenCalledWith(25, '100', '@u:s', 'login')
  })

  it('loading flag toggles around loadLogs', async () => {
    const c = useAdminAudit()
    const p = c.loadLogs()
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
  })

  it('loadDetail populates selected', async () => {
    vi.mocked(adminService.getAuditEvent).mockResolvedValueOnce({
      id: '$e1',
      type: 'admin',
      user_id: '@x:s',
      timestamp: 100
    })
    const c = useAdminAudit()
    const r = await c.loadDetail('$e1')
    expect(r?.id).toBe('$e1')
    expect(c.selected.value?.id).toBe('$e1')
    expect(adminService.getAuditEvent).toHaveBeenCalledWith('$e1')
  })

  it('loadingDetail flag toggles around loadDetail', async () => {
    const c = useAdminAudit()
    const p = c.loadDetail('$x')
    expect(c.loadingDetail.value).toBe(true)
    await p
    expect(c.loadingDetail.value).toBe(false)
  })

  it('clearSelected resets selected', () => {
    const c = useAdminAudit()
    c.selected.value = { id: 'x', type: 't', user_id: '', timestamp: 0 }
    c.clearSelected()
    expect(c.selected.value).toBeNull()
  })
})
