import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAdminSecurity } from '../useAdminSecurity'

vi.mock('@/services/matrix', () => ({
  adminService: {
    security: {
      getAuditLog: vi.fn().mockResolvedValue({ logs: [], next_batch: undefined })
    }
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadAuditLogs populates logs ref', async () => {
    vi.mocked(adminService.security.getAuditLog).mockResolvedValueOnce({
      logs: [{ id: 'e1' }],
      next_batch: 'tok1'
    })
    const c = useAdminSecurity()
    await c.loadAuditLogs()
    expect(c.auditLogs.value).toHaveLength(1)
    expect(c.nextBatch.value).toBe('tok1')
    expect(adminService.security.getAuditLog).toHaveBeenCalledWith(50, undefined, undefined, undefined)
  })

  it('loadAuditLogs forwards filters', async () => {
    const c = useAdminSecurity()
    await c.loadAuditLogs(25, 'tok', '@u:s', 'login')
    expect(adminService.security.getAuditLog).toHaveBeenCalledWith(25, 'tok', '@u:s', 'login')
  })

  it('loadAuditLogs appends when from token is provided', async () => {
    const c = useAdminSecurity()
    vi.mocked(adminService.security.getAuditLog)
      .mockResolvedValueOnce({ logs: [{ id: 'e1' }], next_batch: 'tok1' })
      .mockResolvedValueOnce({ logs: [{ id: 'e2' }], next_batch: undefined })
    await c.loadAuditLogs()
    await c.loadAuditLogs(50, 'tok1')
    expect(c.auditLogs.value).toEqual([{ id: 'e1' }, { id: 'e2' }])
  })
})
