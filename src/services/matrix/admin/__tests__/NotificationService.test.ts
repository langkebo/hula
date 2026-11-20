import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminNotificationService } from '../NotificationService'
import { makeUserPusher, makeUserPushersResponse } from './fixtures/notification'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  getUserNotification: vi.fn(),
  setUserNotification: vi.fn(),
  getUserPushers: vi.fn(),
  deleteUserPusher: vi.fn()
})

describe('AdminNotificationService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminNotificationService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminNotificationService(async () => admin)
  })

  it('getUserPushers 出错时降级为空数组', async () => {
    const pushers = [makeUserPusher({ pushkey: 'pk1' })]
    admin.getUserPushers.mockResolvedValueOnce(makeUserPushersResponse(pushers))
    await expect(service.getUserPushers('@u:hs')).resolves.toEqual(pushers)

    admin.getUserPushers.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getUserPushers('@u:hs')).resolves.toEqual([])
  })

  it('deleteUserPusher 失败时向上抛出', async () => {
    admin.deleteUserPusher.mockRejectedValueOnce(new Error('boom'))
    await expect(service.deleteUserPusher('@u:hs', 'pk1', 'app.id')).rejects.toThrow('boom')
  })

  it('setUserNotificationSettings 失败时向上抛出', async () => {
    admin.setUserNotification.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    await expect(service.setUserNotificationSettings('@u:hs', { enabled: true })).rejects.toThrow('M_FORBIDDEN')
  })
})
