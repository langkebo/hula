import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { isNonEmptyString, isValidMatrixUserId } from '@/utils/inputValidation'
import type { RateLimit, ShadowBanStatus, UserDevice, UserInfo } from './AdminTypes'

type UserDomainClientGetter = () => MatrixClient
type UserDomainSdkGetter = () => Promise<unknown>

export class AdminUserService {
  constructor(
    private readonly sdkAdmin: UserDomainSdkGetter,
    private readonly getClient: UserDomainClientGetter
  ) {}

  async getUsers(
    limit = 100,
    from?: string,
    name?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUsersPaginated(options: { from?: string; limit?: number; name?: string }): Promise<{
          items?: Array<Record<string, unknown>>
          nextToken?: string
        }>
      }
      const result = await admin.getUsersPaginated({ from, limit, name })
      const users = (result?.items ?? []).map((user) => this.mapUserInfo(user))
      const filteredUsers =
        typeof guests === 'boolean' ? users.filter((user) => Boolean(user.isGuest) === guests) : users
      return { users: filteredUsers, nextToken: result?.nextToken }
    } catch (err) {
      error(`[Admin] 获取用户列表失败: ${err}`)
      return { users: [] }
    }
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUser(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const user = await admin.getUser(userId, false)
      return user ? this.mapUserInfo(user, userId) : null
    } catch (err) {
      error(`[Admin] 获取用户信息失败: ${err}`)
      return null
    }
  }

  async createUser(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        createUser(
          userId: string,
          options?: { password?: string; displayname?: string; admin?: boolean; deactivated?: boolean }
        ): Promise<Record<string, unknown>>
      }
      const userId = `@${username}:${this.getClient().getDomain()}`
      const user = await admin.createUser(userId, {
        password,
        admin: options?.admin || false,
        displayname: options?.displayname,
        deactivated: options?.deactivated
      })
      info(`[Admin] 用户已创建: ${username}`)
      return {
        userId: (user?.name as string) || username,
        name: username,
        admin: options?.admin,
        displayname: options?.displayname
      }
    } catch (err) {
      error(`[Admin] 创建用户失败: ${err}`)
      return null
    }
  }

  async getRegistrationNonce(): Promise<string> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        registerNonce(): Promise<string>
      }
      return (await admin.registerNonce()) ?? ''
    } catch (err) {
      error(`[Admin] 获取注册 nonce 失败: ${err}`)
      return ''
    }
  }

  async adminRegister(
    username: string,
    password: string,
    nonce: string,
    admin = false,
    mac?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string } | null> {
    try {
      const adminMgr = (await this.sdkAdmin()) as unknown as {
        adminRegister(options: {
          username: string
          password: string
          admin?: boolean
          displayname?: string
          nonce?: string
          mac?: string
        }): Promise<{ access_token?: string; user_id?: string; device_id?: string }>
      }
      const result = await adminMgr.adminRegister({
        username,
        password,
        nonce,
        admin,
        displayname: username,
        mac
      })
      info(`[Admin] 管理员注册用户: ${username}`)
      return {
        accessToken: result?.access_token ?? '',
        userId: result?.user_id ?? '',
        deviceId: result?.device_id ?? ''
      }
    } catch (err) {
      error(`[Admin] 管理员注册用户失败: ${err}`)
      return null
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    if (!isNonEmptyString(newPassword)) throw new Error('Password cannot be empty')
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        resetPassword(userId: string, newPassword: string): Promise<void>
      }
      await admin.resetPassword(userId, newPassword)
      info(`[Admin] 密码已重置: ${userId}`)
    } catch (err) {
      error(`[Admin] 重置密码失败: ${err}`)
      throw err
    }
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setAdmin(userId: string, isAdmin: boolean): Promise<void>
      }
      await admin.setAdmin(userId, isAdmin)
      info(`[Admin] 管理员权限已${isAdmin ? '授予' : '撤销'}: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置管理员权限失败: ${err}`)
      throw err
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deactivateUser(userId: string): Promise<void>
      }
      await admin.deactivateUser(userId)
      info(`[Admin] 用户已停用: ${userId}`)
    } catch (err) {
      error(`[Admin] 停用用户失败: ${err}`)
      throw err
    }
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserDevices(userId: string): Promise<Array<Record<string, unknown>>>
      }
      const devices = await admin.getUserDevices(userId)
      return (devices ?? []).map((device: Record<string, unknown>) => ({
        deviceId: (device.device_id as string) ?? '',
        displayName: device.display_name as string | undefined,
        lastSeenIp: device.last_seen_ip as string | undefined,
        lastSeenTs: device.last_seen_ts as number | undefined,
        userAgent: undefined
      }))
    } catch (err) {
      error(`[Admin] 获取用户设备失败: ${err}`)
      return []
    }
  }

  async deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteUserDevice(userId: string, deviceId: string): Promise<void>
      }
      await admin.deleteUserDevice(userId, deviceId)
      info(`[Admin] 设备已删除: ${deviceId}`)
    } catch (err) {
      error(`[Admin] 删除设备失败: ${err}`)
      throw err
    }
  }

  async deleteUserDevices(userId: string, deviceIds: string[]): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteUserDevices(userId: string, deviceIds: string[]): Promise<void>
      }
      await admin.deleteUserDevices(userId, deviceIds)
      info(`[Admin] 批量删除设备: ${deviceIds.length}个`)
    } catch (err) {
      error(`[Admin] 批量删除设备失败: ${err}`)
      throw err
    }
  }

  async getRateLimit(userId: string): Promise<RateLimit | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRateLimitOverride(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const result = await admin.getRateLimitOverride(userId, false)
      if (!result) return null
      return {
        messagesPerSecond: result.messages_per_second as number | undefined,
        burstCount: result.burst_count as number | undefined
      }
    } catch (err) {
      error(`[Admin] 获取速率限制失败: ${err}`)
      return null
    }
  }

  async setRateLimit(userId: string, _limit: RateLimit): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        overrideRateLimit(userId: string): Promise<void>
      }
      await admin.overrideRateLimit(userId)
      info(`[Admin] 速率限制已设置: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置速率限制失败: ${err}`)
      throw err
    }
  }

  async deleteRateLimit(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRateLimitOverride(userId: string): Promise<void>
      }
      await admin.deleteRateLimitOverride(userId)
      info(`[Admin] 速率限制已删除: ${userId}`)
    } catch (err) {
      error(`[Admin] 删除速率限制失败: ${err}`)
      throw err
    }
  }

  async shadowBanUser(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        shadowBanUser(userId: string): Promise<void>
      }
      await admin.shadowBanUser(userId)
      info(`[Admin] 用户已影子封禁: ${userId}`)
    } catch (err) {
      error(`[Admin] 影子封禁失败: ${err}`)
      throw err
    }
  }

  async unshadowBanUser(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        unshadowBanUser(userId: string): Promise<void>
      }
      await admin.unshadowBanUser(userId)
      info(`[Admin] 用户已解除影子封禁: ${userId}`)
    } catch (err) {
      error(`[Admin] 解除影子封禁失败: ${err}`)
      throw err
    }
  }

  async getShadowBanStatus(userId: string): Promise<ShadowBanStatus | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getShadowBanStatus(userId: string): Promise<Record<string, unknown> | null>
      }
      const result = await admin.getShadowBanStatus(userId)
      if (!result) return null
      return {
        banned: (result as { banned?: boolean }).banned ?? false,
        bannedAt: (result as { banned_at?: number }).banned_at
      }
    } catch (err) {
      error(`[Admin] 获取影子封禁状态失败: ${err}`)
      return null
    }
  }

  async shadowBan(userId: string, ban: boolean = true): Promise<void> {
    try {
      if (ban) {
        await this.shadowBanUser(userId)
      } else {
        await this.unshadowBanUser(userId)
      }
      info(`[Admin] 影子封禁${ban ? '启用' : '解除'}: ${userId}`)
    } catch (err) {
      error(`[Admin] 影子封禁操作失败: ${err}`)
      throw err
    }
  }

  async getRateLimits(userId?: string): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRateLimitOverride(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
        getServerConfig(throwOnError?: boolean): Promise<Record<string, unknown>>
      }
      if (userId) {
        return (await admin.getRateLimitOverride(userId, false)) ?? {}
      }
      return (await admin.getServerConfig(false)) ?? {}
    } catch (err) {
      error(`[Admin] 获取限速配置失败: ${err}`)
      return {}
    }
  }

  async setRateLimits(userId: string, _limits: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        overrideRateLimit(userId: string): Promise<void>
      }
      await admin.overrideRateLimit(userId)
      info(`[Admin] 设置限速配置成功: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置限速配置失败: ${err}`)
      throw err
    }
  }

  async getUserRateLimit(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRateLimit(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getRateLimit(userId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取用户限速失败: ${err}`)
      return null
    }
  }

  async setUserRateLimit(userId: string, limit: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setRateLimit(userId: string, config: Record<string, unknown>): Promise<void>
      }
      await admin.setRateLimit(userId, limit)
      info(`[Admin] 设置用户限速: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置用户限速失败: ${err}`)
      throw err
    }
  }

  async deleteUserRateLimit(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRateLimit(userId: string): Promise<void>
      }
      await admin.deleteRateLimit(userId)
      info(`[Admin] 删除用户限速: ${userId}`)
    } catch (err) {
      error(`[Admin] 删除用户限速失败: ${err}`)
      throw err
    }
  }

  async getWhois(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        whois(userId: string): Promise<Record<string, unknown> | null>
      }
      const result = await admin.whois(userId)
      return result as Record<string, unknown> | null
    } catch (err) {
      error(`[Admin] 获取 Whois 失败: ${err}`)
      return null
    }
  }

  async getUsersV2(
    limit = 100,
    from?: string,
    name?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.getUsers(limit, from, name, guests)
  }

  async getUserV2(userId: string): Promise<UserInfo | null> {
    return this.getUser(userId)
  }

  async createUserV2(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    return this.createUser(username, password, options)
  }

  async getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserRooms(userId: string): Promise<{
          rooms?: Array<string | Record<string, unknown>>
        }>
      }
      const result = await admin.getUserRooms(userId)
      return (result?.rooms ?? []).map((room) => {
        if (typeof room === 'string') {
          return { roomId: room, membership: '', isRoomAdmin: false }
        }
        return {
          roomId: (room.room_id as string) || '',
          membership: (room.membership as string) || '',
          isRoomAdmin: Boolean(room.is_room_admin)
        }
      })
    } catch (err) {
      error(`[Admin] 获取用户房间列表失败: ${err}`)
      return []
    }
  }

  async getUserStats(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserStats(userId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getUserStats(userId)) ?? null
    } catch (err) {
      error(`[Admin] 获取用户统计失败: ${err}`)
      return null
    }
  }

  async getUserStatsList(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listUserStats(params: { limit?: number; from?: string }): Promise<{
          user_stats?: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listUserStats({ limit, from })
      return {
        stats: result?.user_stats ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取用户统计列表失败: ${err}`)
      return { stats: [] }
    }
  }

  async batchCreateUsers(
    users: Array<{
      username: string
      password: string
      displayname?: string
      admin?: boolean
    }>
  ): Promise<Array<{ userId: string; success: boolean }>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        batchCreateUsers(
          users: Array<{ username: string; password?: string; displayname?: string; admin?: boolean }>
        ): Promise<{
          results?: Array<{ user_id?: string; success?: boolean }>
          created?: string[]
          failed?: string[]
        }>
      }
      const result = await admin.batchCreateUsers(
        users.map((user) => ({
          username: user.username,
          password: user.password,
          displayname: user.displayname,
          admin: user.admin || false
        }))
      )
      info(`[Admin] 批量创建用户: ${users.length}个`)
      if (result?.results) {
        return result.results.map((entry) => ({
          userId: entry.user_id ?? '',
          success: Boolean(entry.success)
        }))
      }
      const created = (result?.created ?? []).map((userId) => ({ userId, success: true }))
      const failed = (result?.failed ?? []).map((userId) => ({ userId, success: false }))
      return [...created, ...failed]
    } catch (err) {
      error(`[Admin] 批量创建用户失败: ${err}`)
      return []
    }
  }

  async batchDeactivateUsers(userIds: string[], erase = false): Promise<Array<{ userId: string; success: boolean }>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        batchDeactivateUsers(
          userIdsOrUsers: string[],
          erase?: boolean
        ): Promise<{
          results?: Array<{ user_id?: string; success?: boolean }>
          deactivated?: string[]
        }>
      }
      const result = await admin.batchDeactivateUsers(userIds, erase)
      info(`[Admin] 批量停用用户: ${userIds.length}个`)
      if (result?.results) {
        return result.results.map((entry) => ({
          userId: entry.user_id ?? '',
          success: Boolean(entry.success)
        }))
      }
      return (result?.deactivated ?? []).map((userId) => ({ userId, success: true }))
    } catch (err) {
      error(`[Admin] 批量停用用户失败: ${err}`)
      return []
    }
  }

  async evictUser(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        evictUser(userId: string): Promise<unknown>
      }
      await admin.evictUser(userId)
      info(`[Admin] 用户已从全部房间逐出: ${userId}`)
    } catch (err) {
      error(`[Admin] 逐出用户失败: ${err}`)
      throw err
    }
  }

  async loginUserAs(userId: string): Promise<{ accessToken: string; deviceId: string } | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        loginAsUser(userId: string): Promise<{ access_token?: string; device_id?: string }>
      }
      const result = await admin.loginAsUser(userId)
      info(`[Admin] 以用户身份登录: ${userId}`)
      return {
        accessToken: result?.access_token ?? '',
        deviceId: result?.device_id ?? ''
      }
    } catch (err) {
      error(`[Admin] 以用户身份登录失败: ${err}`)
      return null
    }
  }

  async logoutUserAll(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        logoutUserDevices(userId: string): Promise<unknown>
      }
      await admin.logoutUserDevices(userId)
      info(`[Admin] 登出用户全部设备: ${userId}`)
    } catch (err) {
      error(`[Admin] 登出用户全部设备失败: ${err}`)
      throw err
    }
  }

  async getUserSessions(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserSessions(userId: string): Promise<{ sessions?: Array<Record<string, unknown>> }>
      }
      const result = await admin.getUserSessions(userId)
      return result?.sessions ?? []
    } catch (err) {
      error(`[Admin] 获取用户会话失败: ${err}`)
      return []
    }
  }

  async invalidateUserSession(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        invalidateUserSessions(userId: string): Promise<unknown>
      }
      await admin.invalidateUserSessions(userId)
      info(`[Admin] 用户会话已失效: ${userId}`)
    } catch (err) {
      error(`[Admin] 失效用户会话失败: ${err}`)
      throw err
    }
  }

  async getAccountInfo(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getAccountDetails(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getAccountDetails(userId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取账户详情失败: ${err}`)
      return null
    }
  }

  async updateAccountInfo(userId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateAccount(
          userId: string,
          options: { displayname?: string; avatar_url?: string; admin?: boolean }
        ): Promise<unknown>
      }
      await admin.updateAccount(userId, updates as { displayname?: string; avatar_url?: string; admin?: boolean })
      info(`[Admin] 更新账户详情: ${userId}`)
    } catch (err) {
      error(`[Admin] 更新账户详情失败: ${err}`)
      throw err
    }
  }

  async checkUserAdmin(userId: string): Promise<boolean> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        isAdmin(userId: string, throwOnError?: boolean): Promise<boolean>
      }
      return (await admin.isAdmin(userId, false)) ?? false
    } catch (err) {
      error(`[Admin] 检查管理员状态失败: ${err}`)
      return false
    }
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    return this.setAdmin(userId, isAdmin)
  }

  async deactivateUserV2(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deactivateUser(userId: string): Promise<void>
      }
      await admin.deactivateUser(userId)
      info(`[Admin] v2停用用户: ${userId}`)
    } catch (err) {
      error(`[Admin] v2停用用户失败: ${err}`)
      throw err
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deactivateUser(userId: string): Promise<void>
      }
      await admin.deactivateUser(userId)
      info(`[Admin] 删除用户成功: ${userId}`)
    } catch (err) {
      error(`[Admin] 删除用户失败: ${err}`)
      throw err
    }
  }

  async resetPasswordV2(userId: string, newPassword: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        resetPassword(userId: string, newPassword: string): Promise<void>
      }
      await admin.resetPassword(userId, newPassword)
      info(`[Admin] v2重置密码: ${userId}`)
    } catch (err) {
      error(`[Admin] v2重置密码失败: ${err}`)
      throw err
    }
  }

  async getAccountStatus(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getAccountStatus(userId: string): Promise<Record<string, unknown> | null>
      }
      const result = await admin.getAccountStatus(userId)
      return result as Record<string, unknown> | null
    } catch (err) {
      error(`[Admin] 获取账户状态失败: ${err}`)
      return null
    }
  }

  async getLoginFailures(
    limit = 50,
    from?: string
  ): Promise<{
    failures: Array<Record<string, unknown>>
    nextToken?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listLoginFailures(params: { limit?: number; from?: string }): Promise<{
          failures?: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listLoginFailures({ limit, from })
      return {
        failures: result?.failures ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取登录失败记录失败: ${err}`)
      return { failures: [] }
    }
  }

  private mapUserInfo(user: Record<string, unknown>, fallbackUserId = ''): UserInfo {
    return {
      userId: (user.name as string) || (user.user_id as string) || fallbackUserId,
      name: user.name as string | undefined,
      avatarUrl: user.avatar_url as string | undefined,
      admin: user.admin as boolean | undefined,
      deactivated: user.deactivated as boolean | undefined,
      isGuest: user.is_guest as boolean | undefined,
      createdTs: (user.creation_ts as number | undefined) ?? (user.created_ts as number | undefined),
      displayname: user.displayname as string | undefined,
      lastSeenTs: user.last_seen_ts as number | undefined
    }
  }
}
