import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminUserService } from '../UserService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () =>
  ({
    getUsersPaginated: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    resetPassword: vi.fn(),
    setAdmin: vi.fn(),
    deactivateUser: vi.fn(),
    getUserDevices: vi.fn(),
    deleteUserDevice: vi.fn(),
    deleteUserDevices: vi.fn(),
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
    ;(admin as any).getUsersPaginated.mockResolvedValueOnce({
      items: [
        {
          name: '@user:server.com',
          avatar_url: 'mxc://avatar',
          admin: true,
          deactivated: false,
          is_guest: true,
          created_ts: 456,
          displayname: 'User',
          last_seen_ts: 123
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
          displayname: 'User',
          lastSeenTs: 123
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

    const result = await service.getUsers(100, undefined, undefined, true)

    expect(result.users).toEqual([
      expect.objectContaining({
        userId: '@guest:server.com',
        isGuest: true
      })
    ])
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

  it('getUserRooms supports string and object room entries', async () => {
    ;(admin as any).getUserRooms.mockResolvedValueOnce({
      rooms: ['!plain:server.com', { room_id: '!rich:server.com', membership: 'join', is_room_admin: true }]
    })

    const result = await service.getUserRooms('@alice:server.com')

    expect(result).toEqual([
      { roomId: '!plain:server.com', membership: '', isRoomAdmin: false },
      { roomId: '!rich:server.com', membership: 'join', isRoomAdmin: true }
    ])
  })

  it('batchCreateUsers falls back to created and failed arrays', async () => {
    ;(admin as any).batchCreateUsers.mockResolvedValueOnce({
      created: ['@ok:server.com'],
      errors: [{ user_id: '@bad:server.com' }]
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

  it('checkUserAdmin passes throwOnError=false', async () => {
    ;(admin as any).isAdmin.mockResolvedValueOnce(true)

    const result = await service.checkUserAdmin('@alice:server.com')

    expect(result).toBe(true)
    expect((admin as any).isAdmin).toHaveBeenCalledWith('@alice:server.com', false)
  })
})
