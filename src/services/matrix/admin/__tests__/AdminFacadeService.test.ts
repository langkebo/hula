import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { adminService } from '..'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('adminService facade', () => {
  let mockAdminManager: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminManager = {
      setAdmin: vi.fn().mockResolvedValue(undefined),
      resetPassword: vi.fn().mockResolvedValue(undefined),
      deactivateUser: vi.fn().mockResolvedValue(undefined),
      resetFederationConnection: vi.fn().mockResolvedValue(undefined),
      getAccountStatus: vi.fn().mockResolvedValue(null),
      getUserDevices: vi.fn().mockResolvedValue([]),
      deleteUserDevice: vi.fn().mockResolvedValue(undefined),
      deleteUserDevices: vi.fn().mockResolvedValue(undefined),
      shadowBanUser: vi.fn().mockResolvedValue(undefined),
      unshadowBanUser: vi.fn().mockResolvedValue(undefined),
      getShadowBanStatus: vi.fn().mockResolvedValue(null),
      whois: vi.fn().mockResolvedValue(null),
      getFederationDestinations: vi.fn().mockResolvedValue([]),
      getFederationDestination: vi.fn().mockResolvedValue(null),
      getRooms: vi.fn().mockResolvedValue({ rooms: [], next_token: undefined }),
      getRoom: vi.fn().mockResolvedValue(null),
      getRoomMembers: vi.fn().mockResolvedValue([]),
      getRoomState: vi.fn().mockResolvedValue({ state: [] }),
      deleteRoom: vi.fn().mockResolvedValue(undefined),
      blockRoom: vi.fn().mockResolvedValue(undefined),
      shutdownRoom: vi.fn().mockResolvedValue({ kicked_users: [], failed_to_kick_users: [], local_aliases: [] }),
      forceJoinRoom: vi.fn().mockResolvedValue(undefined),
      forceLeaveRoom: vi.fn().mockResolvedValue(undefined),
      getRetentionPolicy: vi.fn().mockResolvedValue(null),
      getRoomRetentionPolicy: vi.fn().mockResolvedValue(null),
      setRoomRetentionPolicy: vi.fn().mockResolvedValue(undefined),
      runRetention: vi.fn().mockResolvedValue(undefined),
      getRetentionStatus: vi.fn().mockResolvedValue({}),
      getRegistrationTokens: vi.fn().mockResolvedValue([]),
      createRegistrationToken: vi.fn().mockResolvedValue({ token: 'x' }),
      updateRegistrationToken: vi.fn().mockResolvedValue(undefined),
      deleteRegistrationToken: vi.fn().mockResolvedValue(undefined),
      getMedia: vi.fn().mockResolvedValue({ media: [], next_token: undefined }),
      deleteMedia: vi.fn().mockResolvedValue(undefined),
      purgeMediaCache: vi.fn().mockResolvedValue({ deleted: 0 }),
      listAuditEvents: vi.fn().mockResolvedValue({ events: [], next_batch: undefined }),
      getAuditEvent: vi.fn().mockResolvedValue(null),
      listSamlMappings: vi.fn().mockResolvedValue({ mappings: [], next_token: undefined }),
      getSamlMapping: vi.fn().mockResolvedValue(null),
      updateSamlMapping: vi.fn().mockResolvedValue(undefined),
      deleteSamlMapping: vi.fn().mockResolvedValue(undefined),
      samlLogout: vi.fn().mockResolvedValue(undefined),
      listApplicationServices: vi.fn().mockResolvedValue({ services: [], next_token: undefined }),
      registerApplicationService: vi.fn().mockResolvedValue({ id: 'as1' }),
      getApplicationService: vi.fn().mockResolvedValue(null),
      updateApplicationService: vi.fn().mockResolvedValue(undefined),
      deleteApplicationService: vi.fn().mockResolvedValue(undefined),
      pingApplicationService: vi.fn().mockResolvedValue({ ok: true, duration_ms: 5 }),
      createSystemNotification: vi.fn().mockResolvedValue({ notification_id: 'n1' }),
      listSystemNotifications: vi.fn().mockResolvedValue({ notifications: [], next_token: undefined }),
      getSystemNotification: vi.fn().mockResolvedValue(null),
      updateSystemNotification: vi.fn().mockResolvedValue(undefined),
      deleteSystemNotification: vi.fn().mockResolvedValue(undefined),
      getUserNotificationSettings: vi.fn().mockResolvedValue({}),
      setUserNotificationSettings: vi.fn().mockResolvedValue(undefined),
      listUserPushers: vi.fn().mockResolvedValue({ pushers: [] }),
      deleteUserPusher: vi.fn().mockResolvedValue(undefined),
      listSpaces: vi.fn().mockResolvedValue({ spaces: [], next_batch: undefined }),
      deleteSpace: vi.fn().mockResolvedValue(undefined),
      getSpace: vi.fn().mockResolvedValue(null),
      listSpaceUsers: vi.fn().mockResolvedValue({ users: [] }),
      listSpaceRooms: vi.fn().mockResolvedValue({ rooms: [] }),
      getSpaceStats: vi.fn().mockResolvedValue({}),
      listSecurityEvents: vi.fn().mockResolvedValue({ events: [], next_token: undefined }),
      listIpBlocks: vi.fn().mockResolvedValue([]),
      blockIp: vi.fn().mockResolvedValue({ ip: '1.2.3.4' }),
      unblockIp: vi.fn().mockResolvedValue(undefined),
      getIpReputation: vi.fn().mockResolvedValue({}),
      restartServer: vi.fn().mockResolvedValue(undefined),
      getServerLogs: vi.fn().mockResolvedValue([]),
      getMediaStats: vi.fn().mockResolvedValue({ total: 0 }),
      getRoomMessages: vi.fn().mockResolvedValue({ chunk: [] }),
      getRoomAliases: vi.fn().mockResolvedValue({ aliases: [] }),
      getRoomVersion: vi.fn().mockResolvedValue(null),
      getRoomBlockStatus: vi.fn().mockResolvedValue({ block: false }),
      unblockRoom: vi.fn().mockResolvedValue(undefined),
      makeRoomAdmin: vi.fn().mockResolvedValue(undefined),
      purgeRoom: vi.fn().mockResolvedValue({ success: true }),
      purgeHistoryGlobal: vi.fn().mockResolvedValue({ purge_id: '' }),
      listRoomStats: vi.fn().mockResolvedValue({ room_stats: [], next_token: undefined }),
      getRoomStats: vi.fn().mockResolvedValue(null),
      getRoomListings: vi.fn().mockResolvedValue(null),
      setRoomPublicListing: vi.fn().mockResolvedValue(undefined),
      getRoomEventContext: vi.fn().mockResolvedValue(null),
      searchInRoom: vi.fn().mockResolvedValue({ results: [] }),
      searchRooms: vi.fn().mockResolvedValue({ rooms: [] }),
      getRoomForwardExtremities: vi.fn().mockResolvedValue({ results: [] }),
      deleteRoomV2: vi.fn().mockResolvedValue({
        kicked_users: [],
        failed_to_kick_users: [],
        local_aliases: []
      }),
      getUsersPaginated: vi.fn().mockResolvedValue({ items: [], nextToken: undefined }),
      getUser: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue({}),
      getUserRooms: vi.fn().mockResolvedValue({ rooms: [] }),
      getUserStats: vi.fn().mockResolvedValue({}),
      listUserStats: vi.fn().mockResolvedValue({ user_stats: [], next_token: undefined }),
      batchCreateUsers: vi.fn().mockResolvedValue({ results: [] }),
      batchDeactivateUsers: vi.fn().mockResolvedValue({ results: [] }),
      evictUser: vi.fn().mockResolvedValue({}),
      loginAsUser: vi.fn().mockResolvedValue({ access_token: '', device_id: '' }),
      logoutUserDevices: vi.fn().mockResolvedValue({}),
      getUserSessions: vi.fn().mockResolvedValue({ sessions: [] }),
      invalidateUserSessions: vi.fn().mockResolvedValue({}),
      getAccountDetails: vi.fn().mockResolvedValue(null),
      updateAccount: vi.fn().mockResolvedValue({}),
      isAdmin: vi.fn().mockResolvedValue(false),
      listLoginFailures: vi.fn().mockResolvedValue({ failures: [], next_token: undefined }),
      getSamlConfig: vi.fn().mockResolvedValue({}),
      updateSamlConfig: vi.fn().mockResolvedValue(undefined),
      getExperimentalFeatures: vi.fn().mockResolvedValue({ features: {} }),
      updateFeatureFlag: vi.fn().mockResolvedValue({}),
      listBackups: vi.fn().mockResolvedValue({ backups: [] }),
      registerNonce: vi.fn().mockResolvedValue(''),
      adminRegister: vi.fn().mockResolvedValue({}),
      getServerStats: vi.fn().mockResolvedValue({}),
      getServerStatus: vi.fn().mockResolvedValue(null),
      getServerHealth: vi.fn().mockResolvedValue(null),
      getServerVersion: vi.fn().mockResolvedValue({ server_version: '', python_version: '' }),
      getServerConfig: vi.fn().mockResolvedValue({}),
      getServerInfo: vi.fn().mockResolvedValue(null),
      sendServerNotice: vi.fn().mockResolvedValue({ event_id: '' }),
      getServerNotices: vi.fn().mockResolvedValue({ notices: [] }),
      getRateLimitOverride: vi.fn().mockResolvedValue(null),
      overrideRateLimit: vi.fn().mockResolvedValue(undefined),
      deleteRateLimitOverride: vi.fn().mockResolvedValue(undefined),
      getRateLimit: vi.fn().mockResolvedValue(null),
      setRateLimit: vi.fn().mockResolvedValue(undefined),
      deleteRateLimit: vi.fn().mockResolvedValue(undefined)
    }
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserId: vi.fn(() => '@admin:server.com'),
      getAccessToken: vi.fn(() => 'token'),
      getDomain: vi.fn(() => 'server.com'),
      http: { authedRequest: vi.fn() },
      getAdminManager: vi.fn(() => mockAdminManager)
    } as any)
    vi.mocked(invoke).mockResolvedValue({ is_admin: true, user_id: '@admin:server.com' } as any)
  })

  describe('Server Management', () => {
    it('should return fallback stats when runtime client is missing', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)
      const result = await adminService.getServerStats()
      expect(result).toEqual({
        roomCount: 0,
        userCount: 0,
        dailyActiveUsers: 0,
        monthlyActiveUsers: 0,
        messageCount: 0,
        startServerTime: 0
      })
    })

    it('should get server stats', async () => {
      mockAdminManager.getServerStats.mockResolvedValue({
        total_rooms: 5,
        total_users: 20,
        daily_active_users: 7,
        monthly_active_users: 18,
        total_nonlocal_users: 99,
        server_start_time: 123456
      })
      const result = await adminService.getServerStats()
      expect(result.roomCount).toBe(5)
      expect(result.userCount).toBe(20)
    })

    it('should get server version', async () => {
      mockAdminManager.getServerVersion.mockResolvedValue({ server_version: '1.100.0', python_version: '3.11' })
      const result = await adminService.getServerVersion()
      expect(result?.serverVersion).toBe('1.100.0')
    })

    it('should restart server via SDK', async () => {
      await expect(adminService.restartServer()).resolves.toBeUndefined()
      expect(mockAdminManager.restartServer).toHaveBeenCalled()
    })

    it('should get experimental features via SDK', async () => {
      mockAdminManager.getExperimentalFeatures.mockResolvedValue({ features: { msc1234: true } })
      const result = await adminService.getExperimentalFeatures()
      expect(result).toEqual({ msc1234: true })
    })

    it('should set experimental feature via SDK feature-flag', async () => {
      await adminService.setExperimentalFeature('msc1234', true)
      expect(mockAdminManager.updateFeatureFlag).toHaveBeenCalledWith('msc1234', { status: 'enabled' })
    })

    it('should get backups via SDK', async () => {
      mockAdminManager.listBackups.mockResolvedValue({ backups: [{ id: 1 }] })
      const result = await adminService.getBackups()
      expect(result).toHaveLength(1)
    })
  })

  describe('User Management', () => {
    it('should get users', async () => {
      mockAdminManager.getUsersPaginated.mockResolvedValue({
        items: [{ name: '@user:server', displayname: 'User', admin: false, deactivated: false }],
        nextToken: 'abc'
      })
      const result = await adminService.getUsers()
      expect(result.users).toHaveLength(1)
      expect(result.users[0].userId).toBe('@user:server')
      expect(result.nextToken).toBe('abc')
    })

    it('should get user via legacy facade delegator', async () => {
      mockAdminManager.getUser.mockResolvedValue({
        name: '@user:server',
        displayname: 'User',
        admin: true,
        deactivated: false
      })

      const result = await adminService.getUser('@user:server')

      expect(result).toEqual({
        userId: '@user:server',
        name: '@user:server',
        displayname: 'User',
        admin: true,
        deactivated: false
      })
      expect(mockAdminManager.getUser).toHaveBeenCalledWith('@user:server', false)
    })

    it('should create and update users via legacy facade delegators', async () => {
      mockAdminManager.createUser.mockResolvedValue({ name: '@new:server.com' })

      const created = await adminService.createUser('new', 'pass', {
        admin: true,
        displayname: 'New User',
        deactivated: false
      })

      expect(created).toEqual({
        userId: '@new:server.com',
        name: 'new',
        admin: true,
        displayname: 'New User'
      })
      expect(mockAdminManager.createUser).toHaveBeenCalledWith('@new:server.com', {
        password: 'pass',
        admin: true,
        displayname: 'New User',
        deactivated: false
      })

      await expect(adminService.resetPassword('@user:server.com', 'newpass')).resolves.toBeUndefined()
      expect(mockAdminManager.resetPassword).toHaveBeenCalledWith('@user:server.com', 'newpass')

      await expect(adminService.setAdmin('@user:server.com', true)).resolves.toBeUndefined()
      expect(mockAdminManager.setAdmin).toHaveBeenCalledWith('@user:server.com', true)

      await expect(adminService.deactivateUser('@user:server.com')).resolves.toBeUndefined()
      expect(mockAdminManager.deactivateUser).toHaveBeenCalledWith('@user:server.com')
    })

    it('should manage user devices via legacy facade delegators', async () => {
      mockAdminManager.getUserDevices.mockResolvedValue([
        {
          device_id: 'dev1',
          display_name: 'Phone',
          last_seen_ip: '1.2.3.4',
          last_seen_ts: 123456
        }
      ])

      const devices = await adminService.getUserDevices('@user:server')

      expect(devices).toEqual([
        {
          deviceId: 'dev1',
          displayName: 'Phone',
          lastSeenIp: '1.2.3.4',
          lastSeenTs: 123456,
          userAgent: undefined
        }
      ])
      expect(mockAdminManager.getUserDevices).toHaveBeenCalledWith('@user:server')

      await expect(adminService.deleteUserDevice('@user:server', 'dev1')).resolves.toBeUndefined()
      expect(mockAdminManager.deleteUserDevice).toHaveBeenCalledWith('@user:server', 'dev1')

      await expect(adminService.deleteUserDevices('@user:server', ['dev1', 'dev2'])).resolves.toBeUndefined()
      expect(mockAdminManager.deleteUserDevices).toHaveBeenCalledWith('@user:server', ['dev1', 'dev2'])
    })

    it('should manage legacy rate limit delegators', async () => {
      mockAdminManager.getRateLimitOverride.mockResolvedValue({
        messages_per_second: 5,
        burst_count: 10
      })

      const rateLimit = await adminService.getRateLimit('@user:server')

      expect(rateLimit).toEqual({
        messagesPerSecond: 5,
        burstCount: 10
      })
      expect(mockAdminManager.getRateLimitOverride).toHaveBeenCalledWith('@user:server', false)

      await expect(
        adminService.setRateLimit('@user:server', {
          messagesPerSecond: 20,
          burstCount: 40
        })
      ).resolves.toBeUndefined()
      expect(mockAdminManager.overrideRateLimit).toHaveBeenCalledWith('@user:server')

      await expect(adminService.deleteRateLimit('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.deleteRateLimitOverride).toHaveBeenCalledWith('@user:server')
    })

    it('should manage shadow ban status and whois via legacy facade delegators', async () => {
      mockAdminManager.getShadowBanStatus.mockResolvedValue({
        banned: true,
        banned_at: 123456
      })
      mockAdminManager.whois.mockResolvedValue({
        user_id: '@user:server',
        devices: { dev1: { sessions: [] } }
      })

      await expect(adminService.shadowBanUser('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.shadowBanUser).toHaveBeenCalledWith('@user:server')

      await expect(adminService.unshadowBanUser('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.unshadowBanUser).toHaveBeenCalledWith('@user:server')

      const shadowBanStatus = await adminService.getShadowBanStatus('@user:server')
      expect(shadowBanStatus).toEqual({
        banned: true,
        bannedAt: 123456
      })
      expect(mockAdminManager.getShadowBanStatus).toHaveBeenCalledWith('@user:server')

      const whois = await adminService.getWhois('@user:server')
      expect(whois).toEqual({
        user_id: '@user:server',
        devices: { dev1: { sessions: [] } }
      })
      expect(mockAdminManager.whois).toHaveBeenCalledWith('@user:server')
    })

    it('should get user rooms via SDK', async () => {
      mockAdminManager.getUserRooms.mockResolvedValue({
        rooms: [{ room_id: '!room:server', membership: 'join', is_room_admin: true }]
      })
      const result = await adminService.getUserRooms('@user:server')
      expect(result).toHaveLength(1)
      expect(result[0].roomId).toBe('!room:server')
      expect(result[0].isRoomAdmin).toBe(true)
      expect(mockAdminManager.getUserRooms).toHaveBeenCalledWith('@user:server')
    })

    it('should batch create users via SDK', async () => {
      mockAdminManager.batchCreateUsers.mockResolvedValue({
        results: [{ user_id: '@u1:server', success: true }]
      })
      const result = await adminService.batchCreateUsers([{ username: 'u1', password: 'pass' }])
      expect(result).toHaveLength(1)
      expect(result[0].success).toBe(true)
      expect(mockAdminManager.batchCreateUsers).toHaveBeenCalled()
    })

    it('should batch deactivate users via SDK', async () => {
      mockAdminManager.batchDeactivateUsers.mockResolvedValue({
        results: [{ user_id: '@u1:server', success: true }]
      })
      const result = await adminService.batchDeactivateUsers(['@u1:server'])
      expect(result).toHaveLength(1)
      expect(mockAdminManager.batchDeactivateUsers).toHaveBeenCalledWith(['@u1:server'], false)
    })

    it('should evict user via SDK', async () => {
      await expect(adminService.evictUser('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.evictUser).toHaveBeenCalledWith('@user:server')
    })

    it('should login as user via SDK', async () => {
      mockAdminManager.loginAsUser.mockResolvedValue({ access_token: 'at', device_id: 'dev' })
      const result = await adminService.loginUserAs('@user:server')
      expect(result?.accessToken).toBe('at')
      expect(mockAdminManager.loginAsUser).toHaveBeenCalledWith('@user:server')
    })

    it('should logout all user devices via SDK', async () => {
      await expect(adminService.logoutUserAll('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.logoutUserDevices).toHaveBeenCalledWith('@user:server')
    })

    it('should get user sessions via SDK', async () => {
      mockAdminManager.getUserSessions.mockResolvedValue({ sessions: [{ id: 1 }] })
      const result = await adminService.getUserSessions('@user:server')
      expect(result).toHaveLength(1)
    })

    it('should check user admin status via SDK', async () => {
      mockAdminManager.isAdmin.mockResolvedValue(true)
      const result = await adminService.checkUserAdmin('@user:server')
      expect(result).toBe(true)
      expect(mockAdminManager.isAdmin).toHaveBeenCalledWith('@user:server', false)
    })

    it('should set user admin via SDK', async () => {
      await adminService.setUserAdmin('@user:server', true)
      expect(mockAdminManager.setAdmin).toHaveBeenCalledWith('@user:server', true)
    })

    it('should deactivate user v2 via SDK', async () => {
      await expect(adminService.deactivateUserV2('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.deactivateUser).toHaveBeenCalledWith('@user:server')
    })

    it('should reset password v2 via SDK', async () => {
      await expect(adminService.resetPasswordV2('@user:server', 'newpass')).resolves.toBeUndefined()
      expect(mockAdminManager.resetPassword).toHaveBeenCalledWith('@user:server', 'newpass')
    })

    it('should get account status', async () => {
      mockAdminManager.getAccountStatus.mockResolvedValue({ locked: false })
      const result = await adminService.getAccountStatus('@user:server')
      expect(result?.locked).toBe(false)
      expect(mockAdminManager.getAccountStatus).toHaveBeenCalledWith('@user:server')
    })

    it('should get login failures via SDK', async () => {
      mockAdminManager.listLoginFailures.mockResolvedValue({
        failures: [{ ip: '1.2.3.4' }],
        next_token: 'x'
      })
      const result = await adminService.getLoginFailures()
      expect(result.failures).toHaveLength(1)
      expect(mockAdminManager.listLoginFailures).toHaveBeenCalledWith({ limit: 50, from: undefined })
    })
  })

  describe('Room Management Extended', () => {
    it('should get room messages via SDK', async () => {
      mockAdminManager.getRoomMessages.mockResolvedValue({
        chunk: [{ type: 'm.room.message' }],
        start: 's1',
        end: 'e1'
      })
      const result = await adminService.getRoomMessages('!room:server', 25, 'from', 'f')
      expect(result.chunk).toHaveLength(1)
      expect(result.start).toBe('s1')
      expect(mockAdminManager.getRoomMessages).toHaveBeenCalledWith('!room:server', {
        limit: 25,
        from: 'from',
        dir: 'f'
      })
    })

    it('should get room aliases via SDK', async () => {
      mockAdminManager.getRoomAliases.mockResolvedValue({ aliases: ['#room:server'] })
      const result = await adminService.getRoomAliases('!room:server')
      expect(result).toHaveLength(1)
    })

    it('should get room version via SDK', async () => {
      mockAdminManager.getRoomVersion.mockResolvedValue({ room_version: '10' })
      const result = await adminService.getRoomVersion('!room:server')
      expect(result).toBe('10')
      expect(mockAdminManager.getRoomVersion).toHaveBeenCalledWith('!room:server', false)
    })

    it('should get room block status via SDK', async () => {
      mockAdminManager.getRoomBlockStatus.mockResolvedValue({ block: true })
      const result = await adminService.getRoomBlockStatus('!room:server')
      expect(result).toBe(true)
    })

    it('should unblock room via SDK', async () => {
      await expect(adminService.unblockRoom('!room:server')).resolves.toBeUndefined()
      expect(mockAdminManager.unblockRoom).toHaveBeenCalledWith('!room:server')
    })

    it('should make room admin via SDK', async () => {
      await adminService.makeRoomAdmin('!room:server', '@user:server')
      expect(mockAdminManager.makeRoomAdmin).toHaveBeenCalledWith('!room:server', '@user:server')
    })

    it('should purge history via SDK with field mapping', async () => {
      mockAdminManager.purgeHistoryGlobal.mockResolvedValue({ purge_id: 'pid123' })
      const result = await adminService.purgeHistory('!room:server', {
        purgeUpToTs: 123456,
        purgeUpToEventId: '$e1',
        deleteLocalEvents: true
      })
      expect(result.purgeId).toBe('pid123')
      expect(mockAdminManager.purgeHistoryGlobal).toHaveBeenCalledWith('!room:server', {
        purge_up_to_event_id: '$e1',
        purge_up_to_ts: 123456,
        delete_local_events: true
      })
    })

    it('should purge room via SDK', async () => {
      await expect(adminService.purgeRoom('!room:server')).resolves.toBeUndefined()
      expect(mockAdminManager.purgeRoom).toHaveBeenCalledWith('!room:server')
    })

    it('should get room stats via SDK list', async () => {
      mockAdminManager.listRoomStats.mockResolvedValue({
        room_stats: [{ joined_members: 5 }],
        next_token: 'n'
      })
      const result = await adminService.getRoomStats(50, 'f')
      expect(result.stats).toHaveLength(1)
      expect(result.nextToken).toBe('n')
      expect(mockAdminManager.listRoomStats).toHaveBeenCalledWith({ limit: 50, from: 'f' })
    })

    it('should search in room via SDK', async () => {
      mockAdminManager.searchInRoom.mockResolvedValue({ results: [{ event_id: '$e1' }] })
      const result = await adminService.searchInRoom('!room:server', 'test')
      expect(result.results).toHaveLength(1)
      expect(mockAdminManager.searchInRoom).toHaveBeenCalledWith('!room:server', 'test', 50)
    })

    it('should search rooms globally via SDK', async () => {
      mockAdminManager.searchRooms.mockResolvedValue({ rooms: [{ room_id: '!r1:server' }] })
      const result = await adminService.searchRooms('test')
      expect(result.rooms).toHaveLength(1)
      expect(mockAdminManager.searchRooms).toHaveBeenCalledWith('test', 50)
    })

    it('should get room forward extremities via SDK (object form tolerant)', async () => {
      mockAdminManager.getRoomForwardExtremities.mockResolvedValue({ results: [{ event_id: '$e1' }] })
      const result = await adminService.getRoomForwardExtremities('!room:server')
      expect(result).toHaveLength(1)
    })

    it('should delete room v2 via SDK with field mapping', async () => {
      mockAdminManager.deleteRoomV2.mockResolvedValue({
        kicked_users: ['@u1:server'],
        failed_to_kick_users: [],
        local_aliases: ['#room:server'],
        new_room_id: '!new:server'
      })
      const result = await adminService.deleteRoomV2('!room:server', {
        purge: true,
        newRoomUserId: '@new:server',
        roomName: 'n'
      })
      expect(result.kickedUsers).toHaveLength(1)
      expect(result.newRoomId).toBe('!new:server')
      expect(mockAdminManager.deleteRoomV2).toHaveBeenCalledWith('!room:server', {
        purge: true,
        new_room_user_id: '@new:server',
        room_name: 'n'
      })
    })
  })

  describe('Space Management Extended', () => {
    it('should get space details via SDK', async () => {
      mockAdminManager.getSpace.mockResolvedValue({ room_id: '!space:server', name: 'Test' })
      const result = await adminService.getSpaceDetails('!space:server')
      expect(result?.room_id).toBe('!space:server')
      expect(mockAdminManager.getSpace).toHaveBeenCalledWith('!space:server', false)
    })

    it('should get space users via SDK', async () => {
      mockAdminManager.listSpaceUsers.mockResolvedValue({ users: [{ user_id: '@u1:server' }] })
      const result = await adminService.getSpaceUsers('!space:server')
      expect(result).toHaveLength(1)
      expect(mockAdminManager.listSpaceUsers).toHaveBeenCalledWith('!space:server')
    })

    it('should get space rooms via SDK', async () => {
      mockAdminManager.listSpaceRooms.mockResolvedValue({ rooms: [{ room_id: '!r1:server' }] })
      const result = await adminService.getSpaceRooms('!space:server')
      expect(result).toHaveLength(1)
      expect(mockAdminManager.listSpaceRooms).toHaveBeenCalledWith('!space:server')
    })

    it('should get space stats via SDK', async () => {
      mockAdminManager.getSpaceStats.mockResolvedValue({ total_rooms: 5 })
      const result = await adminService.getSpaceStats('!space:server')
      expect(result?.total_rooms).toBe(5)
      expect(mockAdminManager.getSpaceStats).toHaveBeenCalledWith('!space:server')
    })
  })

  describe('Federation Extended', () => {
    it('should get federation server status via SDK', async () => {
      mockAdminManager.getFederationDestination.mockResolvedValue({ online: true })
      const result = await adminService.getFederationServerStatus('server.com')
      expect(result?.online).toBe(true)
      expect(mockAdminManager.getFederationDestination).toHaveBeenCalledWith('server.com', false)
    })

    it('should reconnect federation via SDK', async () => {
      await expect(adminService.reconnectFederation('server.com')).resolves.toBeUndefined()
      expect(mockAdminManager.resetFederationConnection).toHaveBeenCalledWith('server.com')
    })
  })

  describe('Retention Policy', () => {
    it('should get retention policies', async () => {
      mockAdminManager.getRetentionPolicy.mockResolvedValue({ max_lifetime: 86400000 })
      const result = await adminService.getRetentionPolicies()
      expect(result.policies).toHaveLength(1)
    })

    it('should get retention policy for room', async () => {
      mockAdminManager.getRoomRetentionPolicy.mockResolvedValue({ max_lifetime: 86400000 })
      const result = await adminService.getRetentionPolicy('!room:server')
      expect(result?.max_lifetime).toBe(86400000)
    })

    it('should set retention policy', async () => {
      await adminService.setRetentionPolicy('!room:server', 86400000)
      expect(mockAdminManager.setRoomRetentionPolicy).toHaveBeenCalledWith('!room:server', {
        max_lifetime: 86400000
      })
    })

    it('should delete retention policy', async () => {
      await expect(adminService.deleteRetentionPolicy('!room:server')).resolves.toBeUndefined()
    })

    it('should run retention task', async () => {
      await expect(adminService.runRetentionTask()).resolves.toBeUndefined()
      expect(mockAdminManager.runRetention).toHaveBeenCalled()
    })

    it('should get retention status', async () => {
      mockAdminManager.getRetentionStatus.mockResolvedValue({ running: true })
      const result = await adminService.getRetentionStatus()
      expect(result.running).toBe(true)
    })
  })

  describe('Admin Registration', () => {
    it('should get registration nonce via SDK', async () => {
      mockAdminManager.registerNonce.mockResolvedValue('abc123')
      const result = await adminService.getRegistrationNonce()
      expect(result).toBe('abc123')
    })

    it('should admin register user via SDK', async () => {
      mockAdminManager.adminRegister.mockResolvedValue({
        access_token: 'at',
        user_id: '@new:server',
        device_id: 'dev'
      })
      const result = await adminService.adminRegister('new', 'pass', 'nonce')
      expect(result?.userId).toBe('@new:server')
      expect(mockAdminManager.adminRegister).toHaveBeenCalledWith({
        username: 'new',
        password: 'pass',
        nonce: 'nonce',
        admin: false,
        displayname: 'new',
        mac: undefined
      })
    })
  })

  describe('SAML Extended', () => {
    it('should get saml mappings via SDK', async () => {
      mockAdminManager.listSamlMappings.mockResolvedValue({
        mappings: [{ name_id: 'n1' }],
        next_token: 'n'
      })
      const result = await adminService.getSamlMappings(25, 'tok')
      expect(result.mappings).toHaveLength(1)
      expect(result.nextToken).toBe('n')
      expect(mockAdminManager.listSamlMappings).toHaveBeenCalledWith({ limit: 25, from: 'tok' })
    })

    it('should delete saml mapping via SDK', async () => {
      await adminService.deleteSamlMapping('n1')
      expect(mockAdminManager.deleteSamlMapping).toHaveBeenCalledWith('n1')
    })

    it('should saml logout via SDK', async () => {
      await adminService.samlLogout('@user:server')
      expect(mockAdminManager.samlLogout).toHaveBeenCalledWith('@user:server')
    })
  })

  describe('Notification Extended', () => {
    it('should get user notification settings via SDK', async () => {
      mockAdminManager.getUserNotificationSettings.mockResolvedValue({ enabled: true })
      const result = await adminService.getUserNotificationSettings('@user:server')
      expect(result?.enabled).toBe(true)
      expect(mockAdminManager.getUserNotificationSettings).toHaveBeenCalledWith('@user:server')
    })

    it('should set user notification settings via SDK', async () => {
      await adminService.setUserNotificationSettings('@user:server', { enabled: false })
      expect(mockAdminManager.setUserNotificationSettings).toHaveBeenCalledWith('@user:server', { enabled: false })
    })

    it('should get user pushers via SDK', async () => {
      mockAdminManager.listUserPushers.mockResolvedValue({ pushers: [{ pushkey: 'pk1' }] })
      const result = await adminService.getUserPushers('@user:server')
      expect(result).toHaveLength(1)
      expect(mockAdminManager.listUserPushers).toHaveBeenCalledWith('@user:server')
    })

    it('should delete user pusher via SDK', async () => {
      await adminService.deleteUserPusher('@user:server', 'pk1', 'app')
      expect(mockAdminManager.deleteUserPusher).toHaveBeenCalledWith('@user:server', 'pk1', 'app')
    })
  })

  describe('Application Services', () => {
    it('should list application services via SDK', async () => {
      mockAdminManager.listApplicationServices.mockResolvedValue({
        services: [{ id: 'as1' }],
        next_token: 't'
      })
      const result = await adminService.getApplicationServices(10, 'from')
      expect(result.services).toHaveLength(1)
      expect(mockAdminManager.listApplicationServices).toHaveBeenCalledWith({ limit: 10, from: 'from' })
    })

    it('should register application service via SDK', async () => {
      await adminService.registerApplicationService('tok', { url: 'x' })
      expect(mockAdminManager.registerApplicationService).toHaveBeenCalledWith('tok', { url: 'x' })
    })

    it('should ping application service via SDK', async () => {
      mockAdminManager.pingApplicationService.mockResolvedValue({ ok: true, duration_ms: 42 })
      const result = await adminService.pingApplicationService('as1')
      expect(result).toEqual({ ok: true, durationMs: 42 })
      expect(mockAdminManager.pingApplicationService).toHaveBeenCalledWith('as1')
    })
  })

  describe('System Notifications CRUD', () => {
    it('should create system notification via SDK', async () => {
      mockAdminManager.createSystemNotification.mockResolvedValue({ notification_id: 'n1' })
      const result = await adminService.createSystemNotification('hello', 'info', ['@u:s'])
      expect(result.notificationId).toBe('n1')
      expect(mockAdminManager.createSystemNotification).toHaveBeenCalledWith({
        content: 'hello',
        type: 'info',
        target_users: ['@u:s']
      })
    })

    it('should list system notifications via SDK', async () => {
      mockAdminManager.listSystemNotifications.mockResolvedValue({
        notifications: [{ notification_id: 'n1' }],
        next_token: 't'
      })
      const result = await adminService.getSystemNotifications(5, 'from')
      expect(result.notifications).toHaveLength(1)
      expect(mockAdminManager.listSystemNotifications).toHaveBeenCalledWith({ limit: 5, from: 'from' })
    })

    it('should delete system notification via SDK', async () => {
      await adminService.deleteSystemNotification('n1')
      expect(mockAdminManager.deleteSystemNotification).toHaveBeenCalledWith('n1')
    })
  })

  describe('Media Extended', () => {
    it('should purge media cache', async () => {
      mockAdminManager.purgeMediaCache.mockResolvedValue({ deleted: 42 })
      const result = await adminService.purgeMediaCache(123456)
      expect(result.deleted).toBe(42)
      expect(mockAdminManager.purgeMediaCache).toHaveBeenCalledWith(123456)
    })
  })

  describe('Audit Extended', () => {
    it('should get audit event via SDK', async () => {
      mockAdminManager.getAuditEvent.mockResolvedValue({ event_id: '$e1', type: 'login' })
      const result = await adminService.getAuditEvent('$e1')
      expect(result?.event_id).toBe('$e1')
      expect(mockAdminManager.getAuditEvent).toHaveBeenCalledWith('$e1')
    })

    it('should list audit log via SDK', async () => {
      mockAdminManager.listAuditEvents.mockResolvedValue({
        events: [{ event_id: '$e1' }],
        next_batch: 'tok2'
      })
      const result = await adminService.getAuditLog(25, '1700000000', '@u:server', 'login')
      expect(result.logs).toHaveLength(1)
      expect(result.next_batch).toBe('tok2')
      expect(mockAdminManager.listAuditEvents).toHaveBeenCalledWith({
        limit: 25,
        from: 1700000000,
        actor_id: '@u:server',
        action: 'login'
      })
    })
  })

  describe('Security + Server Ops', () => {
    it('should list security events via SDK', async () => {
      mockAdminManager.listSecurityEvents.mockResolvedValue({
        events: [{ event_id: '$s1' }],
        next_token: 'tok'
      })
      const result = await adminService.getSecurityEvents(50, 'f', { event_type: 'login_fail' })
      expect(result?.events).toHaveLength(1)
      expect(result?.nextToken).toBe('tok')
      expect(mockAdminManager.listSecurityEvents).toHaveBeenCalledWith({
        limit: 50,
        from: 'f',
        event_type: 'login_fail'
      })
    })

    it('should list ip blocks via SDK', async () => {
      mockAdminManager.listIpBlocks.mockResolvedValue([{ ip: '1.2.3.4' }])
      const result = await adminService.getIpBlocks()
      expect(result).toHaveLength(1)
      expect(mockAdminManager.listIpBlocks).toHaveBeenCalled()
    })

    it('should block ip via SDK with mapped options', async () => {
      mockAdminManager.blockIp.mockResolvedValue({ ip: '1.2.3.4' })
      const result = await adminService.blockIp('1.2.3.4', { cidr: 24, expireAt: 999, reason: 'abuse' })
      expect(result?.ip).toBe('1.2.3.4')
      expect(mockAdminManager.blockIp).toHaveBeenCalledWith('1.2.3.4', {
        cidr: 24,
        expire_at: 999,
        reason: 'abuse'
      })
    })

    it('should unblock ip via SDK', async () => {
      await adminService.unblockIp('1.2.3.4')
      expect(mockAdminManager.unblockIp).toHaveBeenCalledWith('1.2.3.4')
    })

    it('should get ip reputation via SDK', async () => {
      mockAdminManager.getIpReputation.mockResolvedValue({ score: 10 })
      const result = await adminService.getIpReputation('1.2.3.4')
      expect(result?.score).toBe(10)
      expect(mockAdminManager.getIpReputation).toHaveBeenCalledWith('1.2.3.4')
    })

    it('should get server logs via SDK', async () => {
      mockAdminManager.getServerLogs.mockResolvedValue([{ level: 'warn', message: 'x' }])
      const result = await adminService.getServerLogs('warn', 10)
      expect(result).toHaveLength(1)
      expect(mockAdminManager.getServerLogs).toHaveBeenCalledWith({ level: 'warn', limit: 10 })
    })

    it('should get media stats via SDK', async () => {
      mockAdminManager.getMediaStats.mockResolvedValue({ total: 42 })
      const result = await adminService.getMediaStats()
      expect(result?.total).toBe(42)
      expect(mockAdminManager.getMediaStats).toHaveBeenCalled()
    })
  })
})
