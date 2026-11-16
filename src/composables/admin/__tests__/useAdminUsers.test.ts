import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminUsers } from '../useAdminUsers'

vi.mock('@/services/matrix/admin', () => ({
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
    overrideUserRateLimit: vi.fn().mockResolvedValue(undefined),
    deleteRateLimit: vi.fn().mockResolvedValue(undefined),
    shadowBanUser: vi.fn().mockResolvedValue(undefined),
    unshadowBanUser: vi.fn().mockResolvedValue(undefined),
    getAccountInfo: vi.fn().mockResolvedValue({ displayname: 'Alice', avatar_url: '' }),
    updateAccountInfo: vi.fn().mockResolvedValue(undefined),
    getWhois: vi.fn().mockResolvedValue({ user_id: '@x:s' }),
    getRegistrationNonce: vi.fn().mockResolvedValue('nonce-1'),
    adminRegister: vi.fn().mockResolvedValue({ userId: '@new:s' }),
    getUserById: vi.fn().mockResolvedValue(null),
    checkUserAdmin: vi.fn().mockResolvedValue(false),
    getUserStatsList: vi.fn().mockResolvedValue({ stats: [] }),
    evictUser: vi.fn().mockResolvedValue(undefined),
    logoutUserAll: vi.fn().mockResolvedValue(undefined),
    loginUserAs: vi.fn().mockResolvedValue(null),
    batchCreateUsers: vi.fn().mockResolvedValue([])
  }
}))

import { adminService } from '@/services/matrix/admin'

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

  it('filterRole narrows to admin or user role', async () => {
    vi.mocked(adminService.getUsers).mockResolvedValueOnce({
      users: [
        { userId: '@admin:s', admin: true },
        { userId: '@user1:s', admin: false },
        { userId: '@user2:s', admin: false }
      ]
    })
    const c = useAdminUsers()
    await c.loadUsers()
    expect(c.filterRole.value).toBe('all')
    c.filterRole.value = 'admin'
    expect(c.filteredUsers.value).toHaveLength(1)
    expect(c.filteredUsers.value[0].userId).toBe('@admin:s')
    c.filterRole.value = 'user'
    expect(c.filteredUsers.value).toHaveLength(2)
    c.filterRole.value = 'all'
    expect(c.filteredUsers.value).toHaveLength(3)
  })

  it('filterStatus narrows to active or deactivated', async () => {
    vi.mocked(adminService.getUsers).mockResolvedValueOnce({
      users: [
        { userId: '@active:s', deactivated: false },
        { userId: '@deact:s', deactivated: true }
      ]
    })
    const c = useAdminUsers()
    await c.loadUsers()
    expect(c.filterStatus.value).toBe('all')
    c.filterStatus.value = 'active'
    expect(c.filteredUsers.value).toHaveLength(1)
    expect(c.filteredUsers.value[0].userId).toBe('@active:s')
    c.filterStatus.value = 'deactivated'
    expect(c.filteredUsers.value).toHaveLength(1)
    expect(c.filteredUsers.value[0].userId).toBe('@deact:s')
    c.filterStatus.value = 'all'
    expect(c.filteredUsers.value).toHaveLength(2)
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

  // ---- ADM-06: account info / whois / register nonce ----

  it('selectUser loads account info for the selected user', async () => {
    const c = useAdminUsers()
    await c.selectUser({ userId: '@x:s' })
    expect(adminService.getAccountInfo).toHaveBeenCalledWith('@x:s')
    expect(c.accountInfo.value).toEqual({ displayname: 'Alice', avatar_url: '' })
  })

  it('updateAccountInfo submits updates and refreshes account info + list', async () => {
    const c = useAdminUsers()
    await c.selectUser({ userId: '@x:s' })
    vi.mocked(adminService.getAccountInfo).mockClear()

    await c.updateAccountInfo({ displayname: 'Bob' })
    expect(adminService.updateAccountInfo).toHaveBeenCalledWith('@x:s', { displayname: 'Bob' })
    expect(adminService.getAccountInfo).toHaveBeenCalledWith('@x:s')
    expect(adminService.getUsers).toHaveBeenCalled()
  })

  it('loadWhois populates whois for the selected user', async () => {
    const c = useAdminUsers()
    await c.selectUser({ userId: '@x:s' })
    await c.loadWhois()
    expect(adminService.getWhois).toHaveBeenCalledWith('@x:s')
    expect(c.whois.value).toEqual({ user_id: '@x:s' })
  })

  it('loadRegistrationNonce caches and returns the nonce', async () => {
    const c = useAdminUsers()
    const nonce = await c.loadRegistrationNonce()
    expect(adminService.getRegistrationNonce).toHaveBeenCalledTimes(1)
    expect(nonce).toBe('nonce-1')
    expect(c.registrationNonce.value).toBe('nonce-1')
  })

  it('registerWithNonce calls adminRegister and reloads list', async () => {
    const c = useAdminUsers()
    const ok = await c.registerWithNonce('alice', 'pw', 'nonce-1', true)
    expect(adminService.adminRegister).toHaveBeenCalledWith('alice', 'pw', 'nonce-1', true)
    expect(ok).toBe(true)
    expect(adminService.getUsers).toHaveBeenCalled()
  })

  // ---- ADM-11: 用户处置（踢出 / 注销会话 / 模拟登录 / 批量创建 / 详情刷新）----

  it('selectUser 同时加载管理员校验与服务端统计', async () => {
    vi.mocked(adminService.checkUserAdmin).mockResolvedValueOnce(true)
    vi.mocked(adminService.getUserStatsList).mockResolvedValueOnce({ stats: [{ total: 3 }] })
    const c = useAdminUsers()
    await c.selectUser({ userId: '@x:s' })
    expect(adminService.checkUserAdmin).toHaveBeenCalledWith('@x:s')
    expect(c.adminCheck.value).toBe(true)
    expect(c.userStatsOverview.value).toEqual([{ total: 3 }])
  })

  it('selectUser(null) 重置管理员校验与模拟会话', async () => {
    const c = useAdminUsers()
    await c.selectUser({ userId: '@x:s' })
    vi.mocked(adminService.loginUserAs).mockResolvedValueOnce({ accessToken: 'tok', deviceId: 'DEV' })
    await c.loginUserAs('@x:s')
    await c.selectUser(null)
    expect(c.adminCheck.value).toBeNull()
    expect(c.impersonationSession.value).toBeNull()
  })

  it('refreshUserDetail 用 getUserById 更新选中用户与列表项', async () => {
    vi.mocked(adminService.getUsers).mockResolvedValueOnce({
      users: [{ userId: '@x:s', displayname: 'Old' }]
    })
    const c = useAdminUsers()
    await c.loadUsers()
    await c.selectUser({ userId: '@x:s', displayname: 'Old' })
    vi.mocked(adminService.getUserById).mockResolvedValueOnce({
      userId: '@x:s',
      displayname: 'New'
    })
    const fresh = await c.refreshUserDetail()
    expect(fresh?.displayname).toBe('New')
    expect(c.selectedUser.value?.displayname).toBe('New')
    expect(c.users.value[0].displayname).toBe('New')
    expect(c.detailRefreshing.value).toBe(false)
  })

  it('refreshUserDetail 未选中用户时返回 null 且不请求', async () => {
    const c = useAdminUsers()
    const fresh = await c.refreshUserDetail()
    expect(fresh).toBeNull()
    expect(adminService.getUserById).not.toHaveBeenCalled()
  })

  it('evictUser 调用服务并刷新列表', async () => {
    const c = useAdminUsers()
    await c.evictUser('@x:s')
    expect(adminService.evictUser).toHaveBeenCalledWith('@x:s')
    expect(adminService.getUsers).toHaveBeenCalledTimes(1)
    expect(c.evicting.value).toBe(false)
  })

  it('evictUser 失败时抛出错误并复位 loading', async () => {
    vi.mocked(adminService.evictUser).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminUsers()
    await expect(c.evictUser('@x:s')).rejects.toThrow('boom')
    expect(c.evicting.value).toBe(false)
  })

  it('logoutUserAll 调用服务并复位 loading', async () => {
    const c = useAdminUsers()
    await c.logoutUserAll('@x:s')
    expect(adminService.logoutUserAll).toHaveBeenCalledWith('@x:s')
    expect(c.loggingOutAll.value).toBe(false)
  })

  it('logoutUserAll 失败时抛出错误并复位 loading', async () => {
    vi.mocked(adminService.logoutUserAll).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminUsers()
    await expect(c.logoutUserAll('@x:s')).rejects.toThrow('boom')
    expect(c.loggingOutAll.value).toBe(false)
  })

  it('loginUserAs 成功时写入模拟会话', async () => {
    vi.mocked(adminService.loginUserAs).mockResolvedValueOnce({ accessToken: 'tok', deviceId: 'DEV' })
    const c = useAdminUsers()
    const session = await c.loginUserAs('@x:s')
    expect(session).toEqual({ userId: '@x:s', accessToken: 'tok', deviceId: 'DEV' })
    expect(c.impersonationSession.value?.accessToken).toBe('tok')
    expect(c.impersonating.value).toBe(false)
  })

  it('loginUserAs 无令牌时返回 null 且不写入会话', async () => {
    const c = useAdminUsers()
    const session = await c.loginUserAs('@x:s')
    expect(session).toBeNull()
    expect(c.impersonationSession.value).toBeNull()
  })

  it('loginUserAs 失败时抛出错误并复位 loading', async () => {
    vi.mocked(adminService.loginUserAs).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminUsers()
    await expect(c.loginUserAs('@x:s')).rejects.toThrow('boom')
    expect(c.impersonating.value).toBe(false)
  })

  it('clearImpersonation 清空模拟会话', async () => {
    vi.mocked(adminService.loginUserAs).mockResolvedValueOnce({ accessToken: 'tok', deviceId: 'DEV' })
    const c = useAdminUsers()
    await c.loginUserAs('@x:s')
    c.clearImpersonation()
    expect(c.impersonationSession.value).toBeNull()
  })

  it('batchCreateUsers 透传参数并刷新列表', async () => {
    vi.mocked(adminService.batchCreateUsers).mockResolvedValueOnce([
      { userId: '@a:s', success: true },
      { userId: '@b:s', success: false }
    ])
    const c = useAdminUsers()
    const result = await c.batchCreateUsers([{ username: 'a', password: 'pw' }])
    expect(adminService.batchCreateUsers).toHaveBeenCalledWith([{ username: 'a', password: 'pw' }])
    expect(result).toHaveLength(2)
    expect(adminService.getUsers).toHaveBeenCalledTimes(1)
    expect(c.batchCreating.value).toBe(false)
  })

  it('batchCreateUsers 失败时抛出错误并复位 loading', async () => {
    vi.mocked(adminService.batchCreateUsers).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminUsers()
    await expect(c.batchCreateUsers([{ username: 'a', password: 'pw' }])).rejects.toThrow('boom')
    expect(c.batchCreating.value).toBe(false)
  })
})
