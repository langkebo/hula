import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminUserService } from '../UserService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/utils/inputValidation', () => ({
  isNonEmptyString: (s: string) => s.length > 0,
  isValidMatrixUserId: (s: string) => /^@[^:]+:.+$/.test(s),
  isValidMatrixRoomId: (s: string) => /^![^:]+:.+$/.test(s)
}))

const makeAdmin = () =>
  ({
    getUsersPaginated: vi.fn(),
    getUser: vi.fn(),
    getUserById: vi.fn(),
    createUser: vi.fn(),
    resetPassword: vi.fn(),
    setAdmin: vi.fn(),
    deactivateUser: vi.fn(),
    activateUser: vi.fn(),
    getUserDevices: vi.fn(),
    deleteUserDevice: vi.fn(),
    getRateLimitOverride: vi.fn(),
    overrideRateLimit: vi.fn(),
    deleteRateLimitOverride: vi.fn(),
    shadowBanUser: vi.fn(),
    unshadowBanUser: vi.fn(),
    getShadowBanStatus: vi.fn(),
    whois: vi.fn(),
    getUserRooms: vi.fn(),
    getUserStats: vi.fn(),
    listUserStats: vi.fn(),
    batchCreateUsers: vi.fn(),
    batchDeactivateUsers: vi.fn(),
    evictUser: vi.fn(),
    loginAsUser: vi.fn(),
    logoutUser: vi.fn(),
    getUserSession: vi.fn(),
    invalidateUserSession: vi.fn(),
    getAccountDetails: vi.fn(),
    updateAccountDetails: vi.fn(),
    isAdmin: vi.fn(),
    getAccountStatus: vi.fn()
  }) as unknown as AdminManager

describe('AdminUserService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminUserService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminUserService(
      async () => admin,
      () =>
        ({
          getDomain: () => 'server.com'
        }) as never
    )
  })

  it('getUsers maps SDK payload to UserInfo', async () => {
    // 该后端**不返回** `last_seen_ts` / `last_seen_ip`（SDK 类型注释原文：
    // 「原先声明的 suspended / erased / last_seen_ts / last_seen_ip 该后端从不返回，已删除」，
    // 见 `admin-user-types.d.ts` 的 `AdminAccountDetails`），故 mock 与期望都不应包含它。
    ;(admin as any).getUsersPaginated.mockResolvedValueOnce({
      items: [
        {
          name: '@user:server.com',
          avatar_url: 'mxc://avatar',
          admin: true,
          deactivated: false,
          is_guest: true,
          created_ts: 456,
          displayname: 'User'
        }
      ],
      nextToken: 'next'
    })

    const result = await service.getUsers()

    expect(result).toEqual({
      users: [
        {
          userId: '@user:server.com',
          name: '@user:server.com',
          avatarUrl: 'mxc://avatar',
          admin: true,
          deactivated: false,
          isGuest: true,
          createdTs: 456,
          displayname: 'User'
        }
      ],
      nextToken: 'next'
    })
  })

  it('getUsers respects guest filtering when SDK response mixes guest and normal users', async () => {
    ;(admin as any).getUsersPaginated.mockResolvedValueOnce({
      items: [
        { name: '@guest:server.com', is_guest: true },
        { name: '@user:server.com', is_guest: false }
      ],
      nextToken: undefined
    })

    const result = await service.getUsers(100, undefined, true)

    expect(result.users).toEqual([
      expect.objectContaining({
        userId: '@guest:server.com',
        isGuest: true
      })
    ])
  })

  it('getUserById returns mapped user info from SDK', async () => {
    ;(admin as any).getUserById.mockResolvedValueOnce({
      name: '@bob:server.com',
      displayname: 'Bob Test',
      avatar_url: 'mxc://bob-avatar',
      admin: false,
      deactivated: false,
      is_guest: false,
      created_ts: 789
    })

    const result = await service.getUserById('@bob:server.com')

    expect((admin as any).getUserById).toHaveBeenCalledWith('@bob:server.com', false)
    expect(result).toEqual({
      userId: '@bob:server.com',
      name: '@bob:server.com',
      avatarUrl: 'mxc://bob-avatar',
      admin: false,
      deactivated: false,
      isGuest: false,
      createdTs: 789,
      displayname: 'Bob Test'
    })
  })

  it('getUserById returns null when SDK returns null', async () => {
    ;(admin as any).getUserById.mockResolvedValueOnce(null)

    const result = await service.getUserById('@missing:server.com')

    expect(result).toBeNull()
  })

  it('createUser composes full matrix user id from client domain', async () => {
    ;(admin as any).createUser.mockResolvedValueOnce({ name: '@alice:server.com' })

    const result = await service.createUser('alice', 'secret', { admin: true, displayname: 'Alice' })

    expect((admin as any).createUser).toHaveBeenCalledWith('@alice:server.com', {
      password: 'secret',
      admin: true,
      displayname: 'Alice',
      deactivated: undefined
    })
    expect(result?.userId).toBe('@alice:server.com')
  })

  it('resetPassword validates user id and empty password', async () => {
    await expect(service.resetPassword('bad-id', 'secret')).rejects.toThrow('Invalid user ID')
    await expect(service.resetPassword('@alice:server.com', '')).rejects.toThrow('Password cannot be empty')
  })

  it('deactivateUser rejects invalid user id', async () => {
    await expect(service.deactivateUser('bad-id')).rejects.toThrow('Invalid user ID')
  })

  it('activateUser rejects invalid user id', async () => {
    await expect(service.activateUser('bad-id')).rejects.toThrow('Invalid user ID')
    expect(admin.activateUser).not.toHaveBeenCalled()

    await service.activateUser('@alice:server.com')
    expect(admin.activateUser).toHaveBeenCalledWith('@alice:server.com')
  })

  it('setAdmin rejects invalid user id', async () => {
    await expect(service.setAdmin('bad-id', true)).rejects.toThrow('Invalid user ID')
  })

  it('overrideUserRateLimit rejects invalid user id', async () => {
    await expect(service.overrideUserRateLimit('bad-id')).rejects.toThrow('Invalid user ID')
  })

  it('deleteRateLimit rejects invalid user id', async () => {
    await expect(service.deleteRateLimit('bad-id')).rejects.toThrow('Invalid user ID')
  })

  // 后端 `admin/user.rs:490` 返回 `{joined_rooms: string[], total}` —— 元素是 **room id 字符串**，
  // 没有 membership / is_room_admin 信息（SDK `UserRoomsResponse` 同形）。旧 mock 用的 `rooms`
  // 键在后端不存在，于是解析结果恒为空数组。
  it('getUserRooms maps joined_rooms into facade shape', async () => {
    ;(admin as any).getUserRooms.mockResolvedValueOnce({
      joined_rooms: ['!plain:server.com'],
      total: 1
    })

    const result = await service.getUserRooms('@alice:server.com')

    expect(result).toEqual([{ roomId: '!plain:server.com', membership: '', isRoomAdmin: false }])
  })

  it('batchCreateUsers falls back to created and failed arrays', async () => {
    // 后端 `admin/user.rs:874` 返回 `{created, failed, total}`（SDK 同形，两个键都是 string[]）；
    // 旧 mock 用的是不存在的 `errors` 且元素是对象。
    ;(admin as any).batchCreateUsers.mockResolvedValueOnce({
      created: ['@ok:server.com'],
      failed: ['@bad:server.com'],
      total: 2
    })

    const result = await service.batchCreateUsers([{ username: 'ok', password: 'pass' }])

    expect(result).toEqual([
      { userId: '@ok:server.com', success: true },
      { userId: '@bad:server.com', success: false }
    ])
  })

  it('getRateLimit maps snake_case response', async () => {
    ;(admin as any).getRateLimitOverride.mockResolvedValueOnce({
      messages_per_second: 5,
      burst_count: 10
    })

    const result = await service.getRateLimit('@alice:server.com')

    expect(result).toEqual({
      messagesPerSecond: 5,
      burstCount: 10
    })
  })

  it('loginUserAs maps access token payload', async () => {
    ;(admin as any).loginAsUser.mockResolvedValueOnce({
      access_token: 'token',
      device_id: 'device'
    })

    const result = await service.loginUserAs('@alice:server.com')

    expect(result).toEqual({
      accessToken: 'token',
      deviceId: 'device'
    })
  })

  it('overrideUserRateLimit calls admin.overrideRateLimit without limit param', async () => {
    await service.overrideUserRateLimit('@user:server.com')
    expect((admin as any).overrideRateLimit).toHaveBeenCalledWith('@user:server.com')
    expect((admin as any).overrideRateLimit).toHaveBeenCalledTimes(1)
  })

  it('checkUserAdmin passes throwOnError=false', async () => {
    ;(admin as any).isAdmin.mockResolvedValueOnce(true)

    const result = await service.checkUserAdmin('@alice:server.com')

    expect(result).toBe(true)
    expect((admin as any).isAdmin).toHaveBeenCalledWith('@alice:server.com', false)
  })
})
