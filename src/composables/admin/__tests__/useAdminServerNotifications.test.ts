import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    serverNotifications: {
      getSystemNotifications: vi.fn(),
      getSystemNotification: vi.fn(),
      createSystemNotification: vi.fn(),
      updateSystemNotification: vi.fn(),
      deleteSystemNotification: vi.fn()
    }
  }
}))

import { adminService } from '@/services/matrix/admin'
import { useAdminServerNotifications } from '../useAdminServerNotifications'

const serverNotifications = adminService.serverNotifications

const sampleNotification = {
  id: 'n1',
  content: 'maintenance tonight',
  type: 'warning',
  targetUsers: ['@alice:example.org'],
  createdAt: 1700000000000
}

describe('useAdminServerNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(serverNotifications.getSystemNotifications).mockResolvedValue({
      notifications: [sampleNotification],
      nextToken: undefined
    })
    vi.mocked(serverNotifications.getSystemNotification).mockResolvedValue(sampleNotification)
    vi.mocked(serverNotifications.createSystemNotification).mockResolvedValue({ notificationId: 'n2' })
    vi.mocked(serverNotifications.updateSystemNotification).mockResolvedValue(undefined)
    vi.mocked(serverNotifications.deleteSystemNotification).mockResolvedValue(undefined)
  })

  it('loadNotifications 拉取列表并写入状态', async () => {
    const c = useAdminServerNotifications()
    await c.loadNotifications()

    expect(serverNotifications.getSystemNotifications).toHaveBeenCalledWith(50, undefined, true)
    expect(c.notifications.value).toEqual([sampleNotification])
    expect(c.loading.value).toBe(false)
    expect(c.error.value).toBeNull()
  })

  it('loadNotifications 失败时清空列表并记录错误', async () => {
    vi.mocked(serverNotifications.getSystemNotifications).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminServerNotifications()
    await c.loadNotifications()

    expect(c.notifications.value).toEqual([])
    expect(c.error.value).toBe('boom')
  })

  it('loadDetail 成功返回详情，失败返回 null 并记录错误', async () => {
    const c = useAdminServerNotifications()
    const detail = await c.loadDetail('n1')
    expect(serverNotifications.getSystemNotification).toHaveBeenCalledWith('n1', true)
    expect(detail).toEqual(sampleNotification)

    vi.mocked(serverNotifications.getSystemNotification).mockRejectedValueOnce(new Error('gone'))
    const missing = await c.loadDetail('n2')
    expect(missing).toBeNull()
    expect(c.error.value).toBe('gone')
  })

  it('createNotification 去除空白目标并在空列表时传 undefined', async () => {
    const c = useAdminServerNotifications()
    const ok = await c.createNotification({ content: '  hello  ', type: 'info', targetUsers: [' ', ''] })

    expect(ok).toBe(true)
    expect(serverNotifications.createSystemNotification).toHaveBeenCalledWith('hello', 'info', undefined)
    expect(serverNotifications.getSystemNotifications).toHaveBeenCalledTimes(1)
  })

  it('createNotification 保留有效目标并返回失败标记', async () => {
    const c = useAdminServerNotifications()
    await c.createNotification({
      content: 'hi',
      type: 'warning',
      targetUsers: [' @alice:example.org ', '']
    })
    expect(serverNotifications.createSystemNotification).toHaveBeenCalledWith('hi', 'warning', ['@alice:example.org'])

    vi.mocked(serverNotifications.createSystemNotification).mockRejectedValueOnce(new Error('denied'))
    const ok = await c.createNotification({ content: 'hi', type: 'info', targetUsers: [] })
    expect(ok).toBe(false)
    expect(c.error.value).toBe('denied')
  })

  it('updateNotification 传递 content/type/target_users 并刷新', async () => {
    const c = useAdminServerNotifications()
    const ok = await c.updateNotification('n1', {
      content: ' updated ',
      type: 'error',
      targetUsers: ['@bob:example.org']
    })

    expect(ok).toBe(true)
    expect(serverNotifications.updateSystemNotification).toHaveBeenCalledWith('n1', {
      content: 'updated',
      type: 'error',
      target_users: ['@bob:example.org']
    })
    expect(serverNotifications.getSystemNotifications).toHaveBeenCalledTimes(1)
  })

  it('removeNotification 删除后刷新，失败返回 false', async () => {
    const c = useAdminServerNotifications()
    const ok = await c.removeNotification('n1')
    expect(ok).toBe(true)
    expect(serverNotifications.deleteSystemNotification).toHaveBeenCalledWith('n1')
    expect(c.removingId.value).toBeNull()

    vi.mocked(serverNotifications.deleteSystemNotification).mockRejectedValueOnce(new Error('nope'))
    const failed = await c.removeNotification('n2')
    expect(failed).toBe(false)
    expect(c.error.value).toBe('nope')
  })
})
