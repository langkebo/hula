import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminNotificationService } from '../NotificationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  sendServerNotice: vi.fn(),
  getServerNotices: vi.fn(),
  getUserNotification: vi.fn(),
  setUserNotification: vi.fn(),
  getUserPushers: vi.fn(),
  deleteUserPusher: vi.fn(),
  createNotification: vi.fn(),
  listNotifications: vi.fn(),
  getNotification: vi.fn(),
  updateNotification: vi.fn(),
  deleteNotification: vi.fn()
})

describe('AdminNotificationService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminNotificationService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminNotificationService(async () => admin)
  })

  it('sendServerNotice 返回 eventId 且失败时向上抛出', async () => {
    admin.sendServerNotice.mockResolvedValueOnce({ event_id: '$notice1' })
    const content = { msgtype: 'm.text', body: 'hello' }

    await expect(service.sendServerNotice('@u:hs', content)).resolves.toEqual({ eventId: '$notice1' })
    expect(admin.sendServerNotice).toHaveBeenCalledWith('@u:hs', content)

    admin.sendServerNotice.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    await expect(service.sendServerNotice('@u:hs', content)).rejects.toThrow('M_FORBIDDEN')
  })

  it('getServerNotices 映射通知列表字段', async () => {
    admin.getServerNotices.mockResolvedValueOnce({
      notices: [{ user_id: '@u:hs', sent_ts: 111, content: { body: 'hi' } }]
    })

    await expect(service.getServerNotices(10)).resolves.toEqual({
      notices: [{ userId: '@u:hs', sentTs: 111, content: { body: 'hi' } }]
    })
    expect(admin.getServerNotices).toHaveBeenCalledWith(undefined, 10)
  })

  it('getServerNotices 出错时返回 null', async () => {
    admin.getServerNotices.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getServerNotices()).resolves.toBeNull()
  })

  it('getUserPushers 出错时降级为空数组', async () => {
    admin.getUserPushers.mockResolvedValueOnce({ pushers: [{ pushkey: 'pk1' }] })
    await expect(service.getUserPushers('@u:hs')).resolves.toEqual([{ pushkey: 'pk1' }])

    admin.getUserPushers.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getUserPushers('@u:hs')).resolves.toEqual([])
  })

  it('deleteUserPusher 失败时向上抛出', async () => {
    admin.deleteUserPusher.mockRejectedValueOnce(new Error('boom'))
    await expect(service.deleteUserPusher('@u:hs', 'pk1', 'app.id')).rejects.toThrow('boom')
  })

  it('createSystemNotification 组装 target_users 请求体', async () => {
    admin.createNotification.mockResolvedValueOnce({ notification_id: 'n1' })

    await expect(service.createSystemNotification('维护公告', 'warning', ['@a:hs'])).resolves.toEqual({
      notificationId: 'n1'
    })
    expect(admin.createNotification).toHaveBeenCalledWith({
      content: '维护公告',
      type: 'warning',
      target_users: ['@a:hs']
    })
  })

  it('getSystemNotifications 映射 next_token 且出错时降级为空列表', async () => {
    admin.listNotifications.mockResolvedValueOnce({
      notifications: [{ id: 'n1' }],
      next_token: 'tok'
    })
    await expect(service.getSystemNotifications(20, 'from-1')).resolves.toEqual({
      notifications: [{ id: 'n1' }],
      nextToken: 'tok'
    })
    expect(admin.listNotifications).toHaveBeenCalledWith('from-1', 20)

    admin.listNotifications.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getSystemNotifications()).resolves.toEqual({ notifications: [] })
  })

  it('updateSystemNotification/deleteSystemNotification 失败时向上抛出', async () => {
    admin.updateNotification.mockRejectedValueOnce(new Error('update-fail'))
    await expect(service.updateSystemNotification('n1', {})).rejects.toThrow('update-fail')

    admin.deleteNotification.mockRejectedValueOnce(new Error('delete-fail'))
    await expect(service.deleteSystemNotification('n1')).rejects.toThrow('delete-fail')
  })
})
