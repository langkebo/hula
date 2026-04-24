import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAdminUsers } from '../useAdminUsers'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getUsers: vi.fn().mockResolvedValue({ users: [] }),
    getUserDevices: vi.fn().mockResolvedValue([]),
    getRateLimit: vi.fn().mockResolvedValue(null),
    getShadowBanStatus: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockResolvedValue({ userId: '@new:s' }),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    deactivateUser: vi.fn().mockResolvedValue(undefined),
    setAdmin: vi.fn().mockResolvedValue(undefined),
    deleteUserDevice: vi.fn().mockResolvedValue(undefined),
    setRateLimit: vi.fn().mockResolvedValue(undefined),
    deleteRateLimit: vi.fn().mockResolvedValue(undefined),
    shadowBanUser: vi.fn().mockResolvedValue(undefined),
    unshadowBanUser: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadUsers populates users ref via adminService.getUsers', async () => {
    vi.mocked(adminService.getUsers).mockResolvedValueOnce({
      users: [
        { userId: '@a:s', displayname: 'Alice' },
        { userId: '@b:s', displayname: 'Bob' }
      ]
    })
    const composable = useAdminUsers()
    await composable.loadUsers(50)
    expect(composable.users.value).toHaveLength(2)
    expect(adminService.getUsers).toHaveBeenCalledWith(50)
  })

  it('filteredUsers searches across userId, displayname and name', async () => {
    vi.mocked(adminService.getUsers).mockResolvedValueOnce({
      users: [
        { userId: '@alice:s', displayname: 'Alice', name: 'alice' },
        { userId: '@bob:s', displayname: 'Bob', name: 'bob' }
      ]
    })
    const c = useAdminUsers()
    await c.loadUsers()
    c.searchQuery.value = 'ali'
    expect(c.filteredUsers.value).toHaveLength(1)
    expect(c.filteredUsers.value[0].userId).toBe('@alice:s')
  })

  it('selectUser triggers concurrent detail loads', async () => {
    const c = useAdminUsers()
    await c.selectUser({ userId: '@x:s' })
    expect(adminService.getUserDevices).toHaveBeenCalledWith('@x:s')
    expect(adminService.getRateLimit).toHaveBeenCalledWith('@x:s')
    expect(adminService.getShadowBanStatus).toHaveBeenCalledWith('@x:s')
  })

  it('selectUser(null) clears detail state without calling services', async () => {
    const c = useAdminUsers()
    await c.selectUser(null)
    expect(adminService.getUserDevices).not.toHaveBeenCalled()
    expect(c.userDevices.value).toEqual([])
  })

  it('createUser reloads list on success', async () => {
    const c = useAdminUsers()
    const result = await c.createUser('alice', 'pw', { admin: false })
    expect(result?.userId).toBe('@new:s')
    expect(adminService.getUsers).toHaveBeenCalledTimes(1)
  })

  it('deactivateUser reloads list after success', async () => {
    const c = useAdminUsers()
    await c.deactivateUser('@x:s')
    expect(adminService.deactivateUser).toHaveBeenCalledWith('@x:s')
    expect(adminService.getUsers).toHaveBeenCalledTimes(1)
  })

  it('setAdmin reloads list after success', async () => {
    const c = useAdminUsers()
    await c.setAdmin('@x:s', true)
    expect(adminService.setAdmin).toHaveBeenCalledWith('@x:s', true)
    expect(adminService.getUsers).toHaveBeenCalledTimes(1)
  })

  it('shadowBanUser refreshes status only for selected user', async () => {
    const c = useAdminUsers()
    // no user selected
    await c.shadowBanUser('@x:s')
    expect(adminService.getShadowBanStatus).not.toHaveBeenCalled()

    // after selecting the affected user
    await c.selectUser({ userId: '@x:s' })
    vi.mocked(adminService.getShadowBanStatus).mockClear()
    await c.shadowBanUser('@x:s')
    expect(adminService.getShadowBanStatus).toHaveBeenCalledTimes(1)
  })
})
