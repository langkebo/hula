import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAdminSecurity } from '../useAdminSecurity'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getSecurityEvents: vi.fn().mockResolvedValue({ events: [] }),
    getIpBlocks: vi.fn().mockResolvedValue([]),
    blockIp: vi.fn().mockResolvedValue({}),
    unblockIp: vi.fn().mockResolvedValue(undefined),
    getIpReputation: vi.fn().mockResolvedValue(null)
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadEvents populates events ref', async () => {
    vi.mocked(adminService.getSecurityEvents).mockResolvedValueOnce({
      events: [{ id: 'e1' }]
    })
    const c = useAdminSecurity()
    await c.loadEvents()
    expect(c.events.value).toHaveLength(1)
    expect(adminService.getSecurityEvents).toHaveBeenCalledWith(100, undefined, undefined)
  })

  it('loadEvents forwards filters', async () => {
    const c = useAdminSecurity()
    await c.loadEvents(50, 'tok', { severity: 'high' })
    expect(adminService.getSecurityEvents).toHaveBeenCalledWith(50, 'tok', { severity: 'high' })
  })

  it('loadIpBlocks populates ref', async () => {
    vi.mocked(adminService.getIpBlocks).mockResolvedValueOnce([{ ip: '1.2.3.4' }])
    const c = useAdminSecurity()
    await c.loadIpBlocks()
    expect(c.ipBlocks.value).toHaveLength(1)
  })

  it('blockIp calls service and reloads list', async () => {
    const c = useAdminSecurity()
    await c.blockIp('1.2.3.4', { reason: 'spam' })
    expect(adminService.blockIp).toHaveBeenCalledWith('1.2.3.4', { reason: 'spam' })
    expect(adminService.getIpBlocks).toHaveBeenCalledTimes(1)
  })

  it('unblockIp calls service and reloads list', async () => {
    const c = useAdminSecurity()
    await c.unblockIp('1.2.3.4')
    expect(adminService.unblockIp).toHaveBeenCalledWith('1.2.3.4')
    expect(adminService.getIpBlocks).toHaveBeenCalledTimes(1)
  })

  it('getIpReputation proxies to service', async () => {
    vi.mocked(adminService.getIpReputation).mockResolvedValueOnce({ score: 42 })
    const c = useAdminSecurity()
    const result = await c.getIpReputation('1.2.3.4')
    expect(result).toEqual({ score: 42 })
  })
})
