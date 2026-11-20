import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminSecurity } from '../useAdminSecurity'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    security: {
      getAuditLog: vi.fn().mockResolvedValue({ logs: [], next_batch: undefined })
    }
  }
}))

import { adminService } from '@/services/matrix/admin'
import { makeAuditLogEntry, makeAuditLogPage } from '@/services/matrix/admin/__tests__/fixtures/security'

describe('useAdminSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadAuditLogs populates logs ref', async () => {
    vi.mocked(adminService.security.getAuditLog).mockResolvedValueOnce(
      makeAuditLogPage([makeAuditLogEntry({ event_id: 'e1' })], 'tok1')
    )
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
    const first = makeAuditLogEntry({ event_id: 'e1' })
    const second = makeAuditLogEntry({ event_id: 'e2' })
    vi.mocked(adminService.security.getAuditLog)
      .mockResolvedValueOnce(makeAuditLogPage([first], 'tok1'))
      .mockResolvedValueOnce(makeAuditLogPage([second]))
    await c.loadAuditLogs()
    await c.loadAuditLogs(50, 'tok1')
    expect(c.auditLogs.value).toEqual([first, second])
  })
})
