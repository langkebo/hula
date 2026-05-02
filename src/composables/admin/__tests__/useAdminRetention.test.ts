import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRetention } from '../useAdminRetention'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getRetentionPolicies: vi.fn().mockResolvedValue({ policies: [] }),
    getRetentionStatus: vi.fn().mockResolvedValue({}),
    setRetentionPolicy: vi.fn().mockResolvedValue(undefined),
    deleteRetentionPolicy: vi.fn().mockResolvedValue(undefined),
    runRetentionTask: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix/admin'

describe('useAdminRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadAll fetches policies and status in parallel', async () => {
    vi.mocked(adminService.getRetentionPolicies).mockResolvedValueOnce({
      policies: [{ room_id: '!r:s', max_lifetime: 86400000, min_lifetime: 0 }]
    })
    vi.mocked(adminService.getRetentionStatus).mockResolvedValueOnce({ running: true })

    const c = useAdminRetention()
    await c.loadAll()

    expect(c.policies.value).toHaveLength(1)
    expect(c.policies.value[0]).toEqual({ roomId: '!r:s', minLifetime: 0, maxLifetime: 86400000 })
    expect(c.retentionStatus.value).toEqual({ running: true })
  })

  it('setPolicy delegates and reloads list', async () => {
    const c = useAdminRetention()
    await c.setPolicy('!r:s', 1000, 500)
    expect(adminService.setRetentionPolicy).toHaveBeenCalledWith('!r:s', 1000, 500)
    expect(adminService.getRetentionPolicies).toHaveBeenCalledTimes(1)
  })

  it('deletePolicy delegates (even though backend no-ops) and reloads', async () => {
    const c = useAdminRetention()
    await c.deletePolicy('!r:s')
    expect(adminService.deleteRetentionPolicy).toHaveBeenCalledWith('!r:s')
    expect(adminService.getRetentionPolicies).toHaveBeenCalledTimes(1)
  })

  it('runTask toggles taskLoading', async () => {
    const c = useAdminRetention()
    const p = c.runTask()
    expect(c.taskLoading.value).toBe(true)
    await p
    expect(c.taskLoading.value).toBe(false)
    expect(adminService.runRetentionTask).toHaveBeenCalled()
  })
})
