import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerNoticeInfo } from '@/services/matrix/admin/AdminTypes'
import { useAdminNotices } from '../useAdminNotices'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getServerNotices: vi.fn().mockResolvedValue({ notices: [] }),
    sendServerNotice: vi.fn().mockResolvedValue({ eventId: '$e' })
  }
}))

import { adminService } from '@/services/matrix/admin'

describe('useAdminNotices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadNotices populates ref with default limit', async () => {
    const notices: ServerNoticeInfo[] = [
      { userId: '@a:s', content: { body: 'x' } },
      { userId: '@b:s', content: { body: 'y' } }
    ]
    vi.mocked(adminService.getServerNotices).mockResolvedValueOnce({
      notices
    })
    const c = useAdminNotices()
    await c.loadNotices()
    expect(c.notices.value).toHaveLength(2)
    expect(adminService.getServerNotices).toHaveBeenCalledWith(50)
  })

  it('loadNotices forwards custom limit', async () => {
    const c = useAdminNotices()
    await c.loadNotices(10)
    expect(adminService.getServerNotices).toHaveBeenCalledWith(10)
  })

  it('loading flag toggles around loadNotices', async () => {
    const c = useAdminNotices()
    const p = c.loadNotices()
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
  })

  it('sendNotice builds m.text payload and reloads', async () => {
    const c = useAdminNotices()
    await c.sendNotice('@u:s', 'hello')
    expect(adminService.sendServerNotice).toHaveBeenCalledWith('@u:s', {
      msgtype: 'm.text',
      body: 'hello'
    })
    expect(adminService.getServerNotices).toHaveBeenCalledTimes(1)
  })

  it('sending flag toggles around sendNotice', async () => {
    const c = useAdminNotices()
    const p = c.sendNotice('@u:s', 'hi')
    expect(c.sending.value).toBe(true)
    await p
    expect(c.sending.value).toBe(false)
  })
})
